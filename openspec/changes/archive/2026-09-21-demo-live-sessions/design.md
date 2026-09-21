## Context

The demo is the real UI built with a different entry point (`src/ui/demo/main.tsx`) that installs an in-memory `Api` (`createDemoApi`) over a generated sample (`sampleData.ts`). The `demo-site` spec requires the mock to implement every operation of the UI's `Api` interface, the data to be synthetic and under `/home/demo/`, dates to be relative to load, and nothing to persist.

For agent sessions the demo currently opts out: `agentSessions` is the disabled default, `sessions()` answers with empty lists and the mutating session operations reject. The session UI (`sessions.tsx`, `sessionPanel.tsx`, `sessionState.ts`) is driven by three things: the config (`agentSessions.enabled`, agent profiles), the `sessions()` response (`sessions`, `agents`, `worktrees` with a `WorkStatus` each), and — for the terminal — a WebSocket the panel opens itself via `terminalSocketUrl(id)`, speaking a tiny protocol: binary frames are terminal bytes, a JSON `{type:"exit"}` ends it, and the client sends `{type:"input"|"resize"}`. A static page has nothing to connect to, so that WebSocket is the one place where the demo cannot currently stand in.

Project rules that shape this: nothing from a real repository or machine may enter the repo (invariant 7) — that includes terminal output, which must therefore be written, never captured; agents are vendor-neutral profiles; no network at runtime; the product bundle must not contain demo data.

## Goals / Non-Goals

**Goals:**
- A visitor sees, without doing anything, cards with running sessions, work-status badges, the Open work list and carried shared-config profiles.
- A visitor can open a session and watch a believable terminal, answer a question, press Ship, close a session and remove a worktree — and see the UI react as the real app would.
- Provably synthetic: the checks that guard the sample also guard sessions and transcripts, and get stricter.
- The product is unchanged in behaviour; the only product-side edit is where the terminal stream comes from.

**Non-Goals:**
- Emulating an agent: no command interpretation, no free-form conversation. Typed input is acknowledged, not understood.
- Simulating the scanner reacting to a session (tasks getting ticked on the card as the transcript plays). Tempting, but it couples transcripts to sample changes line by line; revisit later.
- Recording real sessions, or any tooling to convert a capture into a transcript.
- Per-visitor persistence, deep links into a session's terminal position, or sound.

## Decisions

### D1: The terminal stream becomes an `Api` operation
`Api.openTerminal(sessionId, handlers): TerminalConnection`, with `handlers = { onOpen, onData(bytes), onExit, onClose }` and `TerminalConnection = { send(message), close() }` where `message` is the existing `{type:"input",data}` / `{type:"resize",cols,rows}`. `httpApi.openTerminal` contains exactly the WebSocket code that lives in `sessionPanel.tsx` today; the panel keeps owning xterm, fit and quick replies and only swaps `new WebSocket(...)` for `api.openTerminal(...)`. Because it is on the interface, the type checker forces the demo to implement it — which is the mechanism the `demo-site` spec already relies on.

*Alternatives considered:* (a) stubbing `WebSocket` globally in the demo entry point — invisible coupling to a wire protocol, and it would shadow a browser global; (b) a prop on the panel — the panel is created deep inside the session UI, and every other backend difference already goes through `Api`.

### D2: Transcripts are data; one small player turns them into a stream
`src/ui/demo/transcripts.ts` exports named transcripts as arrays of steps:

```ts
type Step =
  | { out: string; after?: number }        // bytes to print (ANSI allowed), after a delay in ms
  | { await: "input"; prompt: string }     // print the prompt and stop until the visitor sends input
  | { exit: number };                      // end of the process
```

One player (`playTranscript(steps, { startedMsAgo, handlers, clock })`) implements: **fast-forward** — everything whose cumulative delay lies before `startedMsAgo` is written at once as scrollback, so reopening a running session does not restart it; **live** — remaining steps are scheduled with their delays; **await** — prints the prompt and pauses; any `input` message containing a newline resumes; other input is echoed — that includes the quick-reply buttons, which by the dashboard's design type their text and leave Enter to the user; **exit** — calls `onExit` then `onClose`. `close()` cancels timers. The clock is injectable, so tests run the player synchronously.

Transcripts exist per starter (`draft`, `implement`, `archive`), one with a permission question for the "waiting" showcase, one `ship`, and a short `resume`. They reference only the session's own change name, branch and `/home/demo/...` worktree path through placeholders (`{change}`, `{branch}`, `{path}`), never literal names, so one transcript serves any sample change. The fictional agent prints as `demo-agent`; nothing imitates a particular vendor's UI.

