# Proposal

## Why

The row of default responses under a session's terminal is a set of bare buttons with nothing saying what they are,
so they read as part of the agent's output rather than as one-click shortcuts the dashboard offers. And a common
reply after Ship is missing: when the pull request cannot be merged because its branch conflicts with the base, the
user has to type the request to resolve that by hand.

## What Changes

- The default-response row starts with a visible, non-interactive label `Shortcuts:` in front of the buttons, and that
  label is the row's accessible name.
- A fourth default response, `Resolve PR conflicts`, is added after `Yes, create a PR` (the order becomes
  `Yes, go ahead`, `Yes, create a PR`, `Resolve PR conflicts`, `No, stop here`). Like the others it submits exactly
  its label under the existing rules for text sent on the user's behalf — typed, echo-checked, Enter only when the
  text appeared.
- No server, API or agent-profile change: the response is sent through the existing terminal `submit` message.

Out of scope: making the set of responses configurable, and offering responses conditionally on the work status or
on anything the agent printed.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: the "Default responses can be sent to a running session" requirement names the new set and its
  order, and requires the row's `Shortcuts:` label.

## Impact

- `src/ui/quickReplies.ts` — the new response in `DEFAULT_QUICK_REPLIES`.
- `src/ui/sessionPanel.tsx` — the `Shortcuts:` label in the response row, used as the group's accessible name.
- `src/ui/styles.css` — styling of the label within `.session-replies`.
- `test/quickReplies.test.ts` — the expected set and order.
