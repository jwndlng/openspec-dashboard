# Tasks

## 1. Metrics data

- [x] 1.1 Extend `ActivityDayCount` with `groups`, `figures` and `hours`, and `ActivityRepoCount` with `groups`, in `src/shared/types.ts`; verify `bun run typecheck` passes
- [x] 1.2 Compute them in `measure` (`src/shared/activity.ts`), hours from the same time-zone formatter as days; verify with new cases in `test/activityLog.test.ts` (day breakdown, local hour in `Europe/Zurich`, empty window all zero, per-repository groups)
- [x] 1.3 Cover the endpoint's new fields in `test/activityApi.test.ts` (breakdown of a day, filtering leaves only `groups.sessions`); verify the test passes

## 2. Chart helpers

- [x] 2.1 Add pure helpers to `src/ui/activityState.ts`: nice axis ticks, heat bins, busiest hour, groups shown for a filter, the Chart/Table choice in browser storage; verify with cases in `test/activityState.test.ts`

## 3. Views

- [x] 3.1 Add chart colour tokens for both themes and the chart, tile, heatmap and table styles in `src/ui/styles.css`, with a phone-width layout; verify `bun run lint` passes
- [x] 3.2 Build `src/ui/activityCharts.tsx`: summary tiles with trend, stacked per-day columns with axis, legend and tooltip, the **When** heatmap, stacked per-project bars, and their table views; verify `bun run typecheck` passes
- [x] 3.3 Wire them into `src/ui/activity.tsx` (tiles replace the strip, Chart/Table switch next to Hide details, filters and hiding as before); verify `bun run check` passes
- [~] 3.4 Look at the Activity view in the dark and the light theme and at phone width (`bun run build:demo`, or `bun run dev`): tiles, stacked columns, heatmap, per-project bars, tooltips on hover and focus, table view, nothing scrolling sideways — needs the user's eye

## 4. Release

- [x] 4.1 Add a What's new entry at the top of `src/ui/changelog.ts`; verify `test/whatsNew.test.ts` passes
- [x] 4.2 Run `bun run check` and `bun run build`; verify both succeed
