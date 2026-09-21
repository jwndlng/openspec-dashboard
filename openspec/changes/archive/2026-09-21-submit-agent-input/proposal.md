## Why

Two controls in the session panel are meant to save the user from typing, and both currently stop one step short. **Ship** writes its prompt and an Enter to the agent's terminal in a single burst; with the preconfigured agent the text lands in the input box but is not submitted — a burst that size is taken as a paste, and the Enter inside it becomes part of the pasted text. The **default responses** (`Yes, go ahead`, `Yes, create a PR`, `No, stop here`) deliberately only type their text, because pressing Enter blindly proved dangerous: when the agent shows a selection menu, typed text is ignored and Enter confirms whatever is highlighted. In practice both now need a click, a look and a key press, which defeats their purpose.

## What Changes

- One shared, server-side way to **submit text to an agent's terminal**: type the text, wait until the agent's terminal shows it back, then press Enter as a separate key press. If the text does not show up within a short time, Enter is **not** pressed and the text is left as typed.
  - Showing the text back is what a text prompt does and what a selection menu does not, so this sends immediately where that is safe and falls back to today's type-only behaviour where it is not — without knowing anything about a particular agent.
  - Pressing Enter on its own, after the agent has processed the text, is what makes long prompts submit instead of being swallowed into a paste.
- **Default responses** use it: one click sends the answer. **BREAKING** for the behaviour introduced by `agent-console-quick-replies` (type-only); the tooltip changes accordingly.
- **Ship** uses it when the session is running, and the typed opening prompt (agents whose command has no `{prompt}` placeholder, and Ship/Resume through a resume command) uses it after start-up.
- The panel tells the user when a text was typed but **not** submitted ("the agent did not show the text — it may be showing a menu; nothing was confirmed"), so a click never fails silently. Ship reports the same through its API result.
- The terminal protocol gains one client → server message (`submit`) and one server → client notice (`submitted`). Keystrokes (`input`) are untouched: what the user types still goes to the agent unchanged and unobserved.
- The rule that the dashboard does not interpret the agent's output gets one narrow, explicit exception: checking whether text the dashboard itself just typed appeared in the terminal. Nothing else is read from the output, and nothing is stored or shown from it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`:
  - adds a requirement for submitting text on the user's behalf only after the agent showed it, with Enter as a separate key press and a visible outcome when it was not submitted;
  - modifies **Default responses can be sent to a running session** (send immediately through that mechanism instead of type-only);
  - modifies **Ship asks the agent to commit, push and open a pull request** and **Session starters run a fixed prompt for a validated change** (typed prompts are submitted through that mechanism);
  - modifies **A session is the agent's own terminal** (the narrow exception to "MUST NOT parse the agent's output").

## Impact

- `src/server/sessions/submit.ts` (new): the pure parts — ANSI stripping, normalisation, echo matching — and the submit routine against a minimal terminal interface; `test/submitText.test.ts` (new).
- `src/server/sessions/manager.ts`: `submit(id, text)`; Ship and the typed opening prompt call it instead of writing `text + "\r"`.
- `src/server/api.ts`: terminal WebSocket handles `{"type":"submit","data":…}` and answers `{"type":"submitted","ok":…}`; `POST /api/sessions/:id/ship` includes whether the prompt was submitted.
- `src/shared/types.ts`, `src/ui/api.ts` and the demo site's mock API: Ship result shape.
- `src/ui/quickReplies.ts`, `src/ui/sessionPanel.tsx`, `src/ui/styles.css`: defaults submit again, responses go through `submit`, the not-submitted notice.
- `test/terminalSessions.test.ts`, `test/terminalApi.test.ts`, `test/quickReplies.test.ts`: updated expectations.
- `README.md`: the default responses and Ship bullets.
- Prerequisite: `agent-console-quick-replies` is merged but not archived; its requirement must be synced into `openspec/specs/agent-sessions/spec.md` before this change's delta can be archived.
- No new dependency, no config format change.
