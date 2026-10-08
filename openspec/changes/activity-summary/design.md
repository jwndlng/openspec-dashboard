# Design

## Context

`pageEvents` in `src/shared/activity.ts` is the one function that turns the retained log into a page. The server
(`ActivityLog.page`) and the demo (`demoApi.ts`) both call it, so the two answer `GET /api/activity` the same way.
It filters by `repos` and `kinds` before collapsing task progress and slicing the page, so it already holds every
matching event. The danger tone, which "need attention" counts, is decided by `tone()` in `src/ui/activityState.ts`,
on the client only. The view renders each day as a `<section>` with a sticky `<h2>` and one `<ol>` inside
`.activity`, the scroll container.

## Goals / Non-Goals

**Goals:**

- One counting rule for the server and the demo, with no second pass over the log.
- "Needs attention" can never drift from what the feed colours red.

**Non-Goals:**

- No figure per repository, no chart, no comparison with an earlier week. The summary covers only the window the log
  keeps.
- No virtualised list. Paging plus per-day collapse bounds what is rendered.
- No new endpoint, query parameter or stored state.

## Decisions

### D1. The summary is computed in `pageEvents`, only for the first page

`pageEvents` already computes `matching`, the retained events that pass the filters, before it collapses and slices
them. A `summarize(matching)` call there costs one extra loop over at most 2 000 entries. A request without `before` gets
`summary`; a request with `before` (**Load older**) does not, because the figures do not depend on the page and the
client keeps the ones from the first page. The demo calls `pageEvents` too, so it gets the summary without further work.

*Alternatives.* A separate `GET /api/activity/summary` means two requests per reload that can see different log states,
and a second set of filter parsing. Counting on the client from the loaded page is exactly what the request rules out.

### D2. Counting on recorded events, not on feed entries

`summarize` runs on `matching` before `collapseTaskProgress`, so a collapsed run counts as its individual events.
**tasks completed** is the sum of `max(0, to.done − from.done)` over `tasks-progress` events. Unticking a box or a
smaller total does not subtract, which keeps the figure a count of work done rather than a net balance. A `change-moved`
event carries only the resulting tasks, not the previous ones, so it adds nothing. The figure can therefore fall short
when a change moved and progressed in the same scan. That is an accepted gap: inferring the earlier count from older
events would make the figure depend on what the log still holds.

### D3. `needsAttention` moves to `src/shared/activity.ts`

The predicate that `tone()` uses for `"danger"` (a `repo-failing` event, or a `session-ended` event with an `error` or
a non-zero `exitCode`) becomes `needsAttention(event)` in the shared module. `tone()` calls it and `summarize` counts
it, so the figure and the red entries cannot drift apart.

### D4. Shape: `ActivitySummary` with fixed keys

`{ created, moved, archived, tasksCompleted, sessions, attention }`, all numbers. The client maps each key to its
label and to the kinds it is made of (`created` → `change-created`, `attention` → `repo-failing` and `session-ended`,
and so on). It uses that map, through a pure `visibleFigures(groups)` in `activityState.ts`, to hide a figure when the
kind filter excludes all of its kinds. The server always sends all six keys, so the response does not depend on how
the UI decides to hide figures.

### D5. Per-day collapse is view state keyed by day

`collapseDay(day, expanded)` in `activityState.ts` returns `{ shown, hidden }`. A day is collapsed when it has more than
`DAY_COLLAPSE_ABOVE = 30` entries, and then shows `DAY_SHOWN = 20`. The 10-entry gap means the view never offers
"Show 3 more". The component keeps `expanded: Set<dayKey>` in state. A reload or **Load older** does not clear it, so
the user keeps their place. A filter change clears it, together with `wanted.current`, because the days then hold
different entries. **Show N more** and **Show fewer** are buttons placed after the day's `<ol>`, inside the `<section>`.
The sticky `<h2>` keeps its containing block, so headings keep working as before.

*Alternatives.* Collapsing by time span (for example "the last 2 hours") does not bound the number of rendered entries.
Collapsing per repository within a day reorders the feed, which is chronological.

### D6. The strip

The strip is a row of compact labelled figures inside `.activity`, above the first day. It scrolls away with the feed
rather than sticking, so it never competes with the sticky day headings. Each figure is a `<div>` with a number and a
label. The attention figure uses `--danger` when it is non-zero. On a narrow window the strip wraps, without
horizontal scroll. It is hidden while the feed is loading and when no event matches (the empty state already explains
that).

### D7. Demo data

`buildActivity` already produces created, moved and task progress events, `session-started` events and archives within
6 days. The tasks add the following, all under the fictional sample repositories:

- A burst on one day, 2 days ago: agent sessions started, resumed and ended through the day on every change that was
  already in `Implementing` by then. That day holds more than 30 entries. It ticks no tasks: each sample change's
  progress is already recorded as one run from `0` to its board count, and extra ticks two days ago would contradict
  that run (and the changes that moved to `Implementing` later could not have had an implement session yet).
- One `session-ended` with exit code 1.
- One `repo-failing` followed by a `repo-recovered`.

The figures must stay plausible against the sample board. The burst uses changes that are in `Implementing` there,
and tasks completed comes from their existing progress.

## Risks / Trade-offs

- [The figures are only as complete as the log: 7 days and at most 2 000 entries] → The strip says "last 7 days". When
  the 2 000-entry cap cuts deeper than 7 days, the figures cover less. The same already holds for the feed, so no
  separate notice is shown.
- [The strip describes the log; a user may read it as the state of the board] → The figure labels say what happened
  ("changes archived"), not what is ("archived changes"). The spec forbids showing the figures anywhere but the feed.
- [Collapsing hides entries the user might search for with the browser's find] → Collapsing only applies to days with
  more than 30 loaded entries, and **Show N more** states the count.
