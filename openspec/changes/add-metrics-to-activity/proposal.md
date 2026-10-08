# Proposal

## Why

The Activity view's summary strip says *what kind* of thing happened this week, but not *where* or *when*. To see
which project was busy, or whether today was quieter than Tuesday, the user still has to scroll the feed and count —
and the loaded page holds only the newest 100 entries. A rough overview of the retained log, per day and per project,
answers that at a glance.

## What Changes

- Below the summary strip, the Activity view shows two small **metrics** panels over everything the log keeps:
  - **Per day**: one bar per calendar day of the retention window (the user's local days, today included, quiet days
    shown as empty bars), sized by the number of recorded events that day, each labelled with its count and the number
    of distinct changes touched that day. A heading states the total: *N events · M changes*.
  - **Per project**: the projects with recorded activity, busiest first, each with its colour, its number of events and
    of distinct changes touched, and a bar relative to the busiest one. The first 6 are shown; **Show N more** lists the
    rest. Activating a project filters the feed to it, exactly as choosing it in the **Repositories** menu.
- The metrics count recorded events (not collapsed entries), follow the view's repository and kind filters, cover the
  whole retained log rather than the loaded page, and are refreshed whenever the feed reloads — the same rules as the
  summary strip.
- The metrics can be hidden with one toggle; the choice is remembered in the browser. They are not shown when no event
  matches.
- `GET /api/activity` returns the metrics as `metrics` next to `summary` on the first page, bucketed into days in the
  time zone the client names with a new `tz` parameter (an IANA zone name; UTC when absent).
- The metrics describe the feed only. The log still feeds no board, overview count or action.
- The demo gets the metrics for free (it pages through `pageEvents`) and passes the browser's time zone.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `activity-feed`: a new requirement for the per-day and per-project metrics, how they are counted, the filters they
  follow, the hide toggle and that they never feed anything else. "The log is history, never an input" names the
  metrics alongside the summary strip as the only places that count the log.
- `dashboard-api`: "Activity endpoint" accepts `tz` and returns `metrics` for a request without `before`, computed over
  every retained event that matches `repos` and `kinds`.

## Impact

- `src/shared/types.ts`: `ActivityMetrics` and the optional `ActivityPage.metrics`.
- `src/shared/activity.ts`: `measure(events, nowMs, timeZone)` and `ActivityQuery.tz`; `pageEvents` adds `metrics`
  when the query has no `before`, and takes the current time.
- `src/server/activity/log.ts`: passes its clock to `pageEvents`. `src/server/api.ts`: parses and validates `tz`.
- `src/ui/api.ts`: `activityQueryString` sends `tz`. `src/ui/demo/demoApi.ts`: passes its clock to `pageEvents`.
- `src/ui/activityState.ts`: pure helpers for the per-project list (first 6, the rest) and the bar scale, and the
  remembered hide toggle. `src/ui/activity.tsx`: the metrics panels. `src/ui/styles.css`: their rules, inside the
  `.activity` rules only.
- `src/ui/changelog.ts`: one entry. `README.md`: the Activity line mentions the metrics.
- Tests: `test/activity.test.ts` or `test/activityLog.test.ts`, `test/activityApi.test.ts`,
  `test/activityState.test.ts`, `test/demoApi.test.ts`.
