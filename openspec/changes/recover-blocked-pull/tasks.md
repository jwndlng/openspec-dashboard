# Tasks

## 1. Types and classification

- [ ] 1.1 Add `PullBlockingFile` and the `blocking`, `resolvable`, `resolved` and `hint` fields to `PullResult` in `src/shared/types.ts`; verify with `bun run typecheck` (via `bun run check`).
- [ ] 1.2 In `src/server/pull.ts`, add pure, exported helpers that turn `diff --name-only -z`, `status --porcelain=v1 -z`, `ls-tree` and `ls-files -s` output into the blocking set and classify each path (leftover under `openspec/changes/<CHANGE_NAME>/`, not `archive`; `A `/`AM`/`??`; present upstream; identical vs differs); verify with unit tests in `test/pull.test.ts` covering staged, untracked, tracked-and-edited, `archive/`, invalid change names and paths outside `openspec/changes/`.
- [ ] 1.3 After a refused `merge --ff-only`, run the read-only commands, attach `blocking`, `resolvable` (only when every file is a leftover) and a `hint` ("commit or set aside …" / leftovers explanation); keep git's message when the blocking set is empty; add the plain "reconcile outside the dashboard" `hint` to the diverged refusal; verify with temp-repo tests: overlapping edit lists `app.txt` as local work, unrelated edit is not listed, diverged has the hint and no mention of force.

## 2. Resolve and pull

- [ ] 2.1 Implement the resolve path in `pull.ts` under the existing in-flight lock: re-inspect, compare upstream commit and the recomputed classification with the claim, no fetch; verify with tests that a changed leftover, a moved upstream, an extra/missing file, or a local-work file each yield `refused` with the repository byte-for-byte unchanged (compare `git status`, index file and file contents).
- [ ] 2.2 Copy differing leftovers (and a `.staged` copy when the index blob differs from both) to `~/.openspec-dashboard/pull-backups/<sanitised-repo-id>/<timestamp>/<path>`, aborting before any removal if a copy fails; verify in a test using `OPENSPEC_DASHBOARD_HOME` that the copy holds the local bytes.
- [ ] 2.3 Remove the leftovers (`git rm --cached --quiet --` for staged ones, unlink all), run the hook-less `merge --ff-only`, return `fast-forwarded` with `resolved`; verify with tests for an identical staged `.openspec.yaml`, a differing staged `prompt.md` (copy saved) and untracked leftovers, each ending fast-forwarded with the files tracked at upstream content and `notes.txt`'s unrelated edit kept.
- [ ] 2.4 On a still-refused merge, write the files back from memory and `git add --` the previously staged ones; verify with a test that forces the retried merge to fail (a second overlapping edit created between claim and resolve, via a test hook) and checks content and staged state are restored and copies remain.

## 3. API

- [ ] 3.1 Accept `{ resolve: { upstream, files } }` on `POST /api/repos/<id>/pull` in `src/server/api.ts`: shape validation (hex commit id, relative paths without `..`, bounded count) → `400`; same eligibility, `409` busy guard, same-origin guard and rescan; `POST /api/pull` ignores any resolve; verify in `test/pullApi.test.ts` (resolve as offered, malformed → 400 with no write, foreign origin → 403, busy → 409).

## 4. UI

- [ ] 4.1 `src/ui/api.ts`: add `resolvePull(repoId, resolve)` to the API interface, the real client and the switchable wrapper; `src/ui/pullState.ts`: a `blocked` label for leftover-only refusals, details that mention the file count, and a helper describing each file's classification; verify with `test/pullUi.test.ts`.
- [ ] 4.2 `src/ui/pull.tsx`: `PullProvider.resolve` sharing the in-flight map; a `PullBlockedList` component (files, classification, hint, Resolve and pull with confirmation, outcome with copy locations); make the outcome badge open it in a `Modal` when the result has `blocking`, keeping the row click from navigating; styles in `src/ui/styles.css`; verify with `bun run dev` in the board header and the overview row.
- [ ] 4.3 `src/ui/endSessionDialog.tsx`: render `PullBlockedList` inline under the pull report; verify in the dev build that resolving from the dialog updates the Pull badge elsewhere too.

## 5. Demo

- [ ] 5.1 `src/ui/demo/demoApi.ts`: one sample repository blocked on its first pull by an identical `.openspec.yaml` and a differing `prompt.md` of a made-up change; `resolvePull` answers with a fast-forward, both files and a made-up copy path; verify in the demo build and on the product build (`bun run dev`) that the modal lays out correctly in both.

## 6. Documentation and invariants

- [ ] 6.1 Update `CLAUDE.md` invariant 1 (the pull action's leftover removal, `rm --cached`, the put-back `add`, the new read-only subcommands) and the README's "what it writes" list; verify by reading them against `specs/dashboard-api/spec.md`.
- [ ] 6.2 Confirm `test/pull.test.ts`'s "scans leave a recording remote untouched" test still passes and add an assertion that a refused pull with an offer changed nothing beyond the fetch.
- [ ] 6.3 Run `bun run check` and `bun run build`, then pull a temp repository blocked by leftovers with `dist/openspec-dashboard` to confirm the compiled binary resolves it.
- [ ] 6.4 Before archiving: if `add-cleanup-capabilities` is not yet archived, archive it first (or re-apply its item (6) to the "never writes" requirement), since both changes replace that requirement in full; verify with `openspec validate --strict` after archive.
