# Design

## Context

See `proposal.md` for motivation. The dashboard today never writes to a tracked repository (invariant 1). This change narrows that guarantee to allow exactly one new write path — creating a new change directory — so a user can start a change from the board with the same intent they had when it occurred to them.

Relevant existing pieces:

- **CHANGE_NAME regex** — `src/server/source.ts` already exposes `^[A-Za-z0-9._-]+$` for the scanner. The endpoint reuses it verbatim; nothing else needs a name validator.
- **Cross-site guard** — `src/server/api.ts::crossSiteRefusal` already gates every non-GET route. The proposal calls it out as a prerequisite: this change is the first endpoint whose write reaches *outside* `~/.openspec-dashboard/`, so the guard graduates from "nice to have" to "load-bearing", but the code is already there. No new guard is needed.
- **OpenSpec adapter** — `src/server/openspecAdapter.ts` shields the app from `@fission-ai/openspec` internals. The `openspec new change` command *inside that library* uses `import.meta.url` under the hood; running it from the compiled binary is exactly the trap invariant 3 warns about. That is decisive for D1 below.
- **Scanner** — `src/server/scanner.ts` already builds `ChangeSnapshot`; `src/shared/types.ts` defines it. Adding a `prompt` field is a mechanical extension.
- **Board / cards** — `src/ui/kanban.tsx` renders the header and cards. The header owns the repo-level actions ("Refresh", "Copy cd"), which is where the new **New change** action goes; the copy-command action lives on the card.

The invariant text in `openspec/specs/dashboard-api/spec.md` and in `CLAUDE.md` is what defines the guarantee. This change edits both — the spec via a MODIFIED delta, `CLAUDE.md` directly during implementation.

## Goals / Non-Goals

**Goals:**
- One narrow, well-bounded write path from the dashboard into a tracked repository: `POST /api/repos/<id>/changes`, creating `openspec/changes/<name>/` with `.openspec.yaml` (and, optionally, `prompt.md`).
- The write is atomic (exclusive create — two concurrent requests cannot both succeed), refused for the enumerated reasons *without touching the disk*, and doesn't run any subprocess (no git, no `openspec` CLI).
- The change appears on the board without a page reload after creation, via the existing rescan path.
- Cards for changes before `Ready` copy a start command (`/opsx:continue`), extended to point at `prompt.md` when it exists, so the copied action matches the card's stage.

**Non-Goals:**
- Editing an existing change from the dashboard (name, prompt, or anything else). If a mistake was made, the user removes the directory or edits it by hand — same as they would with `openspec new change`.
- Wiring the "start" command to actually run an agent. The dashboard only copies text.
- Making `prompt.md` a schema artifact or letting it affect column placement. It's a hint for the model, not a lifecycle input.
- Any change to the pull, session, or shared-config write paths — those stay exactly as they are.

## Decisions

### D1. Write the marker directly; do not shell out to `openspec new change`
- **Choice**: Write `.openspec.yaml` from the server, in-process, using the same shape `openspec new change` produces (`schema: <schema>\ncreated: <YYYY-MM-DD>\n`). Read the repository's schema by parsing its `openspec/config.yaml` (falling back to `spec-driven` when the key is missing or the file is absent), atomically create the change directory with `mkdir` + `O_EXCL`-style guarantees.
- **Why**: Invariant 3 (`src/server/openspecAdapter.ts`) already warns that `@fission-ai/openspec` locates files with `import.meta.url`, which does not exist in the compiled binary. Spawning `openspec` as a subprocess would also break invariant 1's "no processes started" boundary and depend on an external binary being on PATH. Writing two tiny well-defined files is straightforward and stays entirely within our own code.
- **Alternatives considered**:
  - *Call the library's programmatic `newChange` if it exists* — same `import.meta.url` risk, and the library's exact output isn't a contract we want to depend on.
  - *Spawn `openspec new change`* — new subprocess dependency; violates the "no processes" scenario in the change-creation spec.

