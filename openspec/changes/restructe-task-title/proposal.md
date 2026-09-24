# Proposal

## Why

A card's top row puts the change name and the session status (session badge and console quick link) side by side.
When a change has a session, the status takes a fixed share of the narrow card and pushes the name into wrapping over
several lines, so the one thing a card is for — saying which change it is — becomes the hardest part to read. In the
footer, **Show details** is drawn smaller than the next-step starter beside it, so the two actions look unrelated
and the row looks uneven.

## What Changes

- The change name and its age get the whole width of the card's top: the name is never shortened or wrapped to make
  room for the session status.
- The session status — the session badge(s) and the console quick link — moves to its own line directly below the name
  and age, and that line is only there when there is something to show. A card without a session looks as it does today.
- **Show details** in the card's footer takes the same height and text size as the next-step starter button beside it
  (for example **▶ Implement**), keeping its quiet, borderless look at rest.
- A card's progress bar names what it counts: `2/4 Artifacts` for a change in `Drafts`, `3/12 Tasks` in a later
  stage, instead of a bare `2/4` that looks the same in both phases. The detail view's task bar keeps its `done/total`.
- No other change to what a card shows, what its controls do, or where they lead.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: "Cards show only what an overview needs" labels the card's progress bar `done/total Artifacts` or
  `done/total Tasks`, places the session status and console quick link on a line
  under the change name instead of beside it, and sizes **Show details** like the starter button; "Cards offer Show
  details" moves the console quick link from the card's top-right corner to that status line.

## Impact

- `src/ui/kanban.tsx` — `ChangeCard`: markup of the card's top (title first, status row after it); `Meter` gains an
  option to show its unit, which only the card uses.
- `src/ui/styles.css` — `.card-top`, `.card-status`, `.card .show-details`, `.meter .value`.
- `test/changeDetail.test.ts` — the card-content test gains assertions for the new order and the bar's label.
- `openspec/specs/kanban-board/spec.md` (on archive).
- Builds on the `kanban-board` delta of `simplify-kanban-board` (complete, not yet archived), whose text of "Cards show
  only what an overview needs" this change modifies; archive that change first. `integrate-console-detail-view` already
  drops "beside the change name" from "Cards offer session starters and show session state", so this change leaves that
  requirement alone.
