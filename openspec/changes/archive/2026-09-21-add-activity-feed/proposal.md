## Why

The dashboard shows where every change **is**, but not what **happened**. After a day of work across several repositories and agent sessions — or after a weekend away — the board looks different and there is no way to see what moved: which changes were created, which became ready, which were implemented, synced or archived, which sessions ran and how they ended. The information passes through the dashboard on every scan (it holds the previous snapshot while it builds the next one) and is then thrown away.

## What Changes

- A new top-level navigation entry **Activity** (after *All changes*) opens a feed of what happened, newest first, grouped by day, across all tracked repositories.
- Events are **detected by comparing consecutive snapshots** at the end of each scan, plus session lifecycle events reported by the session manager:
  - change created, change moved between columns (e.g. `Specs → Ready`, `Implementing → Done`, `Done → Synced`), task progress, change archived, change removed;
  - repository tracked / no longer tracked, repository scan failing / recovered;
  - agent session started, ended (with exit code), shipped.
- Events are appended to a log file in the dashboard home, `~/.openspec-dashboard/activity.jsonl` — one JSON object per line, append-only, bounded by periodic compaction. Nothing is written to a tracked repository.
- **No flood on first sight:** a repository that was not in the previous snapshot (first run, newly enabled, cache deleted) yields one "tracked" event, not one event per change. What happened while the dashboard was not running is still detected on the next start, because the previous snapshot is cached; such events are timed by the change's last activity where that is known.
- Task progress is recorded as it is observed but **shown collapsed**: consecutive progress events of one change within an hour appear as one line (`3/12 → 7/12`).
- Each entry shows the repository (name and its colour), the change and what happened; it links to the repository's board. The feed can be filtered by repository and by kind of event, and loads older entries on demand.
- The navigation entry shows a small **unseen count** for events newer than the user's last visit to the feed (remembered in the browser).
- `GET /api/activity` serves the feed (newest first, paged). The demo site's mock API serves a synthetic feed.
- **The "repository is the source of truth" invariant is amended, not broken:** the log records *when the dashboard observed* something; it is history, not state. Deleting the file loses the history and nothing else — the board, the overview and every decision the dashboard makes keep being derived from the repositories alone.

## Capabilities

### New Capabilities

- `activity-feed`: which events exist and how they are detected, the baseline rule, timing of events, the log file (format, location, bounds, tolerance), collapsing of task progress, the Activity view, its filters, links and unseen count.

### Modified Capabilities

- `dashboard-api`: adds the activity endpoint (read-only, paged, filterable).

## Impact

- `src/server/activity/events.ts` (new, pure): `diffSnapshots(previous, next)` → events; `test/activityEvents.test.ts`.
- `src/server/activity/log.ts` (new): append, tolerant read, compaction, in-memory tail; `test/activityLog.test.ts`.
- `src/server/scanner.ts`: after a scan, hand the previous and the new snapshot to the activity log.
- `src/server/sessions/manager.ts`: report session started / ended / shipped.
- `src/server/paths.ts`: `activityLogPath()`. `src/server/api.ts`: `GET /api/activity`. `src/server/index.ts`: wiring.
- `src/shared/types.ts`: `ActivityEvent`, `ActivityPage`.
- `src/ui/activity.tsx` (new), `src/ui/activityState.ts` (new, pure: grouping by day, collapsing, unseen count) + test, `src/ui/routes.ts`, `src/ui/app.tsx` (nav entry with count), `src/ui/api.ts`, `src/ui/styles.css`.
- `src/ui/demo/demoApi.ts`, `src/ui/demo/sampleData.ts`: synthetic feed.
- `CLAUDE.md` invariant 5 and `README.md` (state in the dashboard home, the Activity view).
- No new dependency, no config format change, no change to what is written to repositories.