### D3: Session state lives in the demo API as a small state machine
`createDemoApi` holds `sessions: DemoSession[]` (a `Session` plus `transcript`, `startedAt`, `position`, and the `work` status of its worktree) and `orphans: SessionWorktree[]` (worktrees without a session record). Operations:

| Operation | Effect |
|---|---|
| `sessions()` | sessions, the one demo agent as `available: true`, and `worktrees` derived from sessions + orphans |
| `openSession` | validates repo/change/action against the current snapshot like the server (`availableActions`), returns the existing open session for that change or creates a `running` one with the starter's transcript and work `clean` → `uncommitted` once the transcript passes its first "edit" step |
| `openTerminal` | plays the session's transcript from its position; on `exit` the session becomes `exited` |
| `resumeSession` | `running` again with the `resume` transcript |
| `shipSession` | refused unless work is shippable; appends the `ship` transcript; when it completes the work status becomes `pushed` |
| `closeSession(id, removeWorktree)` | ends playback, `exited`; removal allowed only for `clean`/`merged`/`pushed`-and-merged work, otherwise `{ removable: false, reason }` — the same rule and wording the server uses |
| `worktreeStatus`, `removeWorktree`, `deleteSession` | consistent with the above |

Work status is a field, not git: transitions happen at transcript milestones (steps can carry `work: WorkStatus`). `sessionState.ts` and the rest of the UI are untouched — they already render whatever `sessions()` returns.

### D4: Seed data is derived from the sample, in one place
`src/ui/demo/demoSessions.ts` builds the initial sessions from `buildSample(now)`: it picks sample changes that live in worktrees (they already have a branch and a `/home/demo/...-worktrees/...` path) so that session worktree paths, branches and change names cannot disagree with the board. Seeded set: one running and printing (implement), one running but quiet for 12 minutes at a permission prompt, one exited with 3 uncommitted files, one exited with 2 unpushed commits for 2 days (stale), one `pushed`, one `merged` (removal offered), one failed to start, and one orphan worktree with uncommitted files. All timestamps are offsets from `now`.

The sample config sets `agentSessions` to enabled with a single profile `{ id: "demo-agent", name: "Demo Agent", command: ["demo-agent", "{prompt}"], prompts: the project's preset starter prompts }`. Seeded shared-config state: profiles `base` and `security`; `RepoSnapshot.sharedConfig` on four sample repositories, one with `base` outdated; the demo API's existing `carried` map is initialised to match so that a preview/apply from Settings stays consistent.

### D5: Synthetic-data checks get stricter and cover the new data
The existing detector for real-looking home directories runs over the serialized sample. It is extended to the serialized seed sessions and to every transcript's text, and three patterns are added for those inputs: e-mail addresses, `http(s)://` URLs whose host is not the project's repository or pages host, and dotted host names other than those. A transcript has no need for any of them, so the rule is "none", not an allow-list to maintain. The bundle tests keep asserting that the *product* bundle contains neither the demo marker nor sample or transcript strings; transcripts are imported only from the demo entry point's module graph.

### D6: Say that it is a recording
The demo banner gets one clause ("agent sessions are simulated"), and the scripted terminal prints a first dim line `— demo recording: nothing runs on this page —`. A visitor must not believe a process runs in their browser tab or that typing reaches anything.

## Risks / Trade-offs

- [A transcript that looks like a specific vendor's tool, or that someone later "improves" by pasting real output] → D2 keeps it generic and placeholder-driven; D5 makes pasted real output fail `bun run check` for the most likely leaks (paths, e-mails, URLs, hosts); the README section on the demo states the rule.
- [The seam changes product code that is security-sensitive (the terminal)] → It moves the WebSocket code verbatim into `httpApi.openTerminal`; the server and its `webSocketRefusal` guard are untouched; the existing terminal tests keep passing, and a unit test asserts the HTTP implementation opens exactly `terminalSocketUrl(id)`.
- [Timers in the player leak or fire after the panel closed] → `close()` cancels them; covered by a test with a fake clock.
- [Demo state machine drifts from the server's rules] → It reuses the shared pure functions (`availableActions`, `SHIPPABLE_WORK`) rather than re-deriving them; refusal reasons reuse the same wording.
- [Bundle size of the demo grows] → Transcripts are a few kilobytes of text; xterm is already in the UI bundle.
- [Other in-flight changes add `Api` operations] → The type checker names the missing demo implementation; each is a one-line stub or a small in-memory version.

## Migration Plan

Demo-only plus one refactor in the panel. Ship behind nothing; the demo site updates on the next publish from main. Rollback is reverting the commit.

## Open Questions

- Should a playing Implement transcript also tick tasks on its card (see Non-Goals)? Deferred.
