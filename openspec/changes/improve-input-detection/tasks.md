# Tasks

## 1. Output the dashboard provoked does not count

- [x] 1.1 Add `echoUntil` to `Live` and `ECHO_WINDOW_MS` (2000) in `src/server/sessions/manager.ts`; set it in `resize()`, `write()` and the writes `submit()` makes; stamp `lastOutputAt` in `onOutput` only outside the window while still relaying and buffering every chunk — verify with a `test/terminalSessions.test.ts` case where `test/fixtures/fake-agent.ts` redraws on `SIGWINCH`: after a resize the redraw reaches the viewer and the scrollback, and `lastOutputAt` is unchanged
- [x] 1.2 Test that output continuing past the window after input counts again (fake agent prints for longer than the window after Enter) and that keystroke echo alone does not move `lastOutputAt`

## 2. State file and environment

- [x] 2.1 Add `statePath(id)` to `SessionStore` (`src/server/sessions/store.ts`, file `agent-state` in the record folder, id validated) and make sure deleting and pruning a record removes it — verify with a store test
- [x] 2.2 Set `SPEC_CONTROL_STATE_FILE` to the state-file path in `SessionManager.start()`, the one place every launch passes through (change sessions, console, project console, integration, resume) — verify with the fake agent printing its environment
- [x] 2.3 In `start()`, create the record folder and remove any leftover state file before spawning; record `startedAt` on `Live` — verify that a resumed session whose old file said `waiting` starts without it

## 3. Reading reports

- [x] 3.1 Implement the terminal-reply filter of design D5 as a pure function and update `lastUserInputAt` in `write()` only for input that is not entirely terminal replies; `submit()` always updates it — verify with unit tests for focus in/out, cursor reports, DA/DSR, mode and OSC colour replies, mixed input and plain keystrokes
- [x] 3.2 Add `SessionManager.readReports()`: `lstat` each running session's state file, read at most 64 bytes when `mtimeMs` changed, recognise `waiting`/`working` (trimmed, case-insensitive), and set or clear `Session.waitingReportedAt` (new optional field in `src/shared/types.ts`, not persisted) by the currency rule of design D4 — verify with tests for waiting, working, unrecognised content, oversize file, directory, symbolic link, missing file
- [x] 3.3 Call `readReports()` in the `GET /api/sessions` route of `src/server/api.ts` before listing — verify with a route test: the fake agent writes `waiting`, the next list carries `waitingReportedAt`; a resize and a focus report leave it; a keystroke or a shortcut submission clears it; a `working` report clears it
- [x] 3.4 Confirm `meta.json` never contains `waitingReportedAt` (test reads the stored record)

## 4. UI

- [x] 4.1 In `sessionBadge` (`src/ui/sessionState.ts`), show the waiting report first for a running session: label `waiting for you · <duration>`, warning tone, title naming the agent and how long ago it reported — verify with badge unit tests next to the existing ones, including that ended and failed sessions ignore the field and that the words differ from **may need you** and **working**
- [~] 4.2 Check every place the badge is rendered (card chip, Console tab, project console button, sessions list) shows the new state with the same prominence — verify by running `bun run dev` with a fake agent writing the file
- [x] 4.3 Give one demo session in `src/ui/demo/demoSessions.ts` a waiting report so the demo shows the state — verify `test/demoSessions.test.ts` passes and covers it

## 5. Docs and release notes

- [~] 5.1 Extend the agent-sessions section of `src/ui/helpContent.tsx`: what the badge can and cannot know, `SPEC_CONTROL_STATE_FILE`, the two words, the example `echo waiting > "$SPEC_CONTROL_STATE_FILE"` for a hook that runs when the agent ends a turn or asks for permission and `echo working > …` when a prompt is submitted, and that the hook must be able to write under `~/.spec-control/` — verify the help test still passes and the section reads correctly in `bun run dev`
- [x] 5.2 Mention `SPEC_CONTROL_STATE_FILE` in the agent-sessions part of `README.md` and in `CLAUDE.md`'s agent-sessions notes (the echo window and the state file are the two inputs to the badge) — verify by reading the diff
- [x] 5.3 Add a What's new entry at the top of `src/ui/changelog.ts`: opening a console no longer wakes the badge, and agents can report that they wait for you — verify the changelog test passes
- [x] 5.4 Run `bun run check` and `bun run build`, then start `dist/spec-control` with a fake agent and confirm the variable is set and a report shows on the board
