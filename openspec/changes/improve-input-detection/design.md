## Context

`SessionManager.onOutput` (`src/server/sessions/manager.ts`) stamps `session.lastOutputAt` on every chunk the pty
produces, and `sessionBadge` (`src/ui/sessionState.ts`) turns that into **working** or **may need you** after
`NEEDS_YOU_AFTER_MS` (20 s). Opening a console (`src/ui/sessionPanel.tsx`) fits xterm.js, sends
`{type:"resize"}` and focuses the terminal; an agent that enabled focus reporting gets `ESC [ I` through the
`{type:"input"}` frame, and any full-screen agent redraws on `SIGWINCH`. Those redraws are indistinguishable from work
by time alone — hence the bug in proposal.md. The spec forbids reading the output to tell them apart, and anything
vendor-specific.

The sessions list is polled every 3 s by the UI (`POLL_MS` in `src/ui/sessions.tsx`) through `GET /api/sessions`,
which returns `sessions.list()`. Session records live in `~/.spec-control/sessions/<id>/` (`store.ts`).

## Goals / Non-Goals

**Goals:**
- Viewing a session never changes its badge.
- An agent whose hooks can run a shell command can say "I am waiting for you" reliably, with no agent-specific code in
  the dashboard.

**Non-Goals:**
- Writing hook configuration for any agent, or shipping per-agent snippets in presets. Help shows one generic shell line.
- Telling a permission prompt from an end of turn: both are `waiting`.
- Notifications (sound, OS notification) when a report arrives — a possible follow-up.
- Reporting anything but the two words (no progress, no message text).

## Decisions

### D1. Echo window instead of output inspection
`Live` gains `echoUntil`. `resize()`, `write()` and the writes `submit()` makes set it to `now + ECHO_WINDOW_MS`
(2000 ms, under the spec's 3 s ceiling); `onOutput` relays and buffers every chunk as today but stamps
`lastOutputAt` only when `now >= echoUntil`. A burst of resizes from `ResizeObserver` keeps extending the window.

*Alternatives:* ignore output only while a viewer is attached (wrong — a user watching a working agent would see
"may need you"); compare the redraw to the scrollback (that is reading the output, forbidden); have the client suppress
resizes that do not change the size (helps, but focus reports and the first attach still trigger redraws). The window
costs at most 2 s of lag on a genuinely working agent the user is interacting with, which the 20 s threshold absorbs.

### D2. The state file is in the session's record folder, named by an environment variable
`SessionManager.start()` — the one place every launch passes through — sets `SPEC_CONTROL_STATE_FILE` to
`<sessionsDir>/<id>/agent-state` on top of the environment `agentEnv` built, so it also overrides a value the
dashboard itself inherited. `SessionStore` owns the path (`statePath(id)`, same id validation as the other
files) and removes it with the record. `start()` removes a leftover file before spawning, so `restart`/resume never
inherit a report. The folder already exists then: every caller saves the record first.

*Alternatives:* a file in the worktree (`.INPUT_NEEDED`, as the prompt suggested) — rejected: it would be a dashboard
artefact inside a tracked repository's working tree, could be committed by the agent, and does not exist for consoles
and in-place sessions in the same way; a local HTTP endpoint the hook calls — rejected: it would need a token handed
to the agent and a mutating route outside the same-origin guard (invariant 2a); a `spec-control signal` subcommand —
not needed, `echo waiting > "$SPEC_CONTROL_STATE_FILE"` works in every shell and hook system, and the binary need not be
on `PATH`.

### D3. Reports are read on demand, by modification time
`SessionManager.readReports()` runs in the `GET /api/sessions` route before `list()`. For each running session it
`lstat`s the file; when it is a regular file whose `mtimeMs` changed since the last read, it reads at most 64 bytes and
keeps `{ state, at: mtime }`. No `fs.watch` (unreliable across platforms and in the compiled binary) and no timer of
its own: the UI's 3 s poll already bounds the delay, and nothing runs while nobody looks.

### D4. Currency is decided on the server; the UI gets only the waiting report
`Live` gains `startedAt` and `lastUserInputAt`. A report is current when `at > startedAt` and
`at > lastUserInputAt`. `Session` gains one optional field, `waitingReportedAt?: string`, set by `readReports()` only
while the current report is `waiting` and cleared otherwise; it is not persisted in `meta.json` (a restarted dashboard
has no running sessions). `sessionBadge` checks it first for a running session:
`{ icon: "◆", label: "waiting for you · 3m", tone: "warning", title: "<agent> reported 3m ago that it is waiting for you" }`
— the same weight as **may need you**, different words. Keeping the decision on the server means the UI never needs
the input timeline and the demo only has to set one field.

### D5. User input versus terminal-generated input
`write()` (keystrokes from the WebSocket) updates `lastUserInputAt` unless the data, after removing a fixed list of
terminal replies, is empty. The list is: focus in/out (`ESC [ I`, `ESC [ O`), cursor position reports
(`ESC [ <n> ; <n> R`), device attribute and status replies (`ESC [ ? … c`, `ESC [ > … c`, `ESC [ 0 n`), mode reports
(`ESC [ ? … $ y`) and OSC colour replies (`ESC ] 1x ; rgb:… BEL|ST`). This inspects the dashboard's *input*, never the
agent's output. Anything not on the list counts as user input, so an unknown reply errs towards today's behaviour
(the report goes stale and the silence heuristic applies). `submit()` always counts as user input. Resizes never do.
Both kinds still open the echo window (D1).

## Risks / Trade-offs

- [An agent's sandbox may forbid writing under `~/.spec-control/`] → hooks normally run outside the agent's sandbox;
  Help says the file must be writable from wherever the hook runs, and nothing breaks if it is not.
- [A hook writes `waiting` but nothing ever writes `working` when the agent resumes on its own] → user input already
  ends a report; an agent resuming without input is rare, and Help recommends also writing `working` on prompt submit.
- [The echo window hides 2 s of real output while the user types into a working agent] → only delays the **working**
  state; the threshold is 20 s.
- [A terminal reply not in D5's list] → treated as user input: a waiting report goes stale on console open, i.e.
  today's behaviour for that terminal. The list is covered by a unit test and easy to extend.

## Migration Plan

None. Existing sessions keep working: the variable appears for sessions started after the upgrade; no stored format
changes.
