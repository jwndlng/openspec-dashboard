# Proposal

## Why

A running agent session is shown as `running` whether the agent is churning through work or has been sitting at a
question for the last fifty seconds — the two cases a user actually needs to tell apart. The dashboard does already
distinguish them, but only after a full minute of terminal silence, and only under the word `quiet 3m`, which reads as
an age, not as a call for attention. So the state that matters — *this session is blocked on me* — is invisible for the
first minute and unlabelled afterwards.

## What Changes

- Split the running session badge into two clearly named states, both derived from terminal output **timing** only:
  one for a terminal that is printing, one for a terminal that has fallen silent.
- Reword both so the difference is legible at a glance on a board card, and so the silent one reads as a prompt to look
  rather than as a duration. The dashboard keeps hedging: it still MUST NOT claim to know that an agent waits or works.
- Shorten the silence threshold from 60s, so a session blocked on a question surfaces in seconds rather than after a
  minute, and keep showing how long the silence has lasted.
- No new source of evidence: the agent's output is still never parsed, filtered or summarised, and nothing
  vendor-specific is added. The only input remains `Session.lastOutputAt`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-sessions`: the requirement on what the dashboard may say about a running session ("SHALL show a session as
  running, ended … or failed … While a session is running and its terminal has been silent for more than a minute, the
  dashboard SHALL show it as quiet together with the duration") changes: a running session gets two named states rather
  than one state plus a footnote, the threshold is no longer fixed at one minute, and the wording requirement becomes
  explicit. The `MUST NOT claim to know that an agent is waiting, working, or how much it has cost` clause is kept
  unchanged.

## Impact

- `src/ui/sessionState.ts` — `sessionBadge()` and `QUIET_AFTER_MS`; the sole place the running state is named.
- `src/ui/sessions.tsx` — the session chip on a Kanban card, the surface this change targets.
- `src/ui/sessionPanel.tsx` — inherits the new wording, because it calls the same `sessionBadge()`; no separate change.
- `src/ui/styles.css` — only if the silent state needs a tone distinct from the printing one.
- `test/` — the unit tests over `sessionBadge`.
- Not touched: the server, `Session.lastOutputAt` and its 5s persistence throttle, the terminal relay, and anything
  that reads agent output. No API or config change.
