## Context

OpenSpec reads `openspec/config.yaml` per project. Besides `schema`, two keys feed agents: `context` (a string injected into every artifact instruction; OpenSpec **ignores it entirely above 50KB**) and `rules` (a map of artifact id → list of strings). Other keys exist and must be left alone. Of the 13 tracked repositories, 12 carry the untouched scaffold (both keys only as commented examples) and one has its own `context`.

The dashboard today is strictly read-only towards tracked repositories (CLAUDE.md invariant 1, `dashboard-api` "The dashboard never writes to tracked repositories"). Its own state lives in `~/.openspec-dashboard/` (`config.json`, written atomically by `saveConfig`). The scanner reads `config.yaml` only with a regex for `schema:`; the project has no YAML parser of its own, but `yaml` 2.9 is installed as a dependency of `@fission-ai/openspec`. The API binds to loopback and has no authentication and no cross-site request protection; all current mutating endpoints only write to the dashboard's home.

Related in-flight proposals: `create-change-from-dashboard` (first write into a repository: creates a change directory; proposes cross-site protection), `run-agent-actions-from-ui`, and `dedupe-discovery` (modifies the same never-writes requirement for the git allow-list). None has landed.

A scratch spike confirmed the central assumption: with the `yaml` document API, inserting managed content into the real scaffold and into a config with local context and rules preserves all comments and formatting, applying twice is byte-identical, and removing restores the scaffold byte for byte.

## Goals / Non-Goals

**Goals:**
- Named profiles of shared `context` + `rules`, edited in the dashboard; each enabled repository can carry any subset of them, several at once.
- Project-specific context and rules survive, untouched.
- Sync state visible per repository and derived from the repository alone.
- Apply is explicit, previewed, minimal, atomic and reversible (clearing the shared config and applying removes every trace).

