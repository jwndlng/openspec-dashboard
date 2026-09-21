## 1. Terminal stream through the API interface

- [x] 1.1 In `src/ui/api.ts`, add `TerminalHandlers` (`onOpen`, `onData(bytes: Uint8Array)`, `onExit`, `onClose`), `TerminalConnection` (`send(message)`, `close()`) and `openTerminal(sessionId, handlers)` to the `Api` interface and the forwarding `api` object
- [x] 1.2 Implement `httpApi.openTerminal` by moving the WebSocket code out of `src/ui/sessionPanel.tsx` unchanged (URL from `terminalSocketUrl`, binary frames → `onData`, JSON `exit` → `onExit`, close → `onClose`, `send` only while open)
- [x] 1.3 Make `sessionPanel.tsx` use `api.openTerminal`; xterm, fit, resize, quick replies and the status note stay in the panel
- [x] 1.4 Unit-test the HTTP implementation against a fake `WebSocket` global: it opens exactly `terminalSocketUrl(id)`, maps the three message kinds, and does not send before open; run the existing terminal and session tests to confirm the product is unchanged

## 2. Transcripts and player

- [x] 2.1 Create `src/ui/demo/transcripts.ts` with the `Step` type (`out`/`after`, `await: "input"`, `exit`, optional `work` milestone) and hand-written transcripts for `draft`, `implement`, `implement` with a permission question, `archive`, `resume` and `ship`, using only the placeholders `{change}`, `{branch}`, `{path}` for names; first line of every playback is the dim "demo recording: nothing runs on this page" notice
- [x] 2.2 Implement `playTranscript(steps, { startedMsAgo, values, handlers, clock })`: fast-forward of elapsed steps as one scrollback write, scheduled remainder, pause at `await` until an input containing a newline, echo of other input, `exit` → `onExit` + `onClose`, `close()` cancels timers, work milestones reported through a callback
- [x] 2.3 Tests with an injected clock: fast-forward position, live continuation, await/resume by typed Enter and by quick-reply input, echo, exit, close leaves no pending timers, placeholders substituted everywhere

## 3. Simulated sessions in the demo API

- [x] 3.1 Create `src/ui/demo/demoSessions.ts`: seed sessions and an orphan worktree derived from `buildSample(now)` (changes that live in worktrees), covering running-with-output, running-but-quiet at a question, exited with 3 uncommitted, exited with 2 unpushed and stale, pushed, merged, clean, failed to start, and a worktree without a session record; all times as offsets from `now`
- [x] 3.2 In `sampleData.ts`, enable `agentSessions` with the single fictional profile `Demo Agent` (`demo-agent`), using the project's preset starter prompts
- [x] 3.3 In `demoApi.ts`, replace the refusals with the state machine of design D3: `sessions`, `openSession` (validated with `availableActions`, one open session per change), `openTerminal` (plays from the session's position, ends the session on exit), `resumeSession`, `shipSession` (shippable work only → `pushed`), `closeSession`, `worktreeStatus`, `removeWorktree`, `deleteSession`; refusal reasons reuse the dashboard's wording; returned objects are copies
- [x] 3.4 Seed shared-config state: profiles `base` and `security`, `sharedConfig` on four sample repositories with one `outdated`, and the demo API's carried-profile map initialised to match
- [x] 3.5 Demo API tests: first-load content; start (and same session on repeat); unavailable action refused; terminal exit ends the session; resume; Ship refused when not shippable and ending in `pushed`; close with safe and unsafe removal; orphan worktree removal; delete; sessions off in config hides everything; a fresh instance is back to the seed; callers cannot mutate state through returned objects

## 4. Synthetic-data guard rails

- [x] 4.1 Extend the real-home detector's inputs in `test/demoData.test.ts` to the serialized seed sessions and the text of every transcript
- [x] 4.2 Add checks for those inputs that fail on e-mail addresses, on `http(s)://` URLs and dotted host names other than the project's repository and pages hosts; add positive tests proving each check catches a planted example
- [x] 4.3 Assert consistency: every seeded session's repository, change, branch and worktree path exists in the sample snapshot, every path is under `/home/demo/`, and every work status and session state required by the spec occurs at least once
- [x] 4.4 Assert times are relative: building the seed at two different `now` values shifts every timestamp by the same amount
- [x] 4.5 Keep `test/demoBundle.test.ts` green and extend it: the product bundle contains no transcript text and no seed session ids; the demo bundle contains no real-looking path

## 5. Banner, docs, verification

- [x] 5.1 `src/ui/demo/banner.tsx`: add that agent sessions are simulated
- [x] 5.2 `README.md` / demo section: what the demo simulates, that transcripts are written by hand and must never be captured output, and how the checks enforce it
- [x] 5.3 `bun run check`, `bun run build` and `bun run build:demo`
- [x] 5.4 Open the built demo in a browser: first screen shows running and work-status badges, Open work and carried profiles; open a running session (fast-forward, then live); answer the question with a quick reply; Ship an uncommitted session to `pushed`; refuse an unsafe removal; remove the merged worktree; switch sessions off and on; reload restores the seed; both themes; no network requests in the page's log
- [x] 5.5 Before merging, implement in the demo any `Api` operation that landed on main meanwhile (the type checker names it) — done: `promptSession` had landed; the demo types the starter's prompt into the open terminal and leaves Enter to the visitor
