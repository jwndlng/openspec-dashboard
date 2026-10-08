# Design

## Context

`pageEvents` in `src/shared/activity.ts` turns the retained log into a page for both the server (`ActivityLog.page`)
and the demo (`demoApi.ts`). It already filters by `repos` and `kinds` into `matching` and, for a first page,
calls `summarize(matching)` (archived change `activity-summary`, D1/D2). It has no notion of the current time or of a
time zone: retention is applied by the callers through `retained(entries, now)`. The feed groups entries under the
browser's local days (`groupByDay` in `activityState.ts`). The summary strip is rendered by `SummaryStrip` in
`src/ui/activity.tsx`; repository colours come from `assignRepoHues` over every repository in the snapshot.

The `activity-summary` design listed "no figure per repository, no chart" as a non-goal; this change lifts exactly
that, under the same counting rules.

## Goals / Non-Goals

**Goals:**

- One counting pass, next to `summarize`, shared by the server and the demo; same filters, same "recorded events, not
  collapsed entries" rule as the strip.
- Days that match the day headings of the feed, including across daylight-saving changes.
- No chart library, no new route, nothing stored on the server.

**Non-Goals:**

- No per-hour view, no comparison with an earlier week, no metrics beyond what the 7-day log holds.
- No breakdown of the bars by kind of event (stacked bars); the kind filter already narrows them.
- Clicking a day bar does not jump to that day in the feed (the day may not be loaded).

## Decisions

### D1. `metrics` is computed in `pageEvents`, beside `summary`

A new pure `measure(events, nowMs, timeZone)` in `src/shared/activity.ts` returns
`ActivityMetrics = { events, changes, days: {day, events, changes}[], repos: {repoId, repoName, events, changes}[] }`.
`pageEvents` calls it on `matching` exactly where it calls `summarize`, so only a page without `before` carries it.
`pageEvents` gains a third parameter `nowMs` (default `Date.now()`) for the day range; `ActivityLog.page` and the demo
pass their own clocks so tests stay deterministic.

*Alternatives.* Folding the metrics into `ActivitySummary` would change the strip's fixed six-key shape that the UI
maps one-to-one onto figures. A separate endpoint means two requests per reload that can see different log states.

### D2. Days are bucketed on the server, in the zone the client names

Bucketing needs the user's calendar days, which only the browser knows. The client sends
`tz = Intl.DateTimeFormat().resolvedOptions().timeZone`; `measure` formats each event's `at` with one cached
`Intl.DateTimeFormat("en-CA", { timeZone, year, month, day })` (which yields `YYYY-MM-DD`) and counts per key. The
day range runs from the key of `nowMs − RETENTION_MS` to the key of `nowMs`, stepping one calendar day at a time
(stepping noon-UTC dates, so a 23- or 25-hour day never skips or repeats a key); usually 8 days, the oldest only partly
inside the window. `api.ts` validates `tz` by constructing that formatter: a `RangeError` becomes `400`. Without `tz`
the zone is `UTC`.

*Alternatives.* Sending raw timestamps (up to 2 000) and bucketing in the browser makes the response grow with the log.
Hourly UTC buckets re-bucketed by the client break for zones with 30- or 45-minute offsets. A numeric UTC offset is
wrong for the part of the week on the other side of a daylight-saving change.

*Compiled binary.* Bun ships full ICU, so named zones work in `dist/spec-control`; the task list verifies it there,
as CLAUDE.md requires for anything that might differ from `bun run`.

### D3. Counting rules

- `events` counts every matching event; `changes` counts distinct `repoId + "\n" + change` over events that have a
  `change`. Repository and session events count as events, never as changes.
- `repos` keeps, per `repoId`, the `repoName` of its newest counted event (the log stores the name at that time; a
  renamed repository shows its latest name), sorted by `events` descending, then `repoName`, then `repoId`.
- Because it runs before `collapseTaskProgress`, a collapsed run counts as its individual events, like the strip.

### D4. UI: two CSS panels inside `.activity`

`Metrics` in `src/ui/activity.tsx` renders below `SummaryStrip`, from the first page's `metrics`, kept across
**Load older** and replaced on every reload, hidden while loading and when no event matches (both already true for the
strip, D6 of `activity-summary`).

- **Per day**: an `<ol>` of days, each a flex column with a bar whose height is `events / max(1, busiest)` of the
  panel's bar area, the count under it and a short weekday label (`Today` for the last one). Each item carries an
  `aria-label` / `title` with the full date, events and changes, so the chart reads as a list without the visuals.
  Labels come from the `day` key parsed as a local date, never from a UTC `Date`, so they match the feed's headings.
- **Per project**: an `<ol>` of rows — swatch and name in the repository's hue (`repo-tint`, neutral `untracked`
  when the id is not in the snapshot), a horizontal bar relative to the busiest, and `N events · M changes`. A tracked
  row is a `<button>` calling `setFilters({ repos: [repoId] })`, the same path as the **Repositories** menu, so URL,
  tags, strip and feed follow. Not shown when `filters.repos.length === 1`.
- Pure helpers in `activityState.ts`: `REPOS_SHOWN = 6` and `visibleRepos(list, expanded)` returning
  `{ shown, hidden }` (the same shape as `collapseDay`), a `barShare(value, max)` clamped to `[0, 1]`, and
  `dayLabel(key, todayKey)`.
- The per-project **Show N more** state is component state, reset with the filters like the busy days.
- Both panels sit side by side above 720 px and stack below it; bars use theme tokens only (`--accent`, the repository
  hue for project bars), so every theme works.

### D5. The hide toggle

A small ghost button at the strip's end, **Hide details** / **Show details**, toggles the panels only. The state is
stored with `storageKey("activity.metrics")` (`"hidden"` or absent) through try/catch helpers like `loadSeen`; a
browser that refuses storage always shows the metrics. The strip itself is never hidden.

### D6. Demo

`demoApi.ts` already answers with `pageEvents`; it passes its `now()` and the query's `tz`. `buildActivity`'s sample
already spans six days and several repositories, including a busy day, so the panels have content; a test checks the
demo's first page has non-empty `metrics.repos` and at least one non-zero day.

## Risks / Trade-offs

- [The 2 000-entry cap can cut deeper than 7 days on a very busy log, leaving the oldest bars short] → The same already
  holds for the strip and the feed; the panel heading says "last 7 days" like the strip, no separate notice.
- [The oldest bar covers only part of its day] → Its title says "partly kept"; dropping it would hide events the feed
  still shows.
- [Per-project counts may be read as the project's state] → Labels say "events" and "changes touched", and the spec
  forbids showing the metrics anywhere but the feed.
- [A time zone the server's ICU does not know] → `400`, and the UI falls back to requesting without `tz` (UTC) rather
  than showing no feed.
