# Tasks

## 1. Defaults

- [x] 1.1 In `src/ui/sessionState.ts`, make `pullOffer(repo)` pre-select whenever it is offered (drop the `work`
  parameter and update its doc comment), and add `removalPreselected(status)` returning `status?.removable === true`;
  verify with `bun test test/workStatusUi.test.ts` after 1.3
- [x] 1.2 In `src/ui/endSessionDialog.tsx`, set the removal checkbox from `removalPreselected(result)` and call
  `pullOffer(repo)`; verify `bun run check` typechecks and the dialog still clears both on a new `endingId`
- [x] 1.3 Update `test/workStatusUi.test.ts`: the pull is pre-selected for every work status when offered and never
  when not offered; removal is pre-selected exactly when `removable` is true (merged, pushed and clean statuses
  included, an unremovable or missing status not); verify the file passes

## 2. Words

- [x] 2.1 In `src/ui/helpContent.tsx`, change the **End session** sentence to say that, when nothing would be lost, the
  dialog removes the worktree and pulls the repository by default, both clearable; verify the help page renders it
- [x] 2.2 Add a What's new entry at the top of `src/ui/changelog.ts` ("End session cleans up and pulls by default");
  verify `bun run check` passes, including the changelog tests

## 3. Verify

- [~] 3.1 Run `bun run check` and, in `bun run dev`, end a session whose worktree is clean and pushed: both checkboxes
  are ticked, and confirming removes the worktree, keeps the branch and pulls
- [~] 3.2 Manually confirm in the dashboard that ending a session with unshipped work shows "Not shipped", no removal,
  and a ticked pull
