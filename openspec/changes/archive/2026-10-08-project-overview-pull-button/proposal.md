# Proposal

## Why

On the projects overview, **Pull** in each row and tile footer is drawn as a `ghost` button: no border and no
background until hovered, so it reads as loose text next to **Console**, which is a bordered button. Pull is the one
control on the overview that contacts a remote and changes a main checkout; it should look like the action it is.

## What Changes

- In an overview row and a tile footer, **Pull** becomes a real bordered button with the same height, border, padding
  and font size as the **Console** button beside it, and keeps its border at rest, not only on hover.
- Its label, tooltip, running state (`Pulling…`), outcome badge and behaviour are unchanged; the board header's Pull
  and **Pull all** in the band are unchanged.
- The `compact` (ghost) variant of `PullButton` is removed, since the overview was its only user.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `repository-pull`: "Pull is offered where repositories are shown, and only runs on request" — states that in an
  overview row and tile Pull is a bordered button matching Console, not a borderless one.

## Impact

- `src/ui/pull.tsx` — `PullButton` loses its `compact` ghost variant and takes an overview look instead.
- `src/ui/overview.tsx` — the two `PullButton` call sites (row and tile).
- `src/ui/styles.css` — the overview Pull button's look, shared with `.project-console-btn.on-project`.
- No server, API, invariant or network behaviour changes.
