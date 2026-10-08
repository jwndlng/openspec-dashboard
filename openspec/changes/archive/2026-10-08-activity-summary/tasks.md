# Tasks

## 1. Counting

- [x] 1.1 Add `ActivitySummary` (`created`, `moved`, `archived`, `tasksCompleted`, `sessions`, `attention`) and the optional `ActivityPage.summary` to `src/shared/types.ts`; verify `bun run check` typechecks
- [x] 1.2 Move the danger predicate into `needsAttention(event)` in `src/shared/activity.ts` and make `tone()` in `src/ui/activityState.ts` use it; verify the existing tone tests in `test/activityState.test.ts` pass unchanged
- [x] 1.3 Add `summarize(events)` to `src/shared/activity.ts` (D2: recorded events, `max(0, to.done − from.done)` per `tasks-progress`, moves add no tasks) and call it on `matching` in `pageEvents` only when the query has no `before` (D1); verify with tests in `test/activityLog.test.ts` for the "A week in figures" and "Collapsing does not change the figures" scenarios, and that a `before` page has no `summary`

## 2. Endpoint

- [x] 2.1 Extend `test/activityApi.test.ts` for the modified Activity endpoint scenarios: nothing recorded returns all-zero `summary`, paging with 250 events (summary counts 250 on the first page, absent on the second), filtering counts only matching events, aged-out events are not counted; verify `bun test test/activityApi.test.ts` passes without changes to `src/server/api.ts` beyond what the types require

## 3. Summary strip

- [x] 3.1 Add the figure map and `visibleFigures(groups)` to `src/ui/activityState.ts` (D4): labels, the kinds each figure is made of, hidden when the kind filter excludes all of them; verify with tests in `test/activityState.test.ts` (no filter → six figures; *Sessions* → sessions run and need attention only; *Tasks* → tasks completed only)
- [x] 3.2 Render the strip in `src/ui/activity.tsx` above the first day from the first page's `summary`, kept across **Load older** and replaced on every reload; hide it while loading and when no event matches; label it as the last 7 days; verify in `bun run dev` that the figures change with the repository and kind filters
- [x] 3.3 Style `.activity-summary` in `src/ui/styles.css` (D6: compact figures, attention in `--danger` when non-zero, wraps on a narrow window); verify in `bun run dev` in light and dark themes and at phone width with no horizontal scroll

## 4. Busy days

- [x] 4.1 Add `DAY_COLLAPSE_ABOVE = 30`, `DAY_SHOWN = 20` and `collapseDay(day, expanded)` returning `{ shown, hidden }` to `src/ui/activityState.ts`; verify with tests for 140, 31 and 30 entries and for an expanded day
- [x] 4.2 Keep `expanded: Set<dayKey>` in `Activity`, cleared on a filter change (together with `wanted.current`) and kept across reloads and **Load older**; render **Show N more** / **Show fewer** after the day's `<ol>` inside its `<section>`; verify in `bun run dev` that the day headings stay sticky while scrolling a collapsed and an expanded busy day, and that expanding survives a rescan

## 5. Demo

- [x] 5.1 Extend `buildActivity` in `src/ui/demo/sampleData.ts` (D7): a burst day 2 days ago with more than 30 entries (sessions started, resumed and ended on the sample changes already `Implementing` by then; no extra task ticks, see D7), one `session-ended` with exit code 1, and one `repo-failing` followed by `repo-recovered`; verify with a test in `test/demoData.test.ts` (or `test/demoApi.test.ts`) that the demo's first activity page has a non-zero value for every summary figure and a day with more than 30 entries

## 6. Wrap-up

- [x] 6.1 Add a `src/ui/changelog.ts` entry for the summary strip and collapsed busy days, and extend the Activity line in `README.md`; verify the What's new page renders the entry
- [x] 6.2 Run `bun run check` and `bun run build`, and open Activity in the built binary and in the demo build; verify both succeed and the strip and **Show N more** appear as in the dev build
