# Design

## Context

See proposal.md for why. What shapes the approach:

- The scanner (`src/server/scanner.ts`) reads each change once per checkout (`scanChange`), then
  `mergeChanges` folds copies of one name into a single `ChangeSnapshot` whose data is the leading copy's, with
  `checkout` (the leading copy's, `isMain`) and `otherCheckouts` (each with its `column`; the main checkout is always
  listed when it is not the leader). Archives read from the main checkout carry no linked-worktree checkout; pending
  archives carry the worktree that holds them. Non-git repositories skip the merge and carry no `checkout`.
- `prompt.md` is the precedent for a non-artifact file in a change directory: read with `source.readFileInfo` /
  `readText`, bounded, a read failure becomes a warning, never a failed scan.
- Starter availability is one shared function, `availableActions` in `src/shared/types.ts`, used by the card, the
  console tab and by the server in `SessionManager.start` and `prompt` (`src/server/sessions/manager.ts`). Gating it
  there gates every place at once.
- `createChange.ts` already makes the directory with an exclusive `mkdir`, writes files into it, rolls the directory
  back on a failed write and stages it with one `git add -- openspec/changes/<name>/`.
- `yaml` is already a dependency (`src/server/sharedConfig.ts`).

## Goals / Non-Goals

**Goals:**
- One pure function decides every dependency state and the blocked flag, testable without a repository.
- No new git command, no new route, no new write path beyond one more file in the create-change directory.
- Repositories that never use `depends-on.yaml` produce byte-identical snapshots.

**Non-Goals:**
- Transitive display ("waits for X, which waits for Y") — direct dependencies only; the chain is walked one detail
  view at a time.
- Persisting anything about dependencies outside the repository.

## Decisions

### 1. A file of its own, `depends-on.yaml`, not a key in `.openspec.yaml`

`.openspec.yaml` belongs to OpenSpec: its schema (`ChangeMetadataSchema`) is OpenSpec's to evolve, and a future
`depends_on` key there with other semantics would collide with ours. A separate file is ours alone, sits next to
`prompt.md`, survives `openspec archive` (the whole directory moves) and is trivially written by an agent. YAML rather
than a plain list so the file can grow keys later without a format change; only `depends_on` is read.

*Alternative:* a `## Depends on` section in `proposal.md` — rejected: it would make a schema artifact carry dashboard
semantics, and the dashboard would have to parse Markdown prose.

### 2. Parse per copy in `scanChange`, resolve once per repository after merging

`scanChange` reads the file like `prompt.md` and sets `dependsOn` to the declared names with a provisional state
(`waiting`), or marks the file unreadable (`blocked: true` plus a warning). Because the leading copy's fields win in
`mergeChanges`, "the leading copy decides" falls out of the existing merge with no change to it.

After `changes = [...active, ...archived]` in `scanRepo`, a new pure `resolveDependencies(changes)` in
`src/shared/dependencies.ts` rewrites every state, sets `blocked`, fills `requiredBy` and appends the `missing` /
`cycle` warnings. It runs for git and non-git repositories alike.

*Alternative:* resolve in the UI from raw names — rejected: the server needs the same answer to refuse **Implement**,
and two derivations would drift.

### 3. "Met" means: the main checkout has it archived or in `Done`

A name is `met` when some change of that name is
- archived with no linked-worktree checkout (`archived && checkout?.isMain !== false`) — an archive in the main checkout,
  or any archive of a non-git repository; or
- active and its main-checkout copy is in `Done`: the leader is main (or there is no `checkout`) with `stage === "done"`,
  or `otherCheckouts` holds the main checkout with `column === "Done"`.

This reads "implemented and merged" as "on the main checkout", the same local, as-of-last-pull truth the board uses
for merged vs pending archives, with no network. `Done` in either sub-state counts: awaiting validation means a person
still has to look, not that code is missing, and holding a whole chain back on a manual check would be the larger harm.
A main checkout that is off its default branch is taken as it is; the board already warns about that state.

*Alternative:* consult `workStatus` (`merged`) of the dependency's session worktree — rejected: work status is per
session worktree, lives on the client side of the board's merged/pending rule, and would make the server's refusal
depend on session records.

### 4. Cycle detection only over unmet edges

Build the graph of active changes with edges to dependencies whose name is not `met`. A dependency is `cycle` when its
target can reach the dependent through that graph (Tarjan's SCC or a DFS per node; repositories hold tens of changes).
A self-reference is a one-node cycle. `met` edges are dropped first so a satisfied change never manufactures a cycle.
Precedence when assigning a state: `met` → `cycle` → `missing` → `waiting`.

### 5. Gating through `availableActions`

`availableActions` gains `blocked` in its `Pick<>` and leaves out `implement` when it is true. The server additionally
checks `blocked` before the generic "not available" refusal in `start` and `prompt` so the 400 names the unmet
dependencies (`waits for add-billing-api (waiting), add-billing-scheme (missing)`). Snapshots cached by an older
version lack `blocked` and therefore are not blocked — the next scan fills it in.

### 6. Card note and detail lists

The card's footer already switches between starters and a session badge; the "waits for" note is a third branch shown
for `Ready`/`Implementing` + `blocked` when no session is running. It renders even with sessions disabled, which means
the footer must render in that case for blocked cards. The detail header adds two small lists next to the prompt
block, reusing the detail route for links. Neither adds a fetch: both read the snapshot.

### 7. The create form's picker and the write

`newChangeForm.tsx` gets a multi-select fed by the target repository's active changes from the snapshot already in the
UI. `api.createChange` passes `dependsOn`. The server validates it in `postCreateChange`/`createChange` before `mkdir`
(array of ≤ 32 distinct `CHANGE_NAME` strings, not the new name) so a refusal still touches nothing, then writes
`depends-on.yaml` with `yaml`'s `stringify` after `.openspec.yaml` and `prompt.md`, inside the same try/rollback. The
single `git add -- openspec/changes/<name>/` already covers it. Label-targeted creation (`createInRepos`) sends none.

## Risks / Trade-offs

- [A dependency is merged on the remote but the user has not pulled] → it stays `waiting`; the tooltip and detail view
  say "waiting", and the pull action is one click away. This is the same staleness every git fact on the board has.
- [Someone ticks every box of a dependency in the main checkout without merging code] → it reads as `met`. Accepted:
  the board already trusts `tasks.md` for `Done`.
- [A typo in a dependency name blocks the change forever] → reported as `missing` with a warning on the card's error
  mark and in the detail header, so the cause is visible; the fix is editing one file.
- [Malformed file blocks Implement] → deliberate fail-closed; the warning names the file.
- [Widening invariant 1] → one more file in a directory the dashboard just created exclusively; no new command or
  path outside it. CLAUDE.md and the "never writes" requirement are updated together.

## Migration Plan

None. Repositories without `depends-on.yaml` are unaffected; cached snapshots load without the new fields and are
refreshed on the next scan. Rollback is reverting the change; existing `depends-on.yaml` files are then just ignored.
