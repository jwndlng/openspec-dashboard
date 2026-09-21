# Proposal

## Why

The next-step shortcuts on a running session — **Draft artifacts**, **Implement**, and the same buttons on a card —
only *type* their prompt into the agent's terminal and leave the user to press Enter. That rule was written before the
dashboard could tell whether the agent was showing a text prompt or a selection menu. It can now: **Ship** and the
default responses already submit their text safely, by waiting for the agent's own terminal to echo it and only then
pressing Enter. The next-step shortcuts are the last place that still makes the user finish the job by hand, for no
remaining reason — one click should send the prompt.

## What Changes

- The next-step prompt sent to a running session (`POST /api/sessions/<id>/prompt`) is **submitted** under the existing
  rules for text sent on the user's behalf — typed, echo-checked, then a separate Enter — instead of written blind
  without Enter. The safety property is unchanged: where the agent shows a selection menu the text is never confirmed.
- That route now reports whether the prompt was submitted, the way `ship` does, and the UI shows the existing
  "typed but not sent" notice on the session when it was not.
- Button tooltips on the card and in the panel header say that the prompt is sent to the running session, rather than
  telling the user to press Enter.
- The demo site's simulated session behaves the same way, so the demo does not teach the old behaviour.
- **Not changed:** an opening prompt typed after start-up, Ship, and the default responses already work this way;
  Archive still refuses to be sent into a change's own worktree; nothing is sent to a session that is not running.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: "A starter's prompt can be sent to a running session" currently requires the prompt to be written
  **without a trailing Enter**. It changes to require submission under the "Text sent on the user's behalf" rules, and
  to report whether the prompt was submitted.
- `dashboard-api`: `POST /api/sessions/<id>/prompt` changes from "send … as typed input without Enter and return the
  session" to submitting the prompt and returning the session together with whether it was submitted. Refusals are
  unchanged.
- `kanban-board`: "Cards keep offering the next step while a session runs" requires the starter's label and tooltip to
  say "that it types into the running session and that Enter sends it"; it changes to say the prompt is sent to the
  running session.

## Impact

- `src/server/sessions/manager.ts` — `prompt()` becomes async and routes through `submit()` instead of `proc.write()`.
- `src/server/api.ts` — the `prompt` sub-route awaits the result.
- `src/shared/types.ts` — a result type carrying `submitted` for the prompt route (`ShipResult`'s shape).
- `src/ui/api.ts`, `src/ui/sessions.tsx` — `promptSession` returns the result; `start()` reports an unsent prompt.
- `src/ui/sessionPanel.tsx`, `src/ui/sessions.tsx` — tooltip wording on the next-step buttons.
- `src/ui/demo/demoSessions.ts`, `src/ui/demo/demoApi.ts` — the demo's `prompt` submits.
- `test/sessionPrompt.test.ts`, `test/demoSessions.test.ts` — the "no Enter" assertions become "submitted" assertions,
  plus a menu case proving nothing is confirmed.
- `CLAUDE.md` — the agent-sessions note that next-step prompts never include Enter.
- No new dependency, no new route, no change to what the dashboard writes.