### D2. Atomicity via exclusive directory creation
- **Choice**: Create `openspec/changes/<name>/` with `fs.mkdir(dir, { recursive: false })`. On Linux/macOS this fails with `EEXIST` if the directory (or a file) is already at that path, which is what we want: no lock, no race window. Then write `.openspec.yaml` and (if provided) `prompt.md` into it. If either write fails after the directory exists, remove the just-created directory (best effort) and return the error; a partial half-empty change directory in a failed state is worse than nothing on disk.
- **Why**: Simple, kernel-level. Two concurrent `POST` calls for the same name: exactly one `mkdir` returns success; the other gets `EEXIST` and is answered with `409`. No shared-state lock in the server needed. The recursive: false guarantees we don't accidentally create `openspec/` if it's missing — that case is caught by the earlier "no `openspec/` parent" refusal.
- **Alternatives considered**:
  - *In-process mutex per repo* — solves same-process races but not cross-process (e.g. someone running `openspec new change` in a terminal at the same moment). `mkdir` exclusive-create is the same guarantee at the OS level.
  - *Write to a temp dir then rename* — `rename` onto an existing directory has different behaviour across platforms and doesn't buy us anything here.

### D3. Refuse pre-write, always, with enumerated reasons
- **Choice**: Validate in this order, returning without any disk write on the first miss:
  1. Body is JSON `{ name, prompt? }` with correct types → else `400`.
  2. `name` matches `CHANGE_NAME` and is not empty → else `400`.
  3. Repo `<id>` is configured *and* enabled → else `404` (unknown) or `409` (disabled).
  4. Repo's last scan succeeded (per snapshot `ok: true`) → else `409`.
  5. `<repoPath>/openspec/changes/` exists as a directory → else `409` ("no openspec/ to create into").
  6. No active `<repoPath>/openspec/changes/<name>` and no archived `<repoPath>/openspec/changes/archive/<YYYY-MM-DD>-<name>` → else `409`.
- **Why**: The proposal calls out that a refusal must leave the repo untouched. Ordering by cheapest-first also means we never open the archive listing unless the request cleared everything else. The archived check uses the same `YYYY-MM-DD-<name>` convention `openspec/changes/archive/` uses (see `src/server/source.ts`).
- **Alternatives considered**:
  - *Use the snapshot instead of the filesystem for uniqueness* — a stale snapshot could miss a directory just created by hand. Reading the archive directory names is cheap and correct.
  - *Fail during `mkdir` on a duplicate active name* — works, but we'd miss the archived clash and we'd have to distinguish `EEXIST` from other errors. Explicit pre-check is clearer.

### D4. `prompt.md` shape
- **Choice**: When `prompt` is a non-empty string, write `# Prompt\n\n<text>\n`. The heading is fixed so the file is recognisable at a glance and parseable if anyone ever wants to. The body is *exactly* what the user typed (only trailing whitespace trimmed to end with a single newline). A `prompt` that is missing, `null`, or entirely whitespace after trimming produces no file — an empty prompt is the same as no prompt.
- **Why**: The proposal is explicit that `prompt.md` is not a schema artifact and does not affect artifact status. Keeping it a plain, single-heading markdown file means the scanner never needs a parser for it — it just reports presence and text.
- **Alternatives considered**:
  - *No fixed heading* — makes it slightly harder for a human reading the file to see what it is.
  - *YAML frontmatter* — over-engineered for a free-text hint.

### D5. Scanner exposes `ChangeSnapshot.prompt`
- **Choice**: Extend `ChangeSnapshot` in `src/shared/types.ts` with `prompt?: string`. The scanner reads `prompt.md` (bounded, say ≤ 8 KiB — larger prompts are truncated and a warning is added) when it walks the change directory. Errors reading it become a per-change warning; the field is simply absent. `prompt.md` is *not* passed through the OpenSpec library — it's a repository-local artifact only the dashboard cares about.
- **Why**: The board needs both "does it have a prompt" (for the badge) and "what does it say" (for the tooltip and the extended start command). Serving both from one field keeps the API small. Bounding avoids paying scan cost for pathological files.
- **Alternatives considered**:
  - *Separate boolean and lazy-fetch text* — extra endpoint; the tooltip needs the text on hover, which is bad UX if it has to round-trip.
  - *Read the file on click in the UI* — the SPA has no access to the filesystem; would need a new API route for something the scanner already visits.

