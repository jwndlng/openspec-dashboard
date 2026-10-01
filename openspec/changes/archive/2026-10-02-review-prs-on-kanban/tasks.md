# Tasks

## 1. Shared session branch names

- [x] 1.1 Add `src/shared/sessionBranch.ts` exporting `sessionBranch(action, change)` (`chore/archive-<name>` for `archive`, else `feat/<name>`); make `src/server/sessions/manager.ts` use it (keeping its export so `test/agents.test.ts` still imports it) and drop the private copy in `src/ui/demo/demoSessions.ts`; verify `bun test test/agents.test.ts test/demoData.test.ts` passes

## 2. Linking rule

- [x] 2.1 In `src/shared/pullRequestLink.ts`, add `candidateBranches(change)` — unique, non-empty `branchMatch`, `feat/<name>`, `chore/archive-<name>` — and match `pr.head` against that set exactly in `linkedPullRequest`, widening its `Pick` to `repoId | name | branchMatch | created`; verify with new cases in `test/pullRequestLink.test.ts`: worktree removed (no `branchMatch`, merged PR on `feat/<name>` is linked), containment still rejected (`add-validate` vs `feat/add-validate-phase` and `chore/archive-add-validate-phase`), off-convention branch still rejected, other repository still rejected
- [x] 2.2 Skip a merged or closed pull request whose `mergedAt`/`closedAt` is more than one day before `change.created` (open pull requests and changes without `created` unaffected); verify with test cases for a reused name (merged 10 September, created 20 September → no link), a same-day merge (linked) and an open PR on a reused name (linked)
- [x] 2.3 Verify ranking across candidates in `test/pullRequestLink.test.ts`: an open `chore/archive-<name>` PR wins over a merged `feat/<name>` PR, and when both are merged the later one wins

## 3. Board and detail header

- [x] 3.1 In `src/ui/kanban.tsx`, let `boardCards` link archived changes too (remove the `c.archived` exclusion and update the `Card.pullRequest` doc comment); update `test/pullRequestBoard.test.ts` so the archived case expects the archive PR to be linked, and add a case that a merged PR on an archived card renders as merged — verify the file passes
- [x] 3.2 Widen `detailPullRequest` in `src/ui/pullRequests.tsx` to the fields `linkedPullRequest` now needs and check `src/ui/changeDetail.tsx` passes them; verify `bun test test/changeDetail.test.ts` passes and an archived change's detail header shows its PR
- [x] 3.3 Confirm **Hide merged** and column counts are unchanged by the link: add or extend a `test/boardFilters.test.ts` case where an archived card with a linked merged PR is still hidden/shown purely by `archivePending`; verify it passes

## 4. Verification

- [x] 4.1 Run `bun run check` (lint, typecheck, all tests) and verify it passes
- [x] 4.2 Run `bun run dev`, open the combined board with the pull-request cache present, and verify an archived change whose `feat/<name>` or `chore/archive-<name>` PR is cached shows `PR #<n>` on its card and in its detail header, and that a change without such a PR shows nothing
