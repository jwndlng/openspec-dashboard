# Tasks

## 1. Shared groundwork

- [x] 1.1 Add `CleanupPreview`, `CleanupWorktree`, `CleanupBranch`, `CleanupSelection` and `CleanupResult` to `src/shared/types.ts` (design D7); verify with `bun run typecheck`.
- [x] 1.2 Generalise `contentIsInBase` in `src/server/sessions/workStatus.ts` to take a `cwd` and a ref (existing caller passes the worktree and `HEAD`) and export it; verify `test/workStatus.test.ts` still passes unchanged.
- [x] 1.3 Give `removeWorktree` in `src/server/sessions/worktree.ts` an `unlock` option (default true for the session views) so cleanup unlocks only dashboard-created worktrees; verify existing worktree-removal tests pass and a new test shows a locked worktree is not unlocked when `unlock` is false.
- [x] 1.4 Add `runningWorktreePaths()` to `SessionManager` (real paths of worktrees with a running session) and a hook for refusing session start/resume with `409` while a repository's cleanup runs (design D6); verify with a unit test in `test/terminalSessions.test.ts` or a new test using the fake agent.

## 2. Cleanup preview (read-only)

- [x] 2.1 Create `src/server/cleanup.ts` with `previewCleanup`: base from `defaultBranch`, worktrees from `git worktree list --porcelain` (skip the main checkout, prunable records into `prunable`), dashboard-created detection by real path (design D2), removability via `readWorkStatus` + `checkWorktreeRemovable`, running-session and foreign-lock reasons; verify with tests in a new `test/cleanup.test.ts` against temp git repos: clean merged worktree removable, worktree with an untracked file kept, locked user worktree kept with its reason, running path kept, deleted directory listed as prunable.
- [x] 2.2 Add branch candidates to `previewCleanup` (design D3): all `refs/heads` except the default branch, main checkout's branch kept, ancestry then content check, kept reasons with commit counts, `worktreePath` dependency, unknown base keeps everything; verify with tests: fast-forward-merged, squash-merged with remote branch gone, unmerged with "2 commits not in main", branch in the main checkout, branch checked out in a dirty worktree, repository without `origin/HEAD`/`main`/`master`.
- [x] 2.3 Prove the preview writes nothing: a test snapshots the repository's working tree, `.git/index` (with stale stat info), `.git/refs`/`packed-refs` and worktree directories before and after `previewCleanup` and asserts they are byte-identical.

## 3. Applying a selection

- [x] 3.1 Implement `applyCleanup` worktree phase (design D5): match requested paths against the current worktree list, re-check running session, removability and lock, unlock only dashboard-created, non-forcing `git worktree remove`; per-item outcome, one failure not stopping the rest; verify with tests including "file created after preview → kept" and "path not a worktree of this repository → kept, no write command run".
- [x] 3.2 Implement the prune phase (only when requested and a prunable record exists) and verify with a test that the record is gone from `git worktree list` afterwards.
- [x] 3.3 Implement the branch phase (design D4): name validation, `show-ref` must equal the requested commit, recompute the merge verdict, re-read the worktree list, then `git branch -D -- <name>`, returning the commit; verify with tests: merged branch deleted and restorable with `git branch <name> <commit>`, branch moved since preview kept, `--all` and `../x` rejected as invalid names, branch whose worktree was kept in the same run kept, branch whose worktree was removed in the same run deleted.
- [x] 3.4 Prove the boundaries: a test with a local bare "remote" asserts cleanup leaves every `refs/remotes/` ref and the remote repository unchanged, and the main checkout's branch, `git status` and `.git/index` are byte-identical; verify it passes.

## 4. API

- [x] 4.1 Add `GET` and `POST /api/repos/<id>/cleanup` in `src/server/api.ts` with eligibility (unknown → 404, disabled/non-git/failed scan → 409, no git run), body validation (400), per-repository running lock (409), rescan after apply, independent of the agent-sessions setting; verify with a new `test/cleanupApi.test.ts` covering each status code and a preview→apply round trip with sessions disabled.
- [x] 4.2 Verify the same-origin guard covers the new `POST`: a test posting with a foreign `Origin` gets `403` and nothing is removed.

## 5. UI

- [x] 5.1 Add `cleanupPreview(repoId)` and `cleanup(repoId, selection)` to the `Api` interface and HTTP implementation in `src/ui/api.ts`; verify `bun run typecheck` fails until the demo implements them (task 6.1).
- [x] 5.2 Build `src/ui/cleanup.tsx`: dialog with the three sections, removable items pre-selected, kept items in a collapsed "Kept (N)" group with reasons, worktree↔branch dependent selection, last-fetch and ignored-files notes, confirm label naming the counts and disabled when empty, "nothing to clean up" state, running state, result list with copyable restore commands; verify with a vnode test (as in `test/pullUi.test.ts`) for the confirm label, dependent selection and empty state.
- [x] 5.3 Add the `Clean up` button to the board header in `src/ui/kanban.tsx` next to Pull, only for `repo.isGit && repo.ok`, reloading the board after a cleanup; add dialog styles to `src/ui/styles.css`; verify in `bun run dev` that the dialog opens, cancels without changes, and removes a merged test worktree and branch in a scratch repository.

## 6. Demo

- [x] 6.1 Add a merged linked worktree with its merged branch, a dirty worktree and an unmerged branch to one repository in `src/ui/demo/sampleData.ts`, and implement `cleanupPreview`/`cleanup` in memory in `src/ui/demo/demoApi.ts`; verify with a test in `test/demoApi.test.ts` that applying removes the worktree from the snapshot, returns a restore command, and a fresh demo API has it back; `bun run build:demo` succeeds.

## 7. Docs and invariants

- [x] 7.1 Update CLAUDE.md invariant 1 (sixth exception: repository cleanup in `src/server/cleanup.ts`, `worktree remove`/`prune` for any linked worktree, `branch -D` of proven-merged local branches; `cleanup.ts` in the list of modules that write) and README.md (feature list and the "what it writes" list); verify by reading both against the `dashboard-api` delta.

## 8. Verification

- [x] 8.1 Run `bun run check` and `bun run build`; verify both succeed and that `dist/openspec-dashboard` serves a working cleanup preview and apply against a scratch repository with a squash-merged branch.
- [x] 8.2 Run `openspec validate add-cleanup-capabilities --strict` and verify it reports the change as valid.
