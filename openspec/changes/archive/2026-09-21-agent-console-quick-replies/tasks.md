## 1. Responses as data

- [x] 1.1 Add `src/ui/quickReplies.ts` with `QuickReply`, `DEFAULT_QUICK_REPLIES` (`Yes, go ahead`, `Yes, create a PR`, `No, stop here`; `submit: true` — changed to `false` by 4.5) and `replyInput(reply)` per design D2
- [x] 1.2 Add `test/quickReplies.test.ts`: the default set and its order; `replyInput` is text + `\r` when `submit`, text only otherwise; no default contains control characters; ids are unique

## 2. Session panel

- [x] 2.1 In `TerminalView` (`src/ui/sessionPanel.tsx`) keep `send` and the terminal in refs, accept a `running` prop, and render the response row only when `running && status === "open"`
- [x] 2.2 On activation send one `{ type: "input", data: replyInput(reply) }` message, refocus the terminal, and disable that button for 600 ms; tooltip `types "<text>" and presses Enter`
- [x] 2.3 Pass `running={session.state === "running"}` from `SessionPanel`

## 3. Styles

- [x] 3.1 In `src/ui/styles.css` make `.session-terminal` a column with the terminal host filling the remaining space and a wrapping `.session-replies` row below it; tokens only
- [x] 3.2 Confirm the terminal refits when the row appears and disappears (agent sees the new size) and that the connection note does not overlap the row

## 4. Verification and docs

- [x] 4.1 `bun run check` passes
- [x] 4.2 With a stub agent profile (a shell script that echoes what it reads): each response arrives as its exact text plus one carriage return; double click sends once; focus returns to the terminal; the row is absent after the agent exits and while disconnected; the terminal reports a smaller size when the row is shown
- [x] 4.3 With the preconfigured agent: a response submits at its free-text prompt; check what each response does while a permission or selection menu is open and record the result in design.md — if Enter confirms a highlighted default, set `submit: false` for `No, stop here`
- [x] 4.5 Follow-up to 4.3 (hazard confirmed for every response, design D6): set `submit: false` for all defaults, update tests, tooltip, spec delta, proposal and README to "types, you press Enter"
- [x] 4.4 Add one sentence to the agent sessions section of `README.md`, including that a response is typed text and the dashboard does not know what the agent is asking
