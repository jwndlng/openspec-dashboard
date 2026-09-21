# Proposal

## Why

A card's `● running` badge is a static label. With several sessions across repositories it does not read as "something is happening right now", and it looks the same as the badges around it. A running agent is the one live thing on the board and should look alive at a glance.

## What Changes

- The `running` session badge is animated: its dot pulses, and a lighter colour sweeps across its text about every two seconds.
- Only `running` is animated. `quiet <duration>` stays still on purpose — that is the session waiting for the user, and it must not look busy — as do `ended` and `failed`.
- The same badge in the session panel header and wherever else the session badge is rendered behaves the same.
- With `prefers-reduced-motion: reduce` nothing moves; the badge looks exactly as it does today.
- CSS only, built from the existing theme tokens, so it works in the light and the dark theme. No new dependency, no network.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: new requirement that the running session badge shows activity through motion, with the reduced-motion and text-plus-colour rules.

## Impact

- `src/ui/sessionState.ts` (`SessionBadge` gains a separate dot and a `live` flag), `src/ui/sessions.tsx`, `src/ui/sessionPanel.tsx` (shared badge rendering), `src/ui/styles.css`.
- Tests for the badge helper. No server, API or config change.
