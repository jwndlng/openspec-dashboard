## 1. Prerequisites and spike

- [x] 1.1 Reproduce the Ship problem with the preconfigured agent in a throwaway repository and dashboard home: (a) long prompt + Enter in one write, (b) long prompt, pause, Enter as its own write. Record in design.md whether (a) only fills the input box and (b) submits, and how the agent echoes a long prompt (wrapped, truncated, placeholder)
- [x] 1.2 Archive `agent-console-quick-replies` (own PR) so *Default responses can be sent to a running session* exists in `openspec/specs/agent-sessions/spec.md`; then `openspec validate submit-agent-input --strict`

## 2. Echo matching (pure)

- [x] 2.1 Add `src/server/sessions/submit.ts` with `stripAnsi`, `normalise` (whitespace removed), `echoProbe(text)` (whole text up to 48 normalised characters, else the first 48) and `containsEcho(output, text)` (tolerant window match) per design D2
- [x] 2.2 Add `test/submitText.test.ts` with table-driven cases: plain echo; echo interleaved with CSI/OSC sequences; text wrapped over lines with padding; long text matched by its prefix; unrelated output; menu redraw that does not contain the text; text split across output chunks

## 3. Submit routine

- [x] 3.1 In `submit.ts` add `submitText(terminal, text, { echoTimeoutMs = 2000, settleMs = 400 })` against a minimal interface (`write`, `onOutput` returning an unsubscribe): observe, write text, await echo or timeout, settle, write `"\r"` separately, resolve `{ submitted }`; never write anything after a timeout; always unsubscribe
- [x] 3.2 Tests with a fake terminal: echoing terminal → text then a separate `\r`; silent terminal → text only and `submitted: false`; echo arriving in several chunks; echo arriving just before the timeout; terminal that exits mid-way
- [x] 3.3 `SessionManager.submit(id, text)`: validates the text (string, ≤ 4 KiB, no control characters), refuses when the session is not running, and serialises submissions per session; test that two concurrent submissions do not interleave

## 4. Ship and typed opening prompts

- [x] 4.1 `ship()` on a running session awaits `submit` and returns `{ session, submitted }`; add `submitted` to the Ship API result, `src/shared/types.ts`, `src/ui/api.ts` and the demo site's mock API (returns `true`)
- [x] 4.2 The typed opening prompt in `start()` (including Ship/Resume through a resume command) uses `submit` after the start-up delay instead of `write(typed + "\r")`; keep the existing test seam for the delay and add seams for the submit timings
- [x] 4.3 Update `test/terminalSessions.test.ts` and `test/terminalApi.test.ts`: stub agents that echo are submitted with a separate Enter; a stub "menu" agent that does not echo receives the text but never an Enter; Ship result carries `submitted`

## 5. Terminal protocol and panel

- [x] 5.1 `src/server/api.ts`: handle `{"type":"submit","data":…}` on the terminal socket, answer that socket with `{"type":"submitted","ok":…}`; invalid payloads are ignored like other malformed messages; update the wire-format comment
- [x] 5.2 `src/ui/quickReplies.ts`: defaults back to `submit: true`, tooltip `sends "<text>"`; update `test/quickReplies.test.ts`
- [x] 5.3 `src/ui/sessionPanel.tsx`: a response with `submit` sends `{type:"submit"}` and stays inert until `submitted` arrives (or the socket closes); on `ok: false` show the dismissible notice from design D5 above the response row; focus returns to the terminal; responses without `submit` keep using `{type:"input"}`
- [x] 5.4 Ship button: show the same notice when the API result says `submitted: false`
- [x] 5.5 `src/ui/styles.css`: the notice above the response row (token-based), terminal still refits

## 6. Verification and docs

- [x] 6.1 `bun run check` passes
- [x] 6.2 End to end in headless Chrome with stub agents: echoing agent receives text then `\r` as two writes after one click; non-echoing agent receives text only and the panel shows the notice; double click submits once; typed input unaffected
- [x] 6.3 With the preconfigured agent in a throwaway repository: a default response is sent with one click at the text prompt; at the folder-trust dialog a default response confirms nothing and the notice appears; Ship in a running session is submitted and the agent starts working. Record the results in design.md
- [x] 6.4 Update the README bullets for default responses and Ship (one click sends; when the agent does not show the text nothing is confirmed), and note that a typed opening prompt is no longer sent into a first-run dialog
