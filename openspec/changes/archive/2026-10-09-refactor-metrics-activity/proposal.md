# Proposal

## Why

The Activity view's metrics read like a report rather than a dashboard: six numbers on a line, a row of plain grey
columns and a list of grey bars. They answer how many, but not what kind of work happened, when in the day it
happened, or which way a figure is heading, and every answer has to be read off a label. Users asked for real
visualisations with charts and graphs instead of lists.

## What Changes

- The summary strip becomes a **row of stat tiles**: each of the six figures keeps its value and label and gains a
  small per-day trend (a sparkline of that figure over the retained days, today's mark accented). *need attention*
  stays in the danger tone, now with its label, never by colour alone.
- **Per day** becomes a **stacked column chart**: each day's events split by kind of event (*Changes*, *Tasks*,
  *Sessions*, *Repositories*) in fixed colours, with a legend, a light value axis, each column's total on its cap and
  a tooltip on hover and keyboard focus with the per-kind counts and the changes touched.
- New **When** panel: a **heatmap of the retained days by hour of the day** in the user's time zone, shaded in one hue
  from few to many events, with a tooltip per cell — when the work happened.
- **Per project** becomes **stacked horizontal bars**, split by kind of event in the same colours, keeping the
  repository's colour on its swatch, the counts, filtering by activation and **Show N more**.
- Every chart has a **Table** view with the same numbers, so no value is reachable only by hover or by colour.
- `GET /api/activity` `metrics` gains the breakdowns the charts need: per day the counts per kind group, the six
  figures and the events per hour; per repository the counts per kind group. Existing fields are unchanged.
- No new dependency: the charts are drawn with inline SVG and CSS in the single-file UI, in both themes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `activity-feed`: the summary strip becomes stat tiles with a per-day trend; the per-day and per-project metrics
  become stacked charts by kind of event with a table view; a new hour-of-day panel; the log is still counted only by
  the feed.
- `dashboard-api`: the Activity endpoint's `metrics` carries per-day group counts, per-day figures, per-day hourly
  counts and per-repository group counts.

## Impact

- `src/shared/types.ts`, `src/shared/activity.ts` — metrics shape and `measure`.
- `src/ui/activity.tsx`, `src/ui/activityState.ts`, new `src/ui/activityCharts.tsx`, `src/ui/styles.css` — the views.
- `src/ui/changelog.ts` — What's new entry.
- `test/activityLog.test.ts`, `test/activityState.test.ts`, `test/activityApi.test.ts` — tests.
- The demo (`src/ui/demo/demoApi.ts`) uses the shared `pageEvents`, so it gets the new fields without changes.
- No change to what the dashboard reads, writes or contacts; the log stays history only.
