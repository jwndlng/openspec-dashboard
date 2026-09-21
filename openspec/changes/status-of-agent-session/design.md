# Design

## Context

See `proposal.md` — Why. What exists today, in one place:

`sessionBadge(session, now)` in `src/ui/sessionState.ts` is the single pure function that names a session's state. For
a running session it already branches on `now - Date.parse(session.lastOutputAt)`:

- `> QUIET_AFTER_MS` (60_000) → `◆ quiet 3m`, tone `info`, title "the agent is probably waiting for you"
- otherwise → `● running`, tone `info`, `live: true` (the pulsing dot)

Two facts that shape the approach:

- **`lastOutputAt` is exact.** The manager stamps it on every PTY chunk (`onOutput`, `manager.ts`), and `/api/sessions`
  serves the in-memory record (`manager.list()`). `OUTPUT_STAMP_MS = 5000` throttles only the write to disk, so it does
  not blunt the reading the badge sees.
- **The badge is recomputed on every render**, and `sessions.tsx` polls every 3s (`POLL_MS`), so a state that depends on
  elapsed time flips within one poll without any new timer.

Both consumers — the card chip in `sessions.tsx` and the panel header and dock tabs in `sessionPanel.tsx` — call the
same function, so the wording cannot drift between them.

## Goals / Non-Goals

**Goals:**

- Keep the whole decision inside `sessionBadge()`: one pure function, one behaviour, trivially unit-testable.
- No server, API, config or storage change; `Session` keeps its current shape.

**Non-Goals:**

- Any use of the agent's output beyond its *timing* — see the delta spec, and the agent-session rules in `CLAUDE.md`.
- A per-agent or user-configurable threshold. One constant until there is evidence one value cannot serve.
- A document-title or favicon signal. Considered and dropped with the surface question: board card chips are the
  surface the complaint is about, and the panel follows for free.

## Decisions

### Threshold: 20 seconds

Below the spec's 30s cap, and chosen against how agent CLIs actually behave: an agent that is working redraws its
spinner, elapsed-time counter and token count continuously, so genuine work keeps the terminal noisy far more often
than once every 20 seconds — while an agent parked on a permission prompt draws it once and stops. 20s is comfortably
longer than the gap between redraws and short enough that the state a user cares about appears while they are still
looking.

- *10s* — rejected: an agent between two long tool calls can legitimately print nothing that long, and the badge would
  flap.
- *60s (today)* — rejected: this is the complaint. It hides the blocked state for exactly the minute in which it is
  most useful.

### Wording: `working` / `may need you`, hedged

`● working` for a printing terminal, `◆ may need you 20s` for a silent one. `working` is a claim about the terminal,
not the agent, and the title text keeps saying so ("the terminal is producing output"); `may need you` is phrased as a
possibility, which is what the retained MUST NOT requires.

- *"Agent working" / "User input required"* — the user's original phrasing. Rejected: the spec's
  `MUST NOT claim to know that an agent is waiting, working` was kept deliberately, and the dashboard would be
  confidently wrong whenever an agent thinks quietly.
- *Keeping `quiet 3m`* — rejected: it names the terminal's condition, not the consequence for the user, which is the
  whole point of the change.

### Render the duration in seconds below a minute

Today the duration is `Math.floor(quiet / 60_000)` minutes, which is correct only because nothing under 60s can reach
it. With a 20s threshold that same expression prints `may need you 0m`. The duration therefore needs a seconds form
under one minute (`45s`) before minutes (`3m`). This is a consequence of the threshold change, not a separate feature —
it must land in the same commit or the new state is born broken.

### Tone: give the silent state its own

Both running states are `info` today, separated only by motion (`live`) and wording, and motion is the weaker cue on a
dense board. The silent state takes `warning`; `working` keeps `info` and keeps the pulse. The delta spec still
requires the words alone to carry the distinction, so the tone is reinforcement, never the signal.

## Risks / Trade-offs

- **A slow agent that prints nothing for 20s is shown as possibly needing the user.** → This is the honest failure
  mode, and it is why the wording is a question and not an assertion. The badge also corrects itself as soon as output
  resumes (scenario "Output resumes").
- **`warning` on a board that has just had its status palette retuned.** → `update-label-coloring` (merged) gave status
  labels their own palette, and `agent-session-coloring` is in flight over `sessionState.ts` and `styles.css`. Reuse
  the existing `tone-warning` token rather than adding a colour, and rebase before touching `styles.css`. If the tone
  turns out to clash, drop it: the words already satisfy the spec.
- **Threshold tuned against the agents the author has seen.** → It is one constant in one file, so retuning is a
  one-line change; the spec fixes only the 30s ceiling, not the value.

## Migration Plan

None. A UI-only change to derived, non-persisted display state; nothing is stored, nothing is read back. Rollback is
reverting the commit.
