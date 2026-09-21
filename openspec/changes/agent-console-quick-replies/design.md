## Context

A session is the agent's own terminal (`agent-sessions`: *A session is the agent's own terminal*): an xterm.js instance in `TerminalView` (`src/ui/sessionPanel.tsx`) connected to the server over a WebSocket. Keystrokes travel as `{"type":"input","data":…}` text frames; the server writes `data` to the agent's pseudo-terminal unchanged (`src/server/api.ts`). The dashboard deliberately does not parse the agent's output and "MUST NOT claim to know that an agent is waiting" (*Status shown for a session is limited to what a terminal can tell*). The server already types text into an agent on the user's behalf: an opening prompt for a profile without a `{prompt}` argument is written as `` `${typed}\r` `` in a single write (`src/server/sessions/manager.ts`).

## Goals / Non-Goals

**Goals:**
- One click sends a common answer to a running session.
- Stay inside the terminal model: a default response is typed input, nothing more.
- Vendor-neutral: works with any agent profile, no knowledge of any agent's UI.

**Non-Goals:**
- Configurable or per-profile responses, editing them in Settings (kept possible, not built).
- Detecting what the agent asked, suggesting context-dependent answers, or enabling buttons only "when the agent waits".
- Sending responses from cards, the session list or to several sessions at once.
- Any server or API change.

## Decisions

### D1: A response is client-side terminal input
Clicking sends `{"type":"input","data": text + "\r"}` over the `TerminalView`'s existing socket — the same message `term.onData` produces for keystrokes. No new endpoint, no server code, the same-origin guard of the terminal socket (run-agent-actions D18) applies unchanged, and every attached viewer sees the text echoed by the agent like typed input.

Text and `\r` go in **one** message, matching how the server types opening prompts; two messages could interleave with the user's own keystrokes.

*Alternative:* a REST operation `POST /api/sessions/:id/reply` — rejected: a second input path to keep secure and to mirror in the demo site's mock API, for no gain.

### D2: Responses are data in a pure module
`src/ui/quickReplies.ts` exports
```ts
export interface QuickReply { id: string; label: string; text: string; submit: boolean }
export const DEFAULT_QUICK_REPLIES: readonly QuickReply[]
export function replyInput(reply: QuickReply): string   // text + (submit ? "\r" : "")
```
with the three initial entries (`label === text`, `submit: true`). `replyInput` rejects nothing but is tested to never emit control characters other than the single trailing `\r`. When responses become configurable, only the source of the array changes. `submit` exists from the start so that a response can be "type only" if an agent turns out to need it (see Risks).

### D3: The row lives inside `TerminalView`, below the terminal
`TerminalView` already owns the socket and the connection status, so the row is rendered there; the `send` function is kept in a ref so the buttons can use it outside the effect. `SessionPanel` passes `running={session.state === "running"}`. The row is rendered only when `running && status === "open"`; when the agent exits or the socket drops, it disappears rather than showing dead buttons.

Layout: `.session-terminal` becomes a column — terminal host (`flex: 1`) above a `.session-replies` row (`flex: none`, wraps on narrow panels). The terminal host is no longer absolutely inset over the whole area, so the existing `ResizeObserver` → `fit.fit()` shrinks the terminal by the row's height and reports the new size to the agent. Placing the row at the bottom puts it next to where agents draw their prompt, and away from **End session** in the header.

### D4: Interaction details
- Buttons are `btn sm`, in the given order, labels verbatim; tooltip: `types "<text>" and presses Enter`.
- After sending, `term.focus()` so typing continues without a click.
- The clicked button is disabled for 600 ms (double-click guard); the others stay enabled.
- The button guard is a ref, not component state: two activations within one tick both see stale state, and end-to-end verification showed the response being delivered twice with a state-only guard. State is kept only to grey the button.
- No confirmation dialog: a response is a sentence to an agent that still asks for its own permissions; a dialog would cost the click the feature saves.

### D5: Relation to the **Ship** action
While this change was in progress, `main` gained **Ship**: a header action that sends the agent a full, per-profile prompt (commit, push, open a pull request) through the server and is offered only when the session's worktree has shippable work. `Yes, create a PR` is not a second Ship: it is a short answer to a question the agent itself asked, sent as typed text with no precondition. Both stay; they do not share code.

## Risks / Trade-offs

- [The dashboard cannot know what the agent is showing. If the agent displays a **selection menu** (e.g. a permission dialog with a highlighted default), typed letters may be ignored and the trailing Enter may confirm the highlighted option — for `No, stop here` that could mean the opposite of what the user intended.] → Tooltips say exactly what is sent; the row sits directly under the terminal so the user sees the prompt they are answering; verification (tasks) exercises the preconfigured agent's permission menu explicitly. If Enter there confirms the default, `No, stop here` ships with `submit: false` (typed, not submitted) and the finding is recorded here. This stays an inherent limit of "a terminal is all we know" and is stated in the README sentence.
- [Agents that treat multi-character input as a paste might not submit on the trailing `\r`] → Same single-write form as the already shipped opening-prompt typing, which works with the preconfigured agent; covered by manual verification.
- [The row takes ~32px from the terminal] → Only while running and connected; the terminal refits automatically.
- [Accidental click] → Row is separated from destructive controls; double-click guard; consequences are bounded by the agent's own permission prompts and the session's dedicated worktree.

## Verification notes

- Stub agent (raw-mode script printing the bytes it reads), driven in headless Chrome over CDP: each response arrives as its exact text plus one `\r`; a double activation is delivered once; focus returns to the terminal and typed input still reaches the agent; the row is absent after the agent exits; the terminal grows from 46 to 48 rows when the row disappears and the agent sees the same size as rendered.
- Preconfigured agent and its permission/selection menu: **not yet exercised** (task 4.3) — it requires running the real agent under the user's login.

## Open Questions

- Should responses later be configurable per agent profile (different agents, different phrasing) or globally in Settings? Deferred until the fixed set has been used for a while.
