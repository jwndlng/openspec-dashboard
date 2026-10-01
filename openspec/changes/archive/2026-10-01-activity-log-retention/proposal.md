# Proposal

## Why

The activity log (`~/.openspec-dashboard/activity.jsonl`) is bounded only by count: it keeps the newest 2 000 entries and
compacts once the file passes 5 000 lines. On a quiet setup that means months of stale history on disk that the feed
pages, filters, sorts and collapses on every request; on a busy one it is still up to 5 000 lines re-read on start. The
feed is about what happened recently — a week is what users scroll back through — so the log should keep the last
7 days and nothing older, which keeps the file small and the Activity view fast.

## What Changes

- The activity log keeps only events whose time lies within the last **7 days**. Older events are dropped when the log
  is loaded, are never returned by `GET /api/activity` (including `newestId` and the unseen count `newerThanSince`), and
  are removed from `activity.jsonl` by the existing compaction (new file, then rename) — on start, and while running
  at most once an hour when new events are recorded.
- An event that is already older than 7 days when it is detected (a catch-up after a long absence) is not recorded.
- The existing count bound stays as a backstop: never more than the newest 2 000 entries kept, compaction above
  5 000 lines. Within 7 days the count bound can still drop older entries on a very busy setup.
- The Activity view says, at the end of the feed and in its empty state, that activity is kept for 7 days, so a
  missing older entry is not mistaken for a bug.
- The demo site's sample feed obeys the same window, so it never shows events the real dashboard would have dropped.
- Not configurable: 7 days is a fixed constant, like the existing count bounds. No settings, no new endpoint.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `activity-feed`: "The activity log lives in the dashboard home and is bounded" gains the 7-day retention window next
  to the count bound; "Activity view in the top navigation" states the retention in the feed's end and empty state.
- `dashboard-api`: "Activity endpoint" never returns, points at or counts events outside the retention window.

## Impact

- `src/server/activity/log.ts` — retention window on load, append and page; age-driven compaction; injectable clock.
- `src/shared/activity.ts` — the retention constant and a pure "within retention" filter shared with the demo.
- `src/ui/activity.tsx` — retention note at the end of the feed and in the empty state.
- `src/ui/demo/sampleData.ts`, `src/ui/demo/demoApi.ts` — sample feed within the window.
- `test/activityLog.test.ts`, `test/activityApi.test.ts` — retention tests; existing tests pin the clock to their
  fixed timestamps.
- `openspec/specs/activity-feed/spec.md`, `openspec/specs/dashboard-api/spec.md` — via the delta specs.
- No change to what is written outside the dashboard home, to tracked repositories, to scanning or to the network
  (invariants 1, 4 and 5 hold: the log stays history only; deleting it still loses history only).
