# Tasks

## 1. Mergeability in the pull-request query

- [x] 1.1 Add `mergeable?: "mergeable" | "conflicting" | "unknown"` to `PullRequest` in `src/shared/types.ts`, add `mergeable` to `FIELDS` in `src/server/pullRequests.ts` and map it in `parsePullRequest` (missing or unrecognised → `unknown`); verify with new cases in `test/pullRequests.test.ts` for `MERGEABLE`, `CONFLICTING`, `UNKNOWN` and a missing field
- [x] 1.2 Teach `test/fixtures/fake-gh.ts` scenarios to answer `mergeable`, and assert that the `gh pr list` argument list carries `mergeable` in `--json` and no other subcommand is run; verify `bun test test/pullRequests.test.ts test/pullRequestsApi.test.ts` passes
- [x] 1.3 Verify a version-1 cache without `mergeable` still loads and its pull requests read as `unknown` (test in `test/pullRequests.test.ts`)

## 2. Readiness rule

- [x] 2.1 Create `src/shared/pullRequestReadiness.ts` with `pullRequestReadiness(pr)` (ready, or not ready with reason in the order draft → conflicts → checks failing → checks running → mergeability unknown, plus `inProgress`; undefined for merged/closed; defensive against malformed cache entries) and `readinessRole`; verify with `test/pullRequestReadiness.test.ts` covering every scenario of "A linked open pull request has a readiness"

## 3. Refresh by a set of repositories

- [x] 3.1 Accept `repoIds` in `PullRequests.refresh` options and in `POST /api/pull-requests/refresh` (validate each id, 400 for wrong types or `repoId` with `repoIds`, 404 for unknown/disabled); verify in `test/pullRequestsApi.test.ts` that only the listed repositories' GitHub repositories are queried
- [x] 3.2 Extend `refreshPullRequests` in `src/ui/api.ts` (and the demo API) with `repoIds`; verify `bun run check` typechecks

## 4. The watch

- [x] 4.1 Add pure `watchPlan(cards, lists, now, lastSettledAt)` to `src/ui/pullRequestsState.ts` (repositories of cards with an open, not-ready linked pull request, unavailable lists excluded; due 60 s after the last settled refresh when any is in progress, else 5 min; undefined when none); verify in `test/pullRequestsState.test.ts`
- [x] 4.2 Track `lastSettledAt` in `createPrRefresher` and add `watch(repoIds)` (forced refresh of those repositories, joins nothing and starts nothing while a refresh is in flight, no-op when `synthetic`); verify in `test/pullRequestsState.test.ts` including "one refresh at a time" and "demo"
- [x] 4.3 Expose `watch` and `lastSettledAt` through the `usePullRequests` context in `src/ui/pullRequests.tsx`, and add the board's effect in `src/ui/kanban.tsx`: one `setTimeout` to the plan's `dueAt`, cleared on unmount and while `document.visibilityState` is hidden, recomputed on visibility change and on every new answer; verify in `test/pullRequestBoard.test.ts` with a fake clock and visibility that a repository board watches only its own cards and leaving the board stops the watch

## 5. Card and header

- [x] 5.1 Add pure `cardWorkingState(...)` (tinted = live session or open not-ready PR; sweeping = live session or PR in progress) next to `cardIsLive` in `src/ui/sessionState.ts`, and render `.card.live` plus a no-sweep modifier from it in `ChangeCard`; verify in `test/pullRequestBoard.test.ts` that starters, session badge, column and progress are unchanged and that no tint appears with an empty cache or unavailable `gh`
- [x] 5.2 Show readiness on `CardPullRequest` (word, role class, tooltip with what it waits for and the list's fetch time, accessible name) and add the no-sweep modifier and role styles in `src/ui/styles.css` for both themes, honouring `prefers-reduced-motion`; verify in `test/pullRequestsUi.test.ts` that no readiness uses the `info` role and every state reads as text
- [x] 5.3 Show conflicts and readiness in `DetailPullRequest` with the same words, symbols and roles as the card, plus the fetch time; verify in `test/pullRequestsUi.test.ts` with a conflicting and a ready pull request
- [x] 5.4 Add `mergeable` to the demo's synthetic pull requests in `src/ui/demo/` so its cards show readiness without ever being watched; verify `bun run check`

## 6. Docs and invariants

- [x] 6.1 Update `CLAUDE.md` invariants 1 and 4, `README.md`, and the Pull requests and board sections of `src/ui/helpContent.tsx` to describe readiness, the working state and the board's watch as the one timed pull-request query; verify by reading the changed paragraphs against the delta specs
- [x] 6.2 Run `openspec validate monitor-pr --strict` and `bun run check`, and verify both pass
- [x] 6.3 Build `dist/openspec-dashboard` with `bun run build`, open a board against a repository with an open pull request, and verify the card shows its readiness and that a hidden tab starts no `gh` process
