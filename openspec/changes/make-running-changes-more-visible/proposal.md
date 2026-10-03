# Proposal

## Why

On a busy board the only sign that an agent is working on a change is the small `working` badge in the card's footer:
its dot pulses and a lighter colour sweeps over its label. The rest of the card looks exactly like an idle one, so the
user has to scan every footer to find what is in progress. The card itself should say so at a glance.

## What Changes

- A card whose change has a session in the live (`working`) state is **tinted**: its background and edge take a soft
  shade of the `info` role, the same blue the live badge already owns, so the card stands out from idle cards without
  hiding its content or lowering any label's contrast.
- On that card the **change name gets the same sweep** as the live badge's label: a blue band runs across the
  name in a loop, never hiding it and never taking it below 4.5:1 contrast.
- Both follow exactly the badge's live state: a `may need you`, ended or failed session, a card without a session and
  a repository with agent sessions disabled show the plain card. Motion keeps meaning exactly "an agent is working
  now".
- With `prefers-reduced-motion: reduce` the name is static; the tint stays, because it is not motion.
- The stale wording of the motion requirement (`running`, `quiet`) is brought in line with the badge the board draws
  today (`working`, `may need you`).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: the requirement "The running session badge shows activity through motion" is widened so that the
  card of a change with a working session is tinted in the `info` role and its name carries the same sweep, under the
  same decorative-only and reduced-motion rules.

## Impact

- `src/ui/kanban.tsx` — `ChangeCard` marks its `<article class="card">` as live.
- `src/ui/sessionState.ts` — a small pure predicate saying whether a card stands for a live session, derived from the
  same `sessionBadge` the badge uses.
- `src/ui/styles.css` — the live card tint and the name sweep, reusing the existing `session-sweep` keyframes.
- `test/` — a unit test for the predicate.
- No server, API, type or invariant changes; nothing new is read from an agent's output.
