# Proposal

## Why

The Activity view is one long list. To learn how much happened this week, the user has to scroll and count, and the
loaded page holds only the newest 100 entries. A busy log has the opposite problem: a single day with hundreds of
entries fills the view, so the user cannot scroll past it to earlier days.

## What Changes

- A compact **summary strip** above the feed gives six figures for everything the log keeps (the last 7 days):
  **changes created**, **changes moved**, **changes archived**, **tasks completed**, **agent sessions run** and
  **need attention** (the entries the feed already shows in the danger tone: a scan starting to fail, or a session
  that failed or ended with a non-zero exit code).
- The figures cover the whole retained log, not only the loaded page. They follow the view's repository and kind
  filters. A figure whose kind of event is filtered out is not shown.
- The server computes the figures. `GET /api/activity` returns them as a `summary` next to the first page, and not with
  older pages fetched by **Load older**. The figures describe the feed only. The log still feeds no board or overview
  count.
- A day with many loaded entries shows only its newest ones, followed by **Show N more**, which expands that day. The
  day headings stay sticky while the user scrolls. Paging by 100 entries and **Load older** do not change.
- The demo's sample activity has one day busy enough to collapse, and a non-zero count for every figure.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `activity-feed`: a new requirement for the summary strip, covering its figures, how they are counted, the filters
  they follow, and that they never feed anything else. A new requirement for collapsing busy days. "The log is history,
  never an input" now says that the summary is part of the feed.
- `dashboard-api`: "Activity endpoint" returns `summary` for a request without `before`, computed over every retained
  event that matches `repos` and `kinds`.

## Impact

- `src/shared/activity.ts`: `summarize` over retained, filtered events, and a shared `needsAttention` predicate.
  `pageEvents` adds `summary` when the query has no `before`.
- `src/shared/types.ts`: `ActivitySummary` and the optional `ActivityPage.summary`.
- `src/server/activity/log.ts` and `src/server/api.ts`: served through `pageEvents`. No new route and no new parameter.
- `src/ui/activityState.ts`: `tone()` uses `needsAttention`. Pure helpers decide which figures are shown and how a day
  is collapsed.
- `src/ui/activity.tsx`: the summary strip, and per-day collapse with **Show N more**.
- `src/ui/styles.css`: the strip and the Show more button, in the `.activity` rules only.
- `src/ui/demo/sampleData.ts` (`buildActivity`): a busy day, archived and failing entries. `src/ui/demo/demoApi.ts`
  already pages with `pageEvents` and gets the summary from it.
- `src/ui/changelog.ts`: one entry. `README.md`: the Activity line mentions the summary.
- Tests: `test/activity.test.ts`, `test/activityApi.test.ts`, `test/activityState.test.ts`, and the demo's tests if
  they check the sample activity.
