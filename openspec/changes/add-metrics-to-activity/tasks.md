# Tasks

## 1. Counting

- [x] 1.1 Add `ActivityMetrics` (`events`, `changes`, `days: { day, events, changes }[]`, `repos: { repoId, repoName, events, changes }[]`) and the optional `ActivityPage.metrics` to `src/shared/types.ts`, and `tz?: string` to `ActivityQuery`; verify `bun run check` typechecks
- [x] 1.2 Add `measure(events, nowMs, timeZone)` to `src/shared/activity.ts` (D2, D3: cached `en-CA` formatter, day range from `nowMs − RETENTION_MS` to `nowMs` stepped by calendar day, distinct changes by repository and name, repos ordered by events, then name, newest name kept); verify with tests in `test/activity.test.ts` for "A week per day" (8 days, empty day included), "Local days" (`Europe/Zurich` vs `UTC`), "Per project" ordering and change counts, "Same name in two projects", and a daylight-saving week producing no skipped or repeated day
- [x] 1.3 Give `pageEvents` a `nowMs` parameter (default `Date.now()`), call `measure(matching, nowMs, query.tz ?? "UTC")` beside `summarize` only when the query has no `before`, and pass the clock from `ActivityLog.page` in `src/server/activity/log.ts` and from `src/ui/demo/demoApi.ts`; verify with tests in `test/activityLog.test.ts` that collapsed task progress still counts as its individual events and a `before` page carries no `metrics`

## 2. Endpoint

- [x] 2.1 Parse `tz` in `getActivity` in `src/server/api.ts`, rejecting a zone `Intl.DateTimeFormat` refuses with `400` and a message; verify with `test/activityApi.test.ts` for the modified scenarios: nothing recorded (`metrics` with zero days and no repos), paging (metrics count 250 on the first page, absent on the second), filtering (`metrics.repos` lists one repository), days in the client's time zone, unknown time zone, older than the retention window and everything aged out
- [x] 2.2 Send `tz` from `activityQueryString` in `src/ui/api.ts` (the browser's resolved zone, omitted when unavailable), retry once without `tz` when the server refuses the zone (design, Risks), and have the demo honour it; verify with a test that the query string carries `tz` and with `bun test test/demoApi.test.ts`

## 3. Metrics panels

- [x] 3.1 Add `REPOS_SHOWN = 6`, `visibleRepos(list, expanded)` returning `{ shown, hidden }`, `barShare(value, max)` and `dayLabel(key, todayKey)` to `src/ui/activityState.ts`, plus `loadMetricsHidden` / `saveMetricsHidden` under `storageKey("activity.metrics")` that tolerate refused storage; verify with tests in `test/activityState.test.ts` (9 repos → 6 shown, 3 hidden; expanded → all; share of 0 busiest → 0; labels for today and earlier days; storage throwing → shown)
- [~] 3.2 Render the per-day and per-project panels below `SummaryStrip` in `src/ui/activity.tsx` from the first page's `metrics` (D4): totals in the per-day heading, accessible labels per bar with date, events and changes ("partly kept" on the oldest), project rows in the repository's hue, neutral and not activatable when untracked, activating a tracked row calls `setFilters({ repos: [id] })`, the per-project panel omitted when one repository is selected, **Show N more** / **Show fewer** reset with the filters; hidden while loading and when nothing matches; verify in `bun run dev` that the panels follow the repository and kind filters and that activating a project updates the URL, tags, strip and feed
- [~] 3.3 Add the **Hide details** / **Show details** toggle at the end of the strip (D5), hiding only the panels and remembered across reloads; verify in `bun run dev` that the choice survives a reload and that the strip and feed are unaffected
- [~] 3.4 Style the panels in `src/ui/styles.css`, inside the `.activity` rules (side by side above 720 px, stacked below, theme tokens only, repository hue for project bars); verify in `bun run dev` in light and dark themes and at phone width with no horizontal scroll

## 4. Demo

- [x] 4.1 Pass the demo's clock and `tz` through `src/ui/demo/demoApi.ts` (D6); verify with a test in `test/demoApi.test.ts` that the demo's first activity page has `metrics` with more than one repository and at least one non-zero day

## 5. Wrap-up

- [x] 5.1 Add a `src/ui/changelog.ts` entry for the per-day and per-project metrics and extend the Activity line in `README.md`; verify the What's new page renders the entry
- [~] 5.2 Run `bun run check` and `bun run build`, then open Activity in `dist/spec-control` and in the demo build with a non-UTC browser zone; verify both succeed, the days match the feed's day headings, and `tz=Europe/Zurich` is accepted by the compiled binary
