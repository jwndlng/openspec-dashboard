## 1. Worktree list and types

- [x] 1.1 In `src/shared/types.ts`, make `Worktree.branch` optional and add optional `detached`, `prunable` and `isMain`; add to `ChangeSnapshot` optional `checkout: { path: string; branch?: string; isMain: boolean }` and `otherCheckouts: { path: string; branch?: string; isMain: boolean; column: string }[]` (doc comments: absent in snapshots cached by older versions)
- [x] 1.2 Extend `parseWorktrees` in `src/server/git.ts`: keep detached records (no branch), mark the first record `isMain`, read `prunable` and `bare`; update its unit test with detached, prunable, locked and bare records
- [x] 1.3 Fix every consumer of `Worktree.branch` for the optional type: `findBranchMatch` in the scanner, the repository header tooltip in `src/ui/kanban.tsx` (show `detached`), session code, demo sample data

## 2. Scanning every checkout

- [x] 2.1 Add `forCheckout(path: string): RepoSource` to the `RepoSource` interface and `LocalRepoSource`; add `listActiveChanges()` (or an option on `listChanges`) that lists only `openspec/changes/*` without `archive/`, with the same `CHANGE_NAME` validation and warnings
- [x] 2.2 Refactor `scanChange` to take a checkout context (`source`, `root` path, `branch`, `isMain`, `dirty`, `projectSchema`) instead of assuming the repository path: pass `root` to `readChangeArtifacts`, use the checkout's source for reads, `lastActivity`, `newestDirty` and `changeSpecsSynced`
- [x] 2.3 In `scanRepo`, after the main checkout, select eligible worktrees (not `isMain`, not prunable, not bare, has `openspec/changes`), order them by the mtime of that directory (newest first), cap at 12, and scan them with concurrency 3; each worktree scan is wrapped so that an error or timeout becomes a repository warning (`worktree <branch or path>: <reason>`) and a skipped-by-cap count becomes one warning
- [x] 2.4 Record each scanned copy's checkout (`path`, `branch`, `isMain`) alongside its `ChangeSnapshot` for the merge step

## 3. Merging copies

