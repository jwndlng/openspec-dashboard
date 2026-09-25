# Tasks

## 1. Record that a session can run in place

- [x] 1.1 In `src/shared/types.ts`, make `Session.branch` optional and add `inPlace?: boolean` with a comment saying
      what it means: the repository is not a git repository, so the agent runs in the repository folder, there is no
      worktree and no branch, and nothing git-derived applies. Verify with `bun run typecheck` naming every site that
      assumed a branch.

## 2. Open and restart an in-place session

- [x] 2.1 In `src/server/sessions/manager.ts`, decide in-place from the repository's scan result (`scanned.isGit ===
      false`), not by letting a git command fail. For an in-place session set `worktreePath` to the repository path,
      leave `branch` unset, set `inPlace: true`, and skip `linkedWorktreeOf`, `ensureWorktree` and
      `copyChangeIfMissing` entirely. Verify with a test that opens a session in a non-git temp folder and asserts the
      agent's cwd is that folder and that no `.git` and no worktree directory were created.
- [x] 2.2 Do the same in `prepareRestart`/`resume` so resuming an in-place session does not call `ensureWorktree`.
      Verify with a test that resumes an in-place session in a non-git temp folder.
- [x] 2.3 Refuse a Ship request for an in-place session with a 400 and a reason. Verify with a test.

## 3. Show a refused start where it was started

- [x] 3.1 In `src/ui/sessions.tsx`, clear the provider error at the start of `start` and render it in
      `SessionControls` as a `notice danger` beside the starters. Verify with a UI test that a rejected
      `openSession` leaves the reason visible on the card and that a later successful start clears it.

## 4. Keep the git-only features out of an in-place session

- [x] 4.1 In `src/ui/sessionPanel.tsx`, for an in-place session show the repository folder and the warning that the
      agent edits it directly with no branch, no commit and no undo; show no branch, no work badge and no Ship.
      Verified through the pure helper the panel now uses (`worktreeOfSession`), which is what decides all three; the
      project has no DOM renderer in tests, so the JSX itself is covered by typecheck only.
- [x] 4.2 In `src/ui/sessionState.ts` and `src/ui/endSessionDialog.tsx`, offer neither worktree removal nor a pull for
      an in-place session. Verified with unit tests for `worktreeRemovalPossible` and `pullOffer`; the dialog's JSX
      reads those two helpers and nothing else.

## 5. Say it in the docs

- [x] 5.1 Update the worktree wording in `CLAUDE.md` (agent sessions section) and `README.md` to state the non-git
      exception. Verify by reading them back against the `agent-sessions` delta — they must claim the same thing.

## 6. Check

- [x] 6.1 `bun run check` passes, and `bun run build` produces a binary that opens an in-place session in a non-git
      folder (invariant: anything here must also work in the compiled binary).
