## Why

A running session's badge says **may need you** once its terminal has been silent for 20 seconds, but opening the
console flips it straight back to **working**: attaching a viewer resizes the pseudo-terminal and the browser terminal
reports focus, the agent redraws its screen in answer, and that redraw counts as output. So the one moment the user
looks is the moment the dashboard stops telling them the agent was waiting — and silence alone can never say that an
agent has *finished* its turn and waits for more input rather than thinking quietly.

## What Changes

- **Output the dashboard provoked does not count as activity.** Output that arrives within a short echo window after
  the dashboard resized the terminal or passed a viewer's input to it (keystrokes, focus reports, terminal replies) is
  still relayed and kept in the scrollback, but does not move the session's *last output* time. Opening, resizing,
  focusing or closing a console therefore leaves the badge as it was; output that continues past the window — the agent
  actually working — counts as before.
- **An agent can report its state through a file.** Every session is started with an environment variable,
  `SPEC_CONTROL_STATE_FILE`, naming a file in the session's own record folder under `~/.spec-control/sessions/<id>/`.
  Whatever the user wires up in their agent's own hooks may write `waiting` or `working` into it (for example
  `echo waiting > "$SPEC_CONTROL_STATE_FILE"` when the agent ends its turn or asks for permission). The dashboard only
  reads that one word; it never writes the agent's configuration and never reads the agent's output for it.
- **A reported state takes precedence over silence.** While the last report is `waiting`, the badge says the agent
  **reported** it is waiting for the user (stated as the agent's report, with how long ago), until the user types into
  the session, the dashboard submits text to it, or a newer report arrives; the badge then falls back to the
  silence-based states. A `working` report shows **working** until the terminal has been silent past the threshold.
  Sessions without reports behave exactly as today.
- Help explains both: why the badge is a guess, and how to let an agent report its state with the variable.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `agent-sessions`: the status requirement now discounts output provoked by the dashboard and the viewer, and adds the
  optional agent-reported state through `SPEC_CONTROL_STATE_FILE`; session records gain that state file.
- `help-page`: the agent-sessions section explains the badge and the state file.

## Impact

- Code: `src/server/sessions/manager.ts` (echo window around `resize`/`write`/`submit`, state-file path in the
  environment, reading and clearing the report), a new `src/server/sessions/reportedState.ts` (the variable, reading
  the file, telling terminal replies from typing), `src/server/api.ts` (reports read before sessions are listed),
  `src/server/sessions/store.ts` (state-file path, removed with the record), `src/shared/types.ts` (`Session` gains the
  reported state and its time), `src/ui/sessionState.ts` (`sessionBadge`), `src/ui/demo/demoSessions.ts`,
  `src/ui/helpContent.tsx`, `src/ui/changelog.ts`, `src/ui/sessions.tsx` (a comment); `README.md` and `CLAUDE.md`
  (the two inputs to the badge).
- Tests: a new `test/reportedState.test.ts` (resize/input echo does not count, reports are read and expire on input),
  `test/terminalApi.test.ts` (the sessions route), `test/fixtures/fake-agent.ts` (redraw on resize, writing a report),
  badge tests in `test/agents.test.ts`, `test/demoSessions.test.ts`.
- Invariants: nothing new is written outside `~/.spec-control/`; no output is parsed; nothing vendor-specific — the
  variable and the two words are the whole contract, and wiring them into an agent is the user's own configuration.