- [x] 3.1 Add a pure `leadingCopy(copies)` in `src/shared/columns.ts` (or a sibling module): stage rank (`new` < `artifact` < `ready` < `implementing` < `done` < `synced`), done artifacts, done tasks, latest `lastActivityAt` (compared as instants), main checkout first, then path
- [x] 3.2 Add a pure `mergeChanges(mainActive, mainArchived, worktreeCopies)`: group active copies by name, drop worktree copies whose name is archived on main unless the copy's `created` is later than the archive date (no `created` → stale), pick the leading copy, set `checkout`, `otherCheckouts` (with each copy's column) and `branchMatch` (the leading copy's branch when it is a linked worktree, else the existing name-based guess)
- [x] 3.3 Use `mergeChanges` in `scanRepo`; set the repository's `lastUpdatedAt` to the latest of its current value and every merged change's `lastActivityAt`
- [x] 3.4 Unit tests for `leadingCopy` (each tie-breaker in turn, identical copies → main, determinism under input order) and `mergeChanges` (worktree-only, further along in a worktree, stale copy behind main, archived-on-main drops the copy, name reused after archive, copy without `created`, `otherCheckouts` content, `branchMatch` rule)

## 4. Scanner integration tests (temporary repository with real linked worktrees)

- [x] 4.1 Test helper that creates a git repository with commits and linked worktrees, including one outside the repository directory and one detached
- [x] 4.2 Change that exists only, uncommitted, in a worktree → reported with that worktree's progress, `checkout.isMain: false`, `branchMatch` = the worktree branch even when the name does not contain the change name
- [x] 4.3 Change at `Proposal` on main and `Implementing` in a worktree → one change, `Implementing`, main listed in `otherCheckouts` as `Proposal`; the reverse (stale worktree copy) → reported from main
- [x] 4.4 Archived on main + old active copy in a worktree → only archived; with a later `created` date → both
- [x] 4.5 Uncommitted edit to `tasks.md` in a worktree → the change's `lastActivityAt` and the repository's `lastUpdatedAt` equal that mtime; a clean worktree copy reports the commit date, not a checkout mtime
- [x] 4.6 Complete change whose deltas are merged into the worktree's specs but not main's → `specsSynced: true` and column `Synced`
- [x] 4.7 Worktree whose directory was deleted (prunable) → skipped, `ok: true`; a checkout source that throws → repository warning naming it, other checkouts unaffected; 15 worktrees → 12 read and a warning about 3
- [x] 4.8 Archive directory inside a worktree is ignored; a non-git repository scans exactly as before; discovery still does not offer linked worktrees
- [x] 4.9 Extend the no-side-effects test: fingerprint the main checkout, every linked worktree and the shared `.git` directory (including each worktree's own index under `.git/worktrees/*/index`) before and after a scan and assert nothing changed

## 5. Agent sessions

- [x] 5.1 In `src/server/sessions/manager.ts`, take the copy source for `copyChangeIfMissing` from the scanned change's `checkout.path` (fall back to the repository path)
- [x] 5.2 In `src/server/sessions/worktree.ts`, add a lookup of linked worktrees that have a given branch checked out (from `git worktree list --porcelain`); for Draft and Implement, when `feat/<change>` is checked out in a linked worktree other than the session's own, adopt it: use its path as the session's worktree, skip creation, never adopt the main checkout
- [x] 5.3 Persist `adopted: true` on the session record (`store.ts`, tolerant of older records), expose it in the API type, and make `close`/clean-up never offer or perform removal of an adopted worktree
- [x] 5.4 Session panel: show "adopted worktree — created outside the dashboard, will not be removed" next to the path
- [x] 5.5 Tests: copy from a worktree-only change into a new session worktree; adoption when the branch is already checked out (no `git worktree add`, record marked, clean-up not offered even when clean); Archive sessions unchanged; main checkout never adopted

## 6. UI and demo

- [x] 6.1 `applyCommand` takes the checkout path: `card.checkout?.path ?? repoPath`; unit test for both cases including a path that needs shell quoting
- [x] 6.2 Branch badge tooltip: `lives in worktree <path>` when `checkout` is a linked worktree, plus one line per entry of `otherCheckouts` (`also in: <branch | main checkout | detached> — <column>`); pure formatter with a unit test
- [x] 6.3 Demo sample data: a change that exists only in a worktree and one at `Proposal` on main and `Implementing` in a worktree; extend the demo data test to assert the merged result and that the demo bundle still contains no server code

## 7. Verification and docs

- [x] 7.1 `bun run check`
- [x] 7.2 Build the binary and run it against a throwaway dashboard home with a temporary repository that has worktrees in all the states of section 4; confirm the board, the badge tooltip and the copied apply command in a browser
- [x] 7.3 Measure scan duration before and after on a repository with at least nine worktrees (this one, read-only); record the numbers in the pull request; reconsider the cap or concurrency if a scan grows by more than a second — measured on a repository with 8 worktrees: 547 ms → 787 ms median (+240 ms), 4 → 8 active changes on the board, no warnings
- [x] 7.4 Update `README.md` (changes are read from every checkout; one card per change and how the leading copy is chosen; archived on main wins; sessions adopt an existing worktree) and the `change-scanner` spec Purpose at archive time
- [x] 7.5 Before merging, check whether `overview-tiles-and-worktree-status` has landed and reconcile `parseWorktrees` / `Worktree` so there is one definition — checked: it has not landed (proposal and design only, unmerged), so this change's definition stands and that change rebases on it. Also rebased this change's "Worktree clean-up is offered only when safe" delta on the wording of `session-work-status`, whose code is merged but whose archive is still pending.
