# Tasks

## 1. Types and configuration

- [x] 1.1 In `src/shared/types.ts`, make `Session` the union of `ChangeSession` (with `repoId`, `change`, `action`) and `ConsoleSession` (`console: true`, none of them), with an `isConsole()` guard and `changeSessions()`; narrow every consumer until `bun run typecheck` (via `bun run check`) passes with no behaviour change for change sessions
- [x] 1.2 Add `consoleDir()` (`<dashboardHome>/console`) to `src/server/paths.ts`; verify with a case in `test/paths.test.ts` that it follows `OPENSPEC_DASHBOARD_HOME`
- [x] 1.3 Add optional `agentSessions.consoleDir` to the config schema (shape only: absolute after `expandPath`) and, in the `PUT /api/config` handler (via `consoleFolderProblem` in `src/server/sessions/consoleFolder.ts`), refuse with `400` a folder that does not exist or equals/lies inside a tracked repository (compared after `realpath`), naming the repository; verify in `test/config.test.ts` / `test/terminalApi.test.ts` / `test/consoleSession.test.ts` that a config with a since-deleted folder still loads, and that relative, missing and inside-a-repo folders are refused while a parent of repositories is accepted

## 2. Server: starting and controlling the console

- [x] 2.1 Add a no-prompt launch (`launchWithoutPrompt`) next to `launchCommand` in `src/server/sessions/agents.ts` that drops every argument containing `{prompt}` and types nothing; verify in `test/consoleSession.test.ts` with `claude`, `{prompt}` → `claude` and `my-agent-cli`, `--task={prompt}`, `--color` → `my-agent-cli`, `--color`
- [x] 2.2 Implement `SessionManager.openConsole()`: enabled check (403), return the running console, resolve and re-check the folder (create only the default; 409 otherwise), default agent availability (503), then the shared `start()`; verify in a new `test/consoleSession.test.ts` with `fake-agent.ts` in a temp home that it starts in `<home>/console`, that a second call returns the same session with one process, and that disabled/missing-agent/bad-folder are refused without a process
- [x] 2.3 Make `prepareRestart`/`restart`/`resume` handle a console session (no repository lookup, no `isCleaningUp`, no worktree, "another console running" check) and make `close` ignore `removeWorktree`; verify resume restarts the resume command in the same folder and close ends only the agent, in `test/consoleSession.test.ts`
- [x] 2.4 Refuse `ship`, `prompt` and `worktreeStatus` with `409` for a console session and skip activity reporting for it; verify in `test/consoleSession.test.ts` that nothing is typed on a refused Ship and no activity event is written
- [x] 2.5 Verify with a test that no git command runs for console open/resume/close (a PATH-shadowing `git` that records calls) and that shutdown records the console as ended because the dashboard was stopped

## 3. API

- [x] 3.1 Add `POST /api/console` to `sessionRoutes` in `src/server/api.ts` (201 new, 200 existing), under `crossSiteRefusal`; verify in `test/terminalApi.test.ts` the open-twice, disabled (403) and cross-site (403) scenarios, and that `GET /api/sessions` returns the console marked `console: true`
- [x] 3.2 Verify in `test/terminalApi.test.ts` that the terminal WebSocket attaches to a console session under the unchanged `webSocketRefusal`, and that ship/prompt/worktree routes return `409` for it and a console folder inside a repository is refused on `PUT /api/config`

## 4. UI

- [x] 4.1 Export `TerminalView` (which carries the shortcut row), `Copy` and a `useTerminalGeneration` hook from `src/ui/sessionPanel.tsx` without changing the Console tab; verify `test/consoleLayout.test.ts` and `test/changeDetail.test.ts` still pass
- [x] 4.2 Split console sessions from change sessions in `SessionProvider` (`sessions` is `ChangeSession[]`, `consoles` separate), type the change helpers in `src/ui/sessionState.ts` as `ChangeSession`, and filter in `openWork()`; verify in `test/consoleUi.test.ts` that the Open work count and list ignore a running console
- [x] 4.3 Add `api.openConsole()` to `src/ui/api.ts` (the existing `IconTerminal` in `src/ui/icons.tsx` is reused)
- [x] 4.4 Create `src/ui/console.tsx` with `ConsoleButton` (top bar, accessible name with the running state from the shared badge decision, running dot) and `ConsoleOverlay` (in `DetailOverlay`: header with agent, folder and badge; terminal; shortcuts; End session, Resume, New console, Delete record; refusal reason in the body; focus-aware `Escape`); unit-test the button's label and the overlay's session choice (running → latest ended → open) in a new `test/consoleUi.test.ts`
- [x] 4.5 Mount the button next to the theme control and the overlay beside `ChangeDetail` in `src/ui/app.tsx`, with `div.app` inert while it is open and the route untouched; hide the button while agent sessions are disabled; verify with `bun run dev` on the overview, a board and settings, in both themes
- [x] 4.6 End the console with an inline confirm in the overlay instead of `src/ui/endSessionDialog.tsx` (which is about worktrees and pulls, and only knows change sessions); verify in `bun run dev` that ending the console offers nothing else
- [x] 4.7 Add the "Console folder" field to `src/ui/agentSettings.tsx` (empty = default, placeholder shows it, server reason shown inline); verify in `bun run dev` that an inside-a-repo folder shows the refusal and a valid one saves
- [x] 4.8 Style the button, dot and overlay in `src/ui/styles.css` with existing tokens only; verify `test/repoContrast.test.ts` still passes

## 5. Demo

- [x] 5.1 Add `openConsole` to `src/ui/demo/demoApi.ts` (in-memory, one at a time, folder under `/home/demo/`) and a short vendor-neutral console transcript to `src/ui/demo/demoSessions.ts`; verify in `test/demoSessions.test.ts` and `test/demoTranscripts.test.ts` (reopen returns the same session; transcript passes the leak checks)

## 6. Docs and final check

- [x] 6.1 Describe the main console and the console folder in `README.md`, and extend invariant 1's sentence on starting the agent in `CLAUDE.md` to cover the console folder (never inside a tracked repository)
- [x] 6.2 Run `bun run check` and `bun run build`, then start `dist/openspec-dashboard` and open, answer (a default response), end and resume the console with `test/fixtures/fake-agent.ts` as the default agent to confirm it works in the compiled binary
- [ ] 6.3 Open the console once with the real preconfigured Claude Code profile and confirm it starts as plain `claude` in the console folder (a manual check for the user; the automated checks never start a real agent)
