# Tasks

## 1. Shared groundwork

- [x] 1.1 Add `DismissPreview` (`repoId`, `name`, `isGit`, `files: { path, state: "restorable" | "lost" }[]`, `copies: { path, branch? }[]`, `fingerprint`) and `DismissResult` (`name`, `staged`) to `src/shared/types.ts` (design D3); verify with `bun run typecheck`.
- [x] 1.2 Add a per-change dismissal lock (`isDismissing(repoId, change)`) and make `SessionManager.open` (and resume) refuse with `409` for a change being dismissed, plus a read-only `hasOpenSession(repoId, change)` using `OPEN_SESSION_STATES` (design D4); verify with a test using the fake agent that a start during a dismissal is refused and `hasOpenSession` is true for a running session.

## 2. Preview (read-only)

- [x] 2.1 Create `src/server/dismissChange.ts` with `previewDismiss`: name validation (`CHANGE_NAME`, not `archive`), `lstat` + `realpath` containment check, `lstat` walk without following links, one `statusPaths` call for git repos (decided by the scan's `isGit`), restorable/lost per file, copies from the snapshot's checkouts, SHA-256 fingerprint (design D2, D3); verify with tests in a new `test/dismissChange.test.ts` against temp repos: committed files restorable, modified and untracked files lost, non-git folder all lost, symlinked change directory refused, archived-only and worktree-only changes refused with their reasons.
- [x] 2.2 Prove the preview writes nothing: a test snapshots the working tree, `.git/index` (with stale stat info) and `.git/refs`/`packed-refs` before and after `previewDismiss` and asserts they are byte-identical.

## 3. Dismissing

- [x] 3.1 Implement `dismissChange` in the order lock → open-session check → recompute fingerprint → compare → `rm` → `git add --all -- openspec/changes/<name>/` (own runner, `GIT_OPTIONAL_LOCKS=0`, no shell, no stdin, timeout), returning `{ name, staged }` (design D2, D4); verify with tests: committed change deleted and its removal staged with no new commit, untracked-only change deleted with `staged: false`, non-git folder deleted with no git run, file added after preview → refused and unchanged, open session → refused, concurrent second call → refused.
- [x] 3.2 Prove the boundaries: a test with unrelated modified and untracked files, a symlink inside the change pointing outside the repository and a linked worktree holding a copy asserts that only the change directory is gone, only its paths are staged, the symlink target and the worktree's files, index and branch are unchanged, and no ref or commit changed.

## 4. API

- [x] 4.1 Add `GET` and `POST /api/repos/<id>/changes/<name>/dismiss` to `src/server/api.ts` (design D5): eligibility as create-change (unknown → 404, disabled/failed scan → 409), name `400` before any file system access, no active directory → 404 with the worktree's branch in the reason, body/fingerprint `400`, stale/session/busy `409`, rescan after success, independent of the agent-sessions setting; verify with a new `test/dismissChangeApi.test.ts` covering each status code and a preview → dismiss round trip with sessions disabled.
- [x] 4.2 Verify the same-origin guard covers the new `POST`: a test posting with a foreign `Origin` gets `403` and the directory is unchanged.

## 5. UI

- [x] 5.1 Add `dismissPreview(repoId, name)` and `dismissChange(repoId, name, fingerprint)` to the `Api` interface and HTTP implementation in `src/ui/api.ts`; verify `bun run typecheck` fails until the demo implements them (task 6.1).
- [x] 5.2 Build `src/ui/dismissChange.tsx`: the confirmation dialog with change and repository names, the file list marked restorable / lost for good, the loss warning, kept worktree copies, the staged/not-committed note, Cancel focused, **Dismiss change** disabled while loading or dismissing, refusal reason with **Show current state**; verify with a vnode test (as in `test/cleanupUi.test.ts`) for the warning, the copies note and the refusal state.
- [ ] 5.3 Add **Dismiss change** to `DetailHeader` in `src/ui/changeDetail.tsx` (eligibility from the snapshot, disabled with a tooltip for worktree-only changes, hidden for archived/gone changes), keep the overlay's `Escape` for the open confirmation, close to the board after success unless the change is still in the snapshot, and show the dismissed/staged notice; add styles to `src/ui/styles.css`; verify with a test of the eligibility helper and in `bun run dev` against a scratch repository that cancelling changes nothing and confirming removes the card.

## 6. Demo

- [x] 6.1 Implement `dismissPreview`/`dismissChange` in memory for the demo (`src/ui/demo/demoApi.ts`, or a `demoDismiss.ts` beside `demoCleanup.ts`), with one `Drafts` sample change showing an untracked file; verify with a test in `test/demoApi.test.ts` that dismissing removes the change from the snapshot and a fresh demo API has it back; `bun run build:demo` succeeds.

## 7. Docs and invariants

- [x] 7.1 Update CLAUDE.md invariant 1 (seventh exception: change dismissal in `src/server/dismissChange.ts`, deleting `openspec/changes/<name>/` from the main checkout and one `git add --all` of it; `dismissChange.ts` in the list of modules that write; the dismissal `add` among the index-writing git calls) and README.md (feature list and the "what it writes" list); verify by reading both against the `dashboard-api` delta.

## 8. Verification

- [ ] 8.1 Run `bun run check` and `bun run build`; verify both succeed and that `dist/openspec-dashboard` (the product build, not only the demo) shows **Dismiss change** in a detail view and dismisses a change in a scratch repository, leaving its removal staged.
- [x] 8.2 Run `openspec validate dismiss-task --strict` and verify it reports the change as valid.