### D6. Cards choose the copy command by column
- **Choice**: `src/ui/format.ts` builds the string. The rule is: if the column is `Ready`, `Implementing`, `Done`, `Synced`, or `Archived`, copy `cd <path> && claude "/opsx:apply <name>"` (today's behaviour). Otherwise — every artifact column and `New` — copy `cd <path> && claude "/opsx:continue <name>"`, appending ` — see openspec/changes/<name>/prompt.md` when the change reports a prompt. The action's label swaps text ("Copy apply command" ↔ "Copy start command") so the user knows which is which.
- **Why**: The proposal ties the command to the change's stage, not to the presence of `prompt.md` — the pointer to `prompt.md` is only an *extension* of the start command. The column set for the start command matches "any column before `Ready`", which is exactly the schema's own definition of "still drafting".
- **Alternatives considered**:
  - *Always copy an apply command and let the user edit it* — defeats the point.
  - *Pipe the prompt text into the copied command directly* — long prompts break clipboard content and would need shell-escaping we don't want to own; a file path is safer.

### D7. UI form: minimal, header-anchored
- **Choice**: The **New change** action in the repository board header opens a small inline dialog (or a compact panel next to the header — implementer's call, both are fine) with two fields: a name and a prompt. Name validation is live against `CHANGE_NAME`; the submit button is disabled while invalid. Submit calls `POST /api/repos/<id>/changes`; on `201` the form closes and the client triggers the standard rescan the dashboard already does after a mutating action; on error, the message from the server is shown next to the form.
- **Why**: The header is where repo-level actions live already ("Refresh", "Copy cd"). No new page or nav is needed.
- **Alternatives considered**:
  - *A whole "new change" page* — overkill; forces navigation for a one-field action.
  - *Right sidebar drawer* — heavier than the interaction warrants.

### D8. Rescan-then-reload flow
- **Choice**: After `201`, the client fires the existing `POST /api/scan` (or reads the fresh snapshot from the response — see below) and re-renders. The server's create-change handler triggers a rescan of the repository before returning, so the response's caller sees a fresh state on the next `GET /api/state`. The response itself only carries `{ name }`; the client refetches state.
- **Why**: This keeps the create-change endpoint's response tight and reuses the existing scan pipeline (bounded concurrency, cache write) instead of forking a second path to update the snapshot in place.
- **Alternatives considered**:
  - *Return the full new snapshot in the response* — couples the endpoint to the snapshot shape and doubles the payload; not worth it.
  - *Let the client poll* — adds latency; we already know the scan is coming.

### D9. Invariant 1 stays a whitelist
- **Choice**: Add exactly one entry to the enumerated list in `openspec/specs/dashboard-api/spec.md` ("The dashboard never writes to tracked repositories") — the create-change directory. `CLAUDE.md` gets the equivalent one-line addition. Every other clause of that requirement stays exactly as it is.
- **Why**: The invariant is the project's headline promise. The proposal is explicit that the wording matters. A whitelist means every future write path has to be added the same way.
- **Coordination**: The proposal notes that `dedupe-discovery` (in-flight, in the same file) already modifies this requirement. Whichever change archives second must merge both edits.

## Risks / Trade-offs

- **The user creates a change and forgets about it** → the empty directory sits in the working tree as untracked. Mitigation: the change shows in `New` on the board so it's visible; the badge for `prompt.md` (when present) further advertises it. Removing it is the same as removing any untracked directory.
- **The user typed a prompt that turns out to be nonsense/PII** → it's on disk in the repository. Mitigation: the file is plain markdown with a fixed heading; deleting it is `rm openspec/changes/<name>/prompt.md`. We don't send it anywhere.
- **Two writers race on the same name (dashboard + terminal)** → resolved by `mkdir` exclusive-create; the loser sees `EEXIST` (dashboard translates to `409`) or, for the terminal, whatever `openspec new change` reports.
- **`.openspec.yaml` gets out of sync with what the library expects** → the file we write is two lines with a stable shape the library has produced since the current OpenSpec version. Mitigation: cover it with a test that reads the file back through the same code the scanner uses (`resolveSchema`/`loadChangeContext` via the adapter) and asserts the change is recognised.
- **Scanner cost from reading `prompt.md`** → one bounded file per change directory per scan. Mitigation: skip the read when the file doesn't exist (single `stat`), bound its size, and cache within a scan pass.
- **Cross-site protection is now the last line of defence for a write into a tracked repo** → the guard already exists (`crossSiteRefusal` in `src/server/api.ts`) and is applied to every non-GET; tests already cover it. Mitigation: add an explicit test for the create-change endpoint that asserts a foreign origin gets `403` and nothing is written.

## Migration Plan

- The change is additive at the schema level and behaviourally opt-in (nothing happens until the user clicks the new action). No data migration.
- The `ChangeSnapshot.prompt` field is optional; older clients (if any) ignore it. The board is served by the same build, so this is not a real concern.
- Rollback: revert the commits. Because nothing has been persisted about the new action anywhere but in the repositories the user pointed it at, and each such write is a normal `openspec/changes/<name>/` directory, rollback of the dashboard does not require any repository cleanup.
