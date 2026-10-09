# Tasks

## 1. Configuration

- [x] 1.1 Add `consoleAgent?: string` to `AgentSessionsConfig` in `src/shared/types.ts` (doc comment: absent means the default agent), and add it to `agentSessionsSchema` in `src/server/config.ts` with a `superRefine` issue at `["consoleAgent"]` when it names no configured profile; verify with `test/config.test.ts` cases for absent (accepted, unchanged), a known id (kept) and an unknown id (refused)
- [x] 1.2 Verify that `PUT /api/config` with an unknown `agentSessions.consoleAgent` answers `400` naming `agentSessions.consoleAgent` and leaves the saved config unchanged, with an API test next to the existing console-folder refusal

## 2. Server

- [x] 2.1 Add `consoleAgentOf(config)` to `src/server/sessions/agents.ts`, returning the chosen profile or else the default, and use it in `SessionManager.openConsole` in place of `defaultAgentOf`, leaving Integrate and New project on `defaultAgentOf`; verify with `test/consoleSession.test.ts`: a configured console agent is started without its `{prompt}` arguments, the absent key starts the default agent, and a missing console-agent executable is refused with `503` naming that agent
- [x] 2.2 Verify that a running console keeps its agent and that Resume uses the session's own agent after `consoleAgent` changes, with a `test/consoleSession.test.ts` case that changes the config between start, end and resume
- [x] 2.3 Count `consoleAgent ?? defaultAgent` as used in `checkAgents` (`src/server/environment.ts`); verify with `test/environment.test.ts` that a missing console agent no repository uses is `problem` and that an agent nobody uses stays `warning`

## 3. UI

- [x] 3.1 Add the console-agent picker to the Console group in `src/ui/agentSettings.tsx`: "default agent" (stored as absent) plus every profile, shown only when two or more profiles exist, saved with Settings. Decide whether to show it with a pure helper. Verify with `test/agentSettingsUi.test.ts` for one profile (hidden), two profiles (shown) and choosing "default agent" (key removed)
- [x] 3.2 Make `removeAgent` clear `consoleAgent` when it names the removed profile; verify with a UI test that removing the chosen profile leaves a draft with no `consoleAgent` that `PUT /api/config` accepts
- [x] 3.3 Update the Console hint in `agentSettings.tsx` and the overlay hint and header comment in `src/ui/console.tsx` to say "console agent" instead of "default agent"; verify by rendering both and checking the new text

## 4. Verification and What's new

- [x] 4.1 Add a What's new entry at the top of `src/ui/changelog.ts` saying that the console can run a different agent, chosen in Settings → Agent sessions → Console; verify the What's new dialog shows it
- [x] 4.2 Run `bun run check`. Then run `bun run dev` with two profiles, choose the second as the console agent, and confirm that the top-bar console starts it while change sessions keep the default agent
