# Design

## Context

The response row is rendered by `TerminalView` in `src/ui/sessionPanel.tsx` from the constant
`DEFAULT_QUICK_REPLIES` (`src/ui/quickReplies.ts`), as a `div.session-replies` with `role="group"` and
`aria-label="Default responses"`. Each response already goes through the terminal socket's `submit` message, so the
server's echo check decides about Enter. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- A label that makes the row recognisable, without changing how any response is sent.
- One more response that is data only.

**Non-Goals:**
- Any server-side or agent-specific handling of the new response; the dashboard does not know what "conflicts" are.

## Decisions

- **The label is text inside the group, referenced by `aria-labelledby`.** A `<span id=…>Shortcuts:</span>` as the
  row's first child, with the group's `aria-labelledby` pointing at it, replaces the `aria-label`, so the visible and
  the accessible name are the same word. The id is derived from the session id, since up to three panes are shown at
  once. Alternative: a `<fieldset>`/`<legend>` — rejected, as the existing biome-ignore comment explains, because of the
  legend's styling.
- **The new response is one more entry in `DEFAULT_QUICK_REPLIES`**, `{ id: "resolve-conflicts", label: "Resolve PR
  conflicts", text: "Resolve PR conflicts", submit: true }`, keeping the invariant the tests assert: text equals label,
  submitted, no control characters. Placed after `Yes, create a PR` so the two pull-request replies sit together and
  `No, stop here` stays last.
- **Label style**: the existing `.hint` class (subtle foreground, small size) plus `flex: none`, so it never wraps away
  from the first button's line unnecessarily and does not look clickable.

## Risks / Trade-offs

- [A short prompt leaves "how" to the agent — it may merge or rebase the base branch as it sees fit] → Accepted: the
  agent's own permission prompts govern what it does; the dashboard only types the text, like Ship.
- [Four buttons plus a label in a narrow pane (three panes shown)] → The row already wraps (`flex-wrap: wrap`); the
  terminal refits through its ResizeObserver when the row grows.
