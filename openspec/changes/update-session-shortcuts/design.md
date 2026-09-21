# Design

## Context

See `proposal.md` — Why. The pieces this change needs already exist:

- `src/server/sessions/submit.ts` types text, watches the terminal's own output for the echo, and presses Enter as a
  separate key press only if the echo arrives; `SessionManager.submit()` serialises submissions per session so text and
  Enter never interleave. `ship` and the default responses already use it, as does an opening prompt typed after
  start-up.
- `SessionManager.prompt()` is the one caller left that writes blind (`proc.write(text)`) and returns synchronously.
- The "typed but not sent" notice is already in the panel: `reportUnsent(sessionId)` drives it, and Ship already feeds
  it from a `ShipResult.submitted` flag.

So this is a change of *which* path one call takes, not a new mechanism. The spec requirement that governs all of it —
"Text sent on the user's behalf is submitted only after the agent showed it" — is untouched; the next-step prompt just
comes under it.

## Goals / Non-Goals

**Goals:**

- One activation of a next-step button sends the prompt, wherever the agent shows a text prompt.
- The result says whether it was submitted, and the UI surfaces that with the notice it already has.
- Card and panel buttons behave and describe themselves identically.

**Non-Goals:**

- No change to `submit.ts` — no new timing, no new echo heuristics.
- No change to which starters are offered, to stage checks, to Archive's separate worktree, or to any refusal.
- No new route, no new UI element. The notice, the focus behaviour and the button set stay as they are.

## Decisions

**Route `prompt()` through `submit()` rather than adding a "type and press Enter" variant.**
The safety property the old rule protected — never confirming a highlighted menu entry — is exactly what `submit()`
already guarantees, and it is the mechanism the specs name. The alternative, a flag on `write` that appends `\r`, would
reintroduce blind Enter and contradict the spec requirement. Cost: `prompt()` becomes `async`, so `api.ts` awaits it
and the demo's `prompt` returns a result too.

**Return `Session & { submitted: boolean }`, reusing the shape of `ShipResult`.**
Ship already solved this and the UI already knows how to read it. Give it a name of its own
(`export type PromptResult = Session & { submitted: boolean }`, or reuse `ShipResult` if the name still reads right) so
the route's contract is explicit; the wire shape is the same either way, which keeps `src/ui/api.ts` a one-line change.

**Set `session.action` before submitting, not after.**
The recorded action is what the user asked for; whether the agent's terminal happened to echo in time is a property of
the send, not of the intent. Setting it first also keeps the record correct if the submission times out, and matches
the spec's "whether or not the prompt was submitted".

**Report the unsent notice from `start()` in `sessions.tsx`, next to the existing focus tick.**
`start()` already distinguishes "into a running session" from "open a new one" and already fires `setFocusTick`; adding
`ui.reportUnsent(result.submitted ? undefined : into)` there keeps the decision in one place rather than duplicating it
in the card and the panel header, which both call `start()`.

**The demo submits too.**
`demoSessions.prompt` currently types into the playback and comments that Enter stays with the visitor. It should run
the prompt the way `ship` does (`run(s, "ship")` → the equivalent for the action) and return `submitted: true`, so the
demo does not teach behaviour the product no longer has.

## Risks / Trade-offs

- **An agent that shows a menu at the moment the user presses Implement gets the prompt typed into the menu's filter
  box** → unchanged from today: the text is typed either way, and now the user is *told* it was not sent instead of
  being left to press Enter into a menu. This is strictly safer than the current instruction to "press Enter".
- **`prompt()` becoming async changes the route's latency** — it now waits for the echo (bounded by `submit.ts`'s
  timeout) before answering → acceptable: `ship` has the same shape, the button already shows no spinner of its own,
  and the terminal shows the prompt as it is typed.
- **A slow agent times out and the user sees the notice on a prompt that would have worked** → the text is left typed in
  the agent's input box exactly as before, so the user can still press Enter; the notice says nothing was confirmed.
- **`CLAUDE.md` and the specs disagree until both are updated** → the invariant note in `CLAUDE.md` is part of this
  change's impact, updated in the same commit as the spec deltas.

## Migration Plan

None. No stored data, config or session record changes shape; a running session keeps working across the change because
nothing about the session record or the terminal protocol moves.
