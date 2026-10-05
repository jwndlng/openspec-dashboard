# Proposal

## Why

Once an agent has shipped a change, its card shows `PR #<n> open` and nothing more, so the user keeps clicking through
to GitHub to see whether the checks have finished and whether the branch still merges. The dashboard already reads each
pull request's checks summary; it does not read whether the pull request conflicts with its base, does not combine the
two into "ready", and only refreshes when a view is opened with a list older than five minutes. A card should instead
stay in its working state until its pull request is actually ready — every check green and no merge conflict — and the
board should keep watching that pull request on its own while it is open.

## What Changes

- The pull-request query additionally reads GitHub's `mergeable` field (still only `gh pr list --json …`), so each
  cached pull request carries whether it merges cleanly, conflicts, or GitHub has not computed it yet.
- A new shared, pure rule derives a linked **open** pull request's **readiness**: `ready` when its checks pass (or it
  has none) and it is mergeable; otherwise *not ready* with one reason, in this order — `draft`, `conflicts`,
  `checks failing`, `checks running`, `mergeability unknown`. Merged and closed pull requests have no readiness.
- A card whose linked pull request is open and not ready keeps its **working state** — tinted like a card with an agent
  at work — and its pull-request badge says why (for example `PR #125 · checks running`, `PR #125 · conflicts`); its
  name sweeps only while something is still in progress (checks running, mergeability unknown). When the pull request
  becomes ready the tint ends and the badge reads `PR #125 · ready`. The detail header shows the same readiness.
- **Pull-request watch**: while a Kanban board is open and visible and at least one of its cards links an open
  pull request that is not ready, the board re-queries exactly those cards' repositories on its own — every minute
  while a check is running or mergeability is unknown, every five minutes while it only waits on a draft, a failing
  check or a conflict — and stops when none is left, the board is left or the tab is hidden. This relaxes the
  "never on a timer" rule of the pull-request query to this one bounded case; scans, the projects overview and the
  Pull requests view still never start `gh` on their own, and the demo never watches.
- The refresh endpoint accepts a list of repository ids, so the watch refreshes only the repositories it watches.
- Readiness and the watch remain display-only: they never change a change's column, sub-state, progress, counts,
  filters, starters or the activity log, and nothing on GitHub is changed.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `pull-requests`: the query also reads mergeability; a new readiness rule; the board's pull-request watch as the one
  timed exception to "GitHub is contacted only when the user asks"; the link may now drive the card's working state.
- `kanban-board`: a card with an open, not-ready pull request keeps its working state and its pull-request badge
  states the readiness; the board runs the pull-request watch.
- `change-detail`: the detail header shows the pull request's readiness.

## Impact

- `src/server/pullRequests.ts` (`mergeable` field, parsing, cache compatibility), `src/server/api.ts`
  (`repoIds` on `POST /api/pull-requests/refresh`).
- `src/shared/types.ts` (`PullRequest.mergeable`), new `src/shared/pullRequestReadiness.ts`.
- `src/ui/pullRequestsState.ts` (watch schedule), `src/ui/pullRequests.tsx` (card and header badges, watch wiring),
  `src/ui/kanban.tsx` (card working state, watch on the board), `src/ui/api.ts`, `src/ui/styles.css`,
  `src/ui/helpContent.tsx`.
- Tests: `test/pullRequests.test.ts`, `test/pullRequestsApi.test.ts`, `test/pullRequestsState.test.ts`,
  `test/pullRequestBoard.test.ts`, `test/pullRequestsUi.test.ts`, a new `test/pullRequestReadiness.test.ts`, and the
  fake `gh` scenario fixtures.
- `CLAUDE.md` invariants 1 and 4 and `README.md`: the pull-request query may now also run from the board's watch.
- No new dependency, no new `gh` subcommand, no write to any repository or to GitHub.
