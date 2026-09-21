## Context

Text reaches an agent's pseudo-terminal in three dashboard-initiated ways today:

| Path | Where | How it is written |
|---|---|---|
| Ship in a running session | `SessionManager.ship` | `proc.write(prompt + "\r")`, one write |
| Typed opening prompt (no `{prompt}` in the command; Ship/Resume via a resume command) | `SessionManager.start` | after `TYPE_PROMPT_DELAY_MS`: `proc.write(typed + "\r")`, one write |
| Default responses | `TerminalView` → WebSocket `input` | text only, no Enter (`agent-console-quick-replies` D6) |

Observed with the preconfigured agent (Claude Code 2.1.x):

- A short text plus `\r` in one write **submits** (`No, stop here\r`, verified in `agent-console-quick-replies`).
- The Ship prompt (≈250 characters) plus `\r` in one write **only fills the input box**. Working theory: a burst of that size is handled as a paste, and a carriage return inside a paste is content, not a key press. Task 1.1 confirms this before anything is built on it.
- At a **selection menu** (folder-trust dialog, permission prompt) typed text is ignored and Enter confirms the highlighted option: `Yes, go ahead` + Enter selected `No, exit`. This is why default responses were made type-only.

Constraints: the dashboard must stay agent-neutral (any interactive terminal program is a valid agent) and "MUST NOT parse, summarise or filter the agent's output" (`agent-sessions`: *A session is the agent's own terminal*).

## Goals / Non-Goals

**Goals:**
- One click on Ship or a default response sends it, with the preconfigured agent and with any agent that shows typed text.
- Never confirm a selection menu by accident.
- When a text could not be submitted, say so; never fail silently.
- One implementation for all three paths.

**Non-Goals:**
- Knowing what the agent is asking, or choosing responses by context.
- Agent-specific integrations (menu detection by screen scraping, vendor protocols).
- Changing keystroke input, session lifecycle, worktrees or the config format.
- Making default responses configurable (still deferred).

## Decisions

### D1: Submit = type, confirm the echo, then press Enter separately
`submitText(terminal, text, options)`:

1. Start observing the terminal's output, then write `text` (no Enter).
2. Wait until the output produced **after** the write contains the text (see D2), at most `echoTimeoutMs` (default 2000 ms).
3. If it appeared: wait `settleMs` (default 400 ms; the spike only proves 2.5 s, task 6.3 checks the default) so the agent has finished handling the input, write `"\r"` as its **own** write, resolve `{ submitted: true }`.
4. If it did not appear: write nothing further, resolve `{ submitted: false }`. The text stays typed, exactly like today's type-only behaviour.

Why this is safe at a menu: a selection menu does not render typed characters, so step 2 times out and Enter is never sent. Why this fixes Ship: Enter arrives as a separate key press after the text has been consumed, so it cannot become part of a paste.

*Alternatives considered:*
- *Always press Enter, separately and after a fixed delay.* Fixes Ship, but re-opens the menu hazard for every control — rejected; it is exactly what verification ruled out.
- *Two-step button ("type", then "↵ Send").* Safe, but it is the extra step the user asked to remove.
- *Detect menus from the screen (look for `❯`, "Enter to confirm").* Agent-specific and brittle — rejected.
- *Type in small chunks to avoid paste detection and keep a trailing Enter in the same stream.* Solves only Ship, depends on an agent's paste heuristics, and does nothing about menus.

### D2: What counts as "the agent showed the text"
Terminal UIs redraw with escape sequences, wrap long input across lines and pad with spaces, so a byte-for-byte search fails. Matching therefore works on a normalised form:

- decode the output observed since the write as UTF-8, **strip ANSI/VT escape sequences** (CSI, OSC, single-character escapes), then **remove all whitespace**;
- normalise the typed text the same way (whitespace removed);
- the **probe** is the whole normalised text when it is at most 48 characters, otherwise its first 48 characters. A prefix is enough to know the input box took the text, and it is robust against agents that truncate or scroll long input;
- the text counts as shown when some **window** of the normalised output, at most a quarter longer than the probe, contains at least 85 % of the probe's characters in order (longest common subsequence). The tolerance is required, not a nicety: terminal UIs redraw only the screen cells that changed, so when the input box already holds text the echo arrives with holes (spike, below: `Cmpute 19 times 3 … thedigits only … Thissetenc`). The narrow window keeps this far from "the letters occur somewhere in the output": for `Yes, go ahead` it means 10 of 11 characters, in order, within 14 characters.

Only output produced after the write is considered, the observation ends with the match or the timeout, and nothing from it is stored, logged or sent to the browser. Matching looks at no more than the last 4 KiB of normalised output and is re-evaluated as output arrives. All of this lives in pure functions (`stripAnsi`, `normalise`, `echoProbe`, `containsEcho`) with table-driven tests, including wrapped and ANSI-interleaved fixtures.

Line-based agents (a REPL in cooked mode) pass as well: the terminal's own echo shows the text.

### D3: One server-side implementation; default responses go through it
The routine needs the terminal's output, which the server already has (`attach` fan-out). Rather than duplicating it in the browser, the terminal WebSocket gains:

- client → server: `{"type":"submit","data":"<text>"}` — runs `SessionManager.submit(id, text)`;
- server → client (text frame, to the socket that asked): `{"type":"submitted","ok":true|false}`.

`{"type":"input"}` is unchanged and remains the only path for keystrokes; it is never observed. `submit` accepts only a string of bounded length (4 KiB) without control characters — it is for sentences, not key sequences — and is subject to the same origin guard as the rest of the socket (run-agent-actions D18).

`SessionManager.submit` serialises submissions per session (a second one waits for the first to finish), so two clicks cannot interleave their text and Enter.

### D4: Ship and typed opening prompts use the same routine
- `ship()` on a running session: `await this.submit(id, prompt)` and return `{ session, submitted }`.
- Typed opening prompt in `start()`: after the existing start-up delay, `submit` instead of `write(typed + "\r")`. If the agent is not yet showing a prompt (or shows its trust dialog), the text is simply not submitted — which is the correct outcome: previously the blind Enter would have confirmed that dialog's highlighted option. The session gets a transient note (`session.error` is not used; see D5).
- Ship/Resume through a resume command follow the same path.

`POST /api/sessions/:id/ship` returns the session plus `submitted: boolean` (additive, type `ShipResult`). When Ship starts an ended agent, `submitted` is `true`: the prompt is handed to the starting agent (as its argument, or submitted once it has started) and the terminal shows how that went. The demo site's mock API offers no sessions and keeps rejecting Ship; only its return type follows.

### D5: The user always sees the outcome
- Default responses: on `{"type":"submitted","ok":false}` the panel shows a dismissible notice above the response row for a few seconds: *"The agent did not show the text — it may be showing a menu. The text was typed but not sent; nothing was confirmed."* On `ok: true` nothing is shown (the terminal itself shows the agent reacting). The clicked button stays inert until the result arrives (replaces the fixed 600 ms guard).
- Ship: the same notice, driven by the API result.
- Typed opening prompt: there may be no panel open; nothing is surfaced beyond the terminal itself, where the typed-but-unsent text is visible. (A session-level "needs attention" signal is out of scope.)

### D6: Default responses submit again
`DEFAULT_QUICK_REPLIES` go back to `submit: true`, and the panel sends `{type:"submit"}` for them; a response with `submit: false` still goes through `{type:"input"}` as plain typed text. Tooltip: `sends "<text>"`. This **replaces** D6 of `agent-console-quick-replies` ("type, do not submit"): that decision was right for a blind Enter, and the echo check removes the blindness.

### D7: The exception to "do not interpret the output" is stated, and kept minimal
The spec gains an explicit sentence: the only thing the dashboard may derive from the agent's output is whether text **it typed itself** appeared, for the purpose of deciding whether to press Enter. It must not classify the agent's state from it, and must not retain it. This keeps the principle intact for everything a user would call "reading what the agent said".

## Risks / Trade-offs

- [The paste theory for Ship] → **Confirmed** by the spike (see Spike results): a long prompt with its Enter in one write is not submitted; text, pause, separate Enter is.
- [False negative: the agent shows the text in a form the matcher misses (heavy truncation, a "[pasted text]" placeholder, no echo at all)] → Falls back to today's behaviour plus a notice; never worse than now. The 48-character probe and whitespace-free matching cover wrapping and truncation; the timeout is generous.
- [False positive: unrelated output after the write happens to contain the probe while a menu is open] → Requires the agent to print the exact sentence in the two seconds after the click while showing a menu; accepted as negligible. Only post-write output is considered.
- [Characters of the typed text act as hotkeys in some agent's menu (digits, `y`/`n`)] → Already true for today's type-only behaviour and for a user typing; the defaults contain no digits. Documented.
- [Latency: a response is sent up to ~150 ms after the echo, not instantly] → Imperceptible next to an agent's response time.
- [A busy agent that queues typed input will queue the submission] → Same as typing it by hand; intended.
- [Opening prompts that previously "worked by accident" (blind Enter confirming a first-run dialog) now stay unsent] → Correct and safer; mentioned in the README.

## Migration Plan

1. Archive `agent-console-quick-replies` so its requirement exists in the main spec (prerequisite for this delta).
2. Ship server and UI together (single binary). No config or data migration. Rollback is the previous binary.

## Spike results (task 1.1)

Preconfigured agent (Claude Code 2.1.x), throwaway repository and dashboard home, driven over the terminal WebSocket with plain `input` messages; answers chosen so they cannot occur in the prompt (small multiplications):

| Case | Written | Result |
|---|---|---|
| (a) | 264-character prompt **+ `\r` in one write** | Text fills the input box, **not submitted**. A lone Enter 18 s later did not submit it either. This is the Ship problem; the `\r` inside the burst is taken as pasted content. |
| (b) | 264-character prompt, 2.5 s pause, **`\r` as its own write** | **Submitted** (together with the text still in the box from (a); the agent answered both). |
| (c) | 32-character text + `\r` in one write | Submitted — short input is not treated as a paste, which is why the earlier default-response test passed. |

Echo: with an empty input box the first 48 normalised characters appeared verbatim within 2.5 s, although the agent positions text with cursor movement instead of spaces (whitespace-free matching is necessary). With text already in the box the echo was **partial** — only changed screen cells are redrawn — which is why D2 matches tolerantly within a narrow window.

Note for D1: the routine never produces case (a)'s state (text and Enter are always separate writes), so the "lone Enter after a burst that contained `\r`" oddity does not affect it.

## Verification (tasks 6.2, 6.3)

- **Stub agents in headless Chrome** (echoing agent; `--menu` agent in raw mode that reports any Enter it receives): tooltips read `sends "…"`; a click keeps the button inert until the server answers; the echoing agent received the submitted line; a double click submitted once; typing by hand afterwards still worked and focus was in the terminal; the menu agent was **not** confirmed, the panel showed the notice, the session kept running and the notice could be dismissed.
- **Preconfigured agent** (Claude Code 2.1.x, throwaway repository and home, over the terminal socket):
  - at the folder-trust dialog a default response was answered `submitted: false`; the dialog stayed, the session kept running;
  - at the text prompt a default response was answered `submitted: true` after ≈0.5 s (echo plus the 400 ms settle). The agent's reply to it was not captured by the script (cursor-positioned output), so this step rests on the server's answer and on the identical mechanism in the next step;
  - Ship in the running session, with a 260-character harmless ship prompt in the throwaway profile: `submitted: true` after ≈0.5 s, and the agent worked on the prompt (it answered the calculation it contained). The default `settleMs` of 400 ms is sufficient; the spike had only proven 2.5 s.

## Not in this change

- The **next step** buttons added by `session-tabs-and-next-steps` type a starter prompt into the running session and deliberately never press Enter (`SessionManager.prompt`). They are the same class of control and can adopt `submit` with a one-line change, but their requirement belongs to that change, which is not archived yet; left for a follow-up.

## Open Questions

- Should a typed-but-unsent opening prompt raise a visible signal on the card (e.g. reuse the `quiet` hint sooner)? Left out; revisit if it happens in practice.
