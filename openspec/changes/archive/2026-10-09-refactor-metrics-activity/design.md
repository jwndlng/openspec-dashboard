# Design

## Context

`pageEvents` (`src/shared/activity.ts`) computes `summary` and `metrics` on the server over every retained event that
matches the filters, and the UI only draws them; the demo calls the same function. `metrics.days` holds per-day
totals in the client's time zone, `metrics.repos` per-repository totals. The UI has no charting library and must
stay one self-contained HTML file (invariant 4), in a dark and a light theme.

## Goals / Non-Goals

**Goals:**
- Charts that show *what kind* of work, *when* and the *trend*, from the same counts the view already trusts.
- Every number reachable without hover and without telling colours apart.

**Non-Goals:**
- No new time ranges or longer history: the log keeps 7 days and the charts cover that.
- No change to the feed below the charts, its paging, collapsing or filters.
- No charting dependency.

## Decisions

**D1. The server computes every breakdown; the UI only draws.** `measure` adds, per day, `groups` (events per kind
group), `figures` (the six summary figures, by the same `summarize`) and `hours` (24 counts by local hour in `tz`),
and per repository `groups`. Alternative: derive them in the browser from loaded events — rejected, the loaded page
is at most a few hundred entries and the figures must cover everything retained (as they already do). Hours come
from the same `Intl.DateTimeFormat` as the day, extended with `hour` (`h23`), so day and hour always agree; on a
daylight-saving day an hour slot can hold two clock hours or none, which is acceptable for a glance.

**D2. Hand-drawn SVG/CSS, one module.** `src/ui/activityCharts.tsx` holds the tiles, the stacked column chart, the
heatmap, the stacked bars and the table views as small Preact components; geometry helpers (nice axis ticks, shares,
heat bins) are pure functions in `activityState.ts` and unit-tested. Alternative: a chart library — rejected,
size and a dependency for four simple forms.

**D3. Colour by job.** Kind groups are identity → a fixed categorical order (*Changes* blue, *Tasks* orange,
*Sessions* aqua, *Repositories* yellow), defined as CSS tokens with their own light and dark values, validated with the
dataviz palette check (all pass; on the light surface three hues are below 3:1 against the panel, so legends and the
table view are mandatory — they are). A filter removes series but never repaints the survivors. The heatmap is
magnitude → one blue ramp of four steps, light→dark on light and dark→light on dark, both validated; an empty hour is
the panel's raised surface. Repositories keep their own hue on the swatch only; text stays in text colours.
*need attention* uses the existing danger token with its label.

**D4. Marks.** Columns and bars at most 24px thick with a 2px surface gap between stacked segments and rounded data
ends; hairline solid gridlines; the axis rounds to clean ticks (1, 2, 5 × 10ⁿ); totals on column caps only;
sparklines are 8 thin columns, today accented. Heat cells are binned by share of the busiest hour (≤¼, ≤½, ≤¾, more).

**D5. Interaction.** Each column, bar and heat cell has a hover tooltip; columns and project rows are focusable and
show the same on focus. Heat cells are not tab stops (192 of them); the panel's table view carries their numbers.
One **Chart / Table** switch for the whole metrics area, remembered in the browser like the hide control.

**D6. Layout.** Tiles in an auto-fitting grid (two per row at phone width). Panels in a two-column grid on wide
screens (Per day | When, then Per project across), one column below 720px; the heatmap's 24 columns shrink to fit,
with hour labels every 6 hours, so nothing scrolls sideways.

## Risks / Trade-offs

- [Response grows] 8 days × (4 + 6 + 24) numbers plus 4 per repository — well under a kilobyte more; acceptable.
- [Light-theme contrast of yellow/aqua/orange] → legend with swatches, totals in text colour, table view.
- [Visual regressions are not unit-testable] → the tiles, charts and phone-width layout are checked by the user in
  both themes (left as `[~]` tasks).
