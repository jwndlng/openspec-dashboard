## Why

Most of what a user tells an agent during a session is one of a handful of short answers: carry on, open a pull request, stop. Today each of them has to be typed into the terminal, which means focusing the terminal, typing a sentence and pressing Enter — often from a small side panel, several times per session, across several sessions. A row of ready-made answers turns the common case into one click and makes it practical to steer several sessions at once.

## What Changes

- The session panel shows a row of **default responses** below the terminal. Initial set, in this order:
  - `Yes, go ahead`
  - `Yes, create a PR`
  - `No, stop here`
- Clicking a response types its text into the agent's terminal, exactly as if the user had typed it — through the same input path as keystrokes — and focuses the terminal; the user presses Enter to send. It deliberately does not press Enter: a terminal cannot tell the dashboard whether the agent shows a text prompt or a selection menu, and verification with the preconfigured agent showed that in a menu the text is ignored and Enter confirms the highlighted option. The dashboard adds nothing, interprets nothing, and the text appears in the terminal like any typed input.
- The responses are available only while the session is running and its terminal is connected; otherwise they are not offered. After a click, keyboard focus returns to the terminal so the user can keep typing, and the clicked button is briefly inert so a double click cannot type the answer twice.
- Each button's tooltip states what it does ("types '…' — press Enter to send").
- The set is fixed for now but kept as plain data in one place, so that making it configurable (globally or per agent profile) later is a change of data source, not of the console.
- Unchanged: the terminal itself, typed input, session lifecycle, the server and its API, agent profiles and the shared config format.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: adds a requirement that the session panel offers default responses which are typed into the agent's terminal as input without pressing Enter, only while the session is running and connected, without the dashboard interpreting the agent's state.

## Impact

- `src/ui/quickReplies.ts` (new): the default responses as data plus the pure function that turns a response into terminal input; `test/quickReplies.test.ts` (new).
- `src/ui/sessionPanel.tsx`: `TerminalView` renders the response row and sends through its existing WebSocket `input` message; needs the session's running state as a prop.
- `src/ui/styles.css`: response row below the terminal (token-based); the terminal keeps resizing to the remaining space via the existing `ResizeObserver` + fit.
- `README.md`: one sentence in the agent sessions section.
- No server, API, config, snapshot or dependency changes; the demo site's mock API is unaffected because no API operation is added.