**Non-Goals:**
- Committing, staging or any git write. The result is an uncommitted modification.
- Managing `schema` or any key other than `context` and `rules`.
- Per-repository overrides or exclusions stored in the dashboard (a project opts out simply by not being selected; its state then reads `not applied`/`outdated`).
- Templating/variables in the shared text, profile inheritance, or importing a profile from a repository.
- A dashboard-side record of which repository *should* carry which profile. Assignment is what the files say; the grid in Settings is pre-filled from them.
- Creating `openspec/config.yaml` where none exists (such a repository is `unreadable`; OpenSpec init is the user's step).
- Auto-apply on save or on a schedule.

## Decisions

### D1: Managed sections with in-file markers
Shared content is embedded so that it is recognisable in the file itself:

```yaml
context: |
  <!-- openspec-dashboard:shared:begin base — managed by openspec-dashboard, edits here are overwritten -->
  We use conventional commits.
  <!-- openspec-dashboard:shared:end base -->

  <!-- openspec-dashboard:shared:begin security — managed by … -->
  Threat-model every new endpoint.
  <!-- openspec-dashboard:shared:end security -->

  Tech stack: Go.            # ← the project's own context, never touched
rules:
  proposal:
    - Always include Non-goals # openspec-dashboard:shared:base
    - State the data classification # openspec-dashboard:shared:security
    - Mention the on-call impact        # ← local rule, never touched
```

- **Profiles:** a profile has a stable slug id (`^[a-z0-9][a-z0-9-]{0,62}$`), a display name, a `context` and `rules`. The id is what is written into repositories, so renaming the display name is free while changing the id orphans what was applied. Shared text must not itself contain the marker string, and rules are single-line (both validated on save), so markers can always be read back unambiguously.
- **context:** one block per profile, delimited by marker lines naming the profile id, placed at the start of the string in the dashboard's profile order, each followed by a blank line, then the local text. The markers are HTML comments: inert to a model reading the context, unambiguous to find. Local text is everything outside the block.
- **rules:** each shared entry is a scalar with the trailing YAML comment `openspec-dashboard:shared:<profile id>`. Shared entries come first in each list (profile order, then rule order), local entries keep their order after them. An artifact id with no entries left is removed; an empty `rules` map is removed.

*Why markers in the file rather than remembering what was applied:* the sync state must be derivable from the repository (invariant 5), must survive a fresh dashboard home, and must stay correct when someone edits the file by hand or another machine applies a different version.

*Alternative — replace `context`/`rules` wholesale:* trivial to implement, but destroys local guidance (one repository already has some) and makes the dashboard the only place project-specific context can live. Rejected.
*Alternative — a separate file referenced from the config:* OpenSpec has no include mechanism for `context`.

*Why the profile id is in the marker from day one:* the marker format is persisted in repositories. Shipping an id-less format first and adding profiles later would require migrating every applied file; carrying the id costs nothing now.

If a file contains a begin marker without a matching end marker, a nested block, a marker without a profile id, or two blocks for the same profile, it is treated as `unreadable` for state and apply is refused for that repository: guessing where a managed block ends could delete local text.

### D2: Edit with the `yaml` document API; declare it as a direct dependency
`parseDocument` → mutate nodes → `toString({ lineWidth: 0 })`. This keeps comments, key order, quoting and blank lines, which a parse-to-object/serialize round trip or regex surgery would not. `context` is always written as a literal block scalar (`|`). `yaml` is pure JavaScript with no file or module-path lookups, so it is safe in the compiled binary; it is added to `dependencies` explicitly rather than relied on transitively. All YAML handling lives in one module, `src/server/sharedConfig.ts`; the scanner's regex read of `schema:` stays as is.

**Minimal-diff guarantees, enforced by tests:** (a) applying an unchanged shared config to an `in sync` file produces identical bytes and therefore performs no write; (b) applying then removing restores the original bytes for the scaffold and for a config with local content; (c) keys other than `context`/`rules`, and all comments, are byte-identical before and after. One exception to (b), found while testing: a project's own context written as a quoted or plain one-line scalar comes back from removal with the same *value* but as a literal block — the file holds no trace of the original quoting, and remembering it in the dashboard would violate "derived from the repository alone".

### D3: Per-repository state is a pure function of (file text, profiles)
`repoSharedConfig(text | undefined, shared)` returns `{ unreadable, applied: [{ id, state }] }`:

| Result | Condition |
|---|---|
| `unreadable: true` | file missing, YAML errors, `context` not a string, `rules` not a map of lists, or malformed markers |
| applied profile `in-sync` | the file's managed content for that id equals the profile (context block text after trimming; rules per artifact id as ordered lists) |
| applied profile `outdated` | managed content for a known id differs from the profile, including partially removed content |
| applied profile `orphaned` | managed content for an id the dashboard does not have |

Applied profiles are reported in dashboard order with orphans last, whatever their order in the file. A repository with no managed content has `applied: []`; that is neutral, because which profiles a repository ought to carry is the user's decision at apply time, not something the dashboard stores. The scanner already reads `openspec/config.yaml` once per repository; it passes that text to this function and stores the result on `RepoSnapshot.sharedConfig`. While the dashboard has no profiles the field is omitted and the UI shows nothing. Saving profiles triggers a rescan so states update.

### D4: Apply = preview → confirm → atomic write, per repository
Endpoints (all under the existing fetch handler):

- `GET /api/shared-config` / `PUT /api/shared-config` — read/save `{ profiles: [{ id, name, context, rules }] }` in `~/.openspec-dashboard/shared-config.json` (atomic, validated per D1; `{ profiles: [] }` before anything is saved). A separate file rather than a field of `config.json`, because `PUT /api/config` replaces that document wholesale and `dedupe-discovery` is changing its validation.
- `POST /api/shared-config/preview` `{ assignments: [{ repoId, profileIds }] }` → per repository `{ current, before, after, refusal? }`. Pure; writes nothing.
- `POST /api/shared-config/apply` with the same body → per repository `{ result: "written" | "unchanged" | "refused", reason? }`, then triggers a scan.

An assignment is the *complete* desired set for that repository: the file ends up carrying exactly those profiles, in dashboard order; profiles not listed — orphaned ones included — are detached, and an empty list removes all managed content. An unknown profile id refuses that repository rather than being skipped. Apply re-reads the file and recomputes at write time (no trust in a stale preview), refuses per repository rather than failing the batch, and writes via temp file in the same directory + `rename`, preserving the file mode. It only targets `<repo.path>/openspec/config.yaml` for repository ids that are enabled in the config — the path is built from the config, never taken from the request. Refusals: not an enabled repository; file missing; state `unreadable`; combined `context` over 50KB (measured in UTF-8 bytes, the same way OpenSpec does); repository path no longer exists.

The UI computes the visual diff from `before`/`after` with a small line-diff helper (no dependency): unchanged lines collapsed, added/removed lines marked with `+`/`−` text as well as colour.

### D5: One boundary for every write into a repository
The never-writes requirement is rewritten as a positive rule that also fits `create-change-from-dashboard`: *the dashboard writes to a tracked repository only in response to an explicit user action, only to the paths enumerated in the spec, never deletes or moves anything, and never runs a git command that writes.* This change enumerates `openspec/config.yaml` (modify `context`/`rules` managed sections only). Scanning, previewing, saving Settings and polling remain write-free, and the existing no-side-effects test is extended to prove it.

Since `create-change-from-dashboard`, `dedupe-discovery` and this change all modify that one requirement, each delta must be rebased on the main spec text at archive time; the design of all three is compatible (they add, none contradicts).

### D6: Cross-site request protection lands with the first repository write
A web page open in the same browser can `fetch("http://127.0.0.1:4711/api/…", { method: "POST" })`. Harmless while endpoints only touched the dashboard's home; not acceptable once one can modify files in 13 repositories. A guard in front of every non-GET `/api/` route requires `Content-Type: application/json` (forces a CORS preflight, which the server never approves) and, when an `Origin` header is present, that it equals the server's own origin (`http://127.0.0.1:<port>` or `http://localhost:<port>`); otherwise `403`. `Sec-Fetch-Site: cross-site` is rejected as well. The UI's `api.ts` already sends JSON.

`create-change-from-dashboard` proposes the same guard. It is specified here as an ADDED requirement; whichever change archives second drops its duplicate (an ADDED requirement that already exists fails archive validation, so it cannot be missed).

### D7: UI placement
- **Settings → "Shared OpenSpec config" panel:** a list of profiles (add, rename, delete, reorder); for the selected profile a textarea for `context` (with a live byte counter against 50KB) and an editable list of rules grouped by artifact id (ids offered from the schemas seen in the snapshot, free text allowed). Its own Save button, independent of the scan-config save bar. Below it, an **assignment grid**: enabled repositories as rows, profiles as columns, a checkbox per cell pre-filled from what each repository carries now, with the cell's state (`in sync` / `outdated`) beside it and orphaned profiles listed per row. Rows whose selection differs from the file, or that carry an outdated or orphaned profile, are marked as pending; "Preview & apply" acts on the pending rows.
- **Preview dialog:** one collapsible diff per selected repository, refusals listed with their reason, a single "Apply" confirm. Nothing is written before that click.
- **Projects overview:** a compact summary in each row — the applied profile names, with `outdated`/`orphaned` as a warning badge and `unreadable` as danger, always with text; nothing for a repository that carries no profile — shown only once a profile exists. **Repository header:** the same, with one badge per applied profile.

## Risks / Trade-offs

- [Modifying a git-tracked file in many repositories at once] → Explicit action, mandatory preview, managed sections only, atomic write, byte-identical no-op when already in sync, and no git commands: every change is an ordinary diff the user reviews and commits or discards with `git checkout`.
- [`yaml` reformats something unexpectedly in an exotic config (anchors, flow style, odd indentation)] → The preview shows the exact resulting text; the byte-level tests cover the real configs; anything the library reports as an error is `unreadable` and refused.
- [Someone edits inside the managed block by hand] → State becomes `outdated`; the next apply overwrites the block. That is the contract of a managed section and is stated in the marker text.
- [Marker text is visible to the model inside `context`] → Two short HTML comment lines; no behavioural effect expected. Accepted for the benefit of in-file, tool-independent markers.
- [Shared + local context exceeds 50KB and OpenSpec silently drops all context] → Refused with the sizes in the reason; the editor shows the shared size while typing.
- [Three in-flight changes rewrite the same requirement] → Compatible wording (D5); rebase at archive; the duplicate guard requirement fails loudly (D6).
- [First real cross-site guard could break an unforeseen client, e.g. `curl` scripts without a content type] → Only non-GET routes are guarded; `curl -H 'content-type: application/json'` keeps working (no `Origin`); documented in the README.

## Migration Plan

Additive. No shared config exists after upgrade, so no state is shown and nothing can be applied until the user creates one. Rollback: revert the commit; repositories keep whatever was applied (valid OpenSpec config either way), and the managed sections can be removed by hand or by applying an empty shared config before rolling back.

## Open Questions

- Should the overview get a filter/sort for "not in sync"? Deferred until the badge has been lived with.
