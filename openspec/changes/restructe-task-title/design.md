# Design

## Context

`ChangeCard` (`src/ui/kanban.tsx`) renders its top as one flex row, `.card-top` with `justify-content: space-between`:
`.card-title` (name, and the age under it) on the left and `.card-status` on the right. `.card-status` is `flex: none`,
so the session badge(s) (`SessionControls part="status"`) and the console quick link (`ConsoleLink`) keep their full
width and `.card-title` (`min-width: 0`, name with `word-break: break-word`) gets whatever is left — on a narrow column
the name breaks over two or three lines. `.card-status:empty { display: none }` already hides the status when both
children render `null`.

In the footer (`.card .meta`), the starters are `.btn.sm` (`padding: 3px 9px; font-size: 12px`, 1px border), while
`.card .show-details` is `font-size: 11px; padding: 1px 4px 1px 7px`, 1px transparent border — about 4px shorter and
one size smaller.

## Goals / Non-Goals

**Goals:**
- The name and age own the full width of the card's top; the session status sits on its own line below them.
- No empty line or gap on a card without session status.
- **Show details** lines up with the starter button: same height and text size.
- The card's progress bar says whether it counts artifacts or tasks.

**Non-Goals:**
- Changing the badge or link behaviour, or the detail view's header (its task bar stays `done/total`, as the
  change-detail spec states).
- Restyling the starter buttons or making **Show details** look like a bordered button at rest.

## Decisions

- **Stack the top instead of a new wrapper.** `.card-top` becomes `flex-direction: column; align-items: stretch` with a
  small gap; `.card-title` first, `.card-status` second. `.card-status` becomes `justify-content: flex-start` so the
  badges start under the name. The existing `:empty` rule keeps a card without status free of an extra line — this
  relies on `SessionControls` and `ConsoleLink` rendering nothing (not an empty fragment with whitespace), which they do
  today. Alternative considered: `flex-wrap` on the old row so status wraps only when needed — rejected, because the
  name would still be squeezed whenever the status fits beside a partly wrapped name, which is the reported problem.
- **Size Show details from the `.btn.sm` metrics**, not by giving it the `btn` class: set `font-size: 12px` and the
  starter's vertical padding (`3px`), keep the 1px transparent border and the existing colours and hover. Same font
  size, vertical padding and border give the same box height as the starter within the same line-height (both measure
  26px). The sides stay narrow (`padding: 3px 2px 3px 5px`, `gap: 1px` to the chevron): in a lane-width card the footer
  has 198px, and with the starter's 9px sides Show details grew to 104px and wrapped under **▶ Implement** (93px); at
  94px it sits beside **▶ Implement**, **↳ Implement** and **▶ Archive**. **▶ Draft artifacts** (112px) wraps, as it
  did before this change. Using `.btn` would pull in the raised background and visible border at rest, which the
  spec keeps quieter.
- **Unit word on the card's bar only.** `Meter` already takes `unit` (`"artifacts" | "tasks"`) for its tooltip; it gains
  a `showUnit` flag that appends `Artifacts` or `Tasks` to the visible `done/total`. `ChangeCard` passes it, the detail
  view does not, so the change-detail spec's `4/12` stays true. The visible text stays `aria-hidden` as today — the
  accessible name is still `meterText`. The value's `min-width: 42px` is dropped for the labelled form so the longer
  text is not clipped; the track keeps `flex: 1` and shrinks. Alternative considered: labelling every meter — rejected
  to keep this change out of the change-detail spec.
- **Test by structure.** The card-content test in `test/changeDetail.test.ts` already inspects `.card-top`; it gains an
  assertion that `.card-title` comes before `.card-status` among its children. Sizes are CSS-only and are checked by
  looking at the board (`bun run dev`).

## Risks / Trade-offs

- [A card with a session grows by one line] → Accepted: the name is what makes a card readable; the extra line only
  appears when there is a status to show.
- [Show details and `.btn.sm` metrics can drift apart later] → A comment next to `.card .show-details` names
  `.btn.sm` as the size it follows.
- [Overlap with in-flight `kanban-board` deltas] → This change edits only the card's top and the Show details size; the
  spec delta is written against `simplify-kanban-board`'s text, which should be archived first.
