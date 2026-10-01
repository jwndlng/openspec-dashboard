# Design

## Context

Every starter goes through one function, `start` in the session provider (`src/ui/sessions.tsx`). It opens a session
(or, when the change has a running session, sends the prompt into it), awaits `refresh()` so the new session is in the
list, and then always calls `openConsole(repoId, change, sessionId)`, which navigates to the change's detail view on the
Console tab. It has three callers:

| Caller | Where it is rendered | After this change |
| --- | --- | --- |
| `SessionControls` on a card (`src/ui/kanban.tsx`) | board | stay on the board |
| `SessionControls` in an untouched change's Console tab (`src/ui/sessionPanel.tsx`) | detail view, Console tab | show the new session (as today) |
| next-step starters in the panel header (`src/ui/sessionPanel.tsx`) | detail view, Console tab | show the session (as today) |

The card's footer already turns into the session's badge once `sessions` holds a running session for the change
(`cardSessionControls`), and the badge already opens the console. So nothing new has to be drawn — only the navigation
has to be skipped.

## Goals / Non-Goals

**Goals:**
- A card's starter never navigates; the two Console-tab callers behave exactly as today.
- The decision is explicit at each call site, not inferred from the current route.

**Non-Goals:**
- Any change to the server, the session API, the Open work list or the badge's own click.

## Decisions

**D1 — `start` takes whether to show the console.** `start(repoId, change, action, show)` with `show: boolean`, required
rather than defaulted, so a future caller has to decide. When `show` is false, `start` still awaits `refresh()` — that is
what puts the badge on the card before the button's "Starting…" goes away, so the footer goes straight from the starter
to the badge without flashing the starter again — and skips `openConsole`. The focus tick for a prompted session is
unaffected.
*Alternative:* let `start` return the session id and have each caller navigate. Rejected: `openConsole` would have to
join the context, and the comment in `start` already explains why navigation by id and place must happen there (a
session just started is not yet in the closure's list).
*Alternative:* infer from the current route (board → stay, detail → show). Rejected: the untouched Console tab and the
card render the same `SessionControls`, and a rule hidden in the route is the kind of thing that silently flips when a
view is reorganised.

**D2 — `SessionControls` is told where it is.** A `place: "card" | "console"` prop, passed by `kanban.tsx` and
`sessionPanel.tsx`. The mapping from place to `show` is a one-line pure function in `src/ui/sessionState.ts`
(`startShowsConsole(place)`), so the rule is asserted by a test without a renderer, like the other `sessionState`
helpers. The next-step starters in the panel call `start(..., true)` directly; they are not `SessionControls`.

**D3 — Every card starter, not only Draft.** The prompt names Draft, but Implement, Validate and Archive on a card have
the same shape: the user starts work and comes back to it. One rule for the card is easier to learn and to spec than a
per-action exception. See proposal.md — What Changes.

## Risks / Trade-offs

- [The user wanted to watch the agent start, e.g. to answer a first-run dialog] → the card's badge reads "may need you"
  once the terminal falls silent and opens the console in one activation; the Open work list lists the session too.
- [`refresh()` fails after a successful open, so the card briefly shows its starter again] → the next poll shows the
  badge; a second activation is answered by the server with the running session and starts nothing (agent-sessions:
  "Duplicate open"), so the worst case is a no-op.
- [The demo site] → it renders the same UI against `demoApi`, so it behaves the same with no demo-specific change.
