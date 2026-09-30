# Tasks

## 1. Types and discovery

- [x] 1.1 Add to `src/shared/types.ts`: `IntegratableRepo` (`id`, `path`, `name`), `integratable: IntegratableRepo[]` on `DiscoverResult`, `"integrate"` in `PromptKey`, and `IntegrationSession extends SessionBase` (`integration: true`, `folder`, `inPlace: true`, no `repoId`/`change`/`action`/`branch`) as a third member of `Session`, with an `isIntegration()` guard next to `isConsole()`; verify `changeSessions()` still returns only `ChangeSession` and `bun run typecheck` passes
- [x] 1.2 In `src/server/discover.ts`, collect integratable directories in `walk` — own `.git` directory (`hasOwnGitDir`), not a linked worktree, no `openspec/config.yaml` — while keeping the existing report/descend behaviour byte for byte, and after the walk drop any collected directory that is a prefix of a reported OpenSpec project; return both lists from `findOpenSpecRepos` and `discoverRepos`, excluding paths already in `known`, sorted and de-duplicated by canonical path; verify with new cases in `test/discover.test.ts` (plain repo offered, non-git directory not offered, monorepo container dropped, linked worktree excluded, ignore paths and `IGNORED_DIRS` respected, tracked repo in neither list) plus an assertion that the existing candidate expectations are unchanged
- [x] 1.3 Extend the fixtures used by `test/discover.test.ts` with generated git repositories that have no `openspec/` tree, including a container holding an OpenSpec package (made-up names only, per invariant 7); verify `bun test test/discover.test.ts` passes

## 2. Configuration and the integration module

- [x] 2.1 Add the `integrate` prompt to the preconfigured Claude Code profile in `src/shared/agentDefaults.ts` — one line, no `{change}` — and relax prompt validation in `src/server/config.ts` so `integrate` is exempt from the `{change}` requirement and is rejected if it contains any placeholder, while the permission-bypass check applies unchanged; verify with `test/config.test.ts` cases (config without `integrate` loads; `integrate` with `{change}` rejected; bypass flag in `integrate` rejected) and `test/agents.test.ts` for the preset
- [x] 2.2 Create `src/server/integration.ts` with `integratableProblem(path, config, discoverResult)` returning the refusal reason (`not integratable`, `sessions disabled`, `no integrate prompt`, `agent not found`) and `startIntegration(path)` that resolves the default agent and opens an in-place session for the folder; verify with unit tests in a new `test/integration.test.ts` covering every refusal reason without starting a process
- [x] 2.3 In `src/server/integration.ts`, implement `confirmIntegration(folder)`: re-check `openspec/config.yaml`, and when present add the repository to the config with `enabled: true` and its default name disambiguated by the existing `<basename> (<parent>)` rule, write atomically and trigger a scan; wire it to the end of an integration session and to every discovery run; verify with tests that the marker present adds and scans, the marker absent changes nothing, a colliding name is disambiguated, and a second confirmation for the same folder adds nothing twice

## 3. Sessions

- [x] 3.1 In `src/server/sessions/store.ts` and `manager.ts`, support a session whose working directory is a plain folder with no repository and no change: reuse the `inPlace` path used by non-git repositories, record the new shape, enforce one running integration session per folder, and keep integration sessions out of everything that iterates change sessions (work status, Ship, prompt, worktree, pull, activity log); verify with `test/integration.test.ts` using `test/fixtures/fake-agent.ts` in a temp git repository — the agent starts with the folder as cwd, no worktree exists under the dashboard home, no branch was created, and starting it again returns the same session
- [x] 3.2 Add an assertion test that an integration session runs no git command against the repository and leaves its branch, index and working tree byte for byte unchanged (the agent itself is the fake agent, which writes nothing); verify it passes

## 4. API

- [x] 4.1 Add `integratable` to the `POST /api/discover` response in `src/server/api.ts`; verify in `test/integration.test.ts` against a real server (candidate and integratable separated, tracked repo in neither, `integratable: []` once it is tracked) and in `test/discover.test.ts` for the container rule
- [x] 4.2 Add `POST /api/integrations` behind `crossSiteRefusal`: `404` for a path discovery does not currently report as integratable, `403` when agent sessions are off, `400` when the default agent has no `integrate` prompt, `503` when its executable is missing, otherwise the session; verify with route tests for each status, a foreign-origin `403` that starts no process, and a duplicate open returning the same session
- [x] 4.3 Make `GET /api/sessions` include integration sessions marked as such with the folder and no repository/change/action/branch, accept an integration id for resume, close (ignoring `removeWorktree`), delete and the terminal WebSocket, and refuse `ship`, `prompt` and `worktree` with `409`; verify with route tests mirroring the console session's
- [x] 4.4 Confirm the marker re-check on session end through the API: end an integration session with and without `openspec/config.yaml` in the folder and assert `GET /api/config` and the following `POST /api/discover` accordingly; verify with `test/integration.test.ts`

## 5. UI

- [x] 5.1 Add the integratable list to `src/ui/api.ts`, `src/ui/settingsSections.ts` and `src/ui/settings.tsx`: a third list below the candidates, headed so it states that these repositories do not use OpenSpec yet, each row with path, the shared name hint from `src/shared/nameHints.ts`, **Integrate** and Ignore; verify with `test/settingsSections.test.ts` (the new section id) and by opening Settings under `bun run dev`
- [x] 5.2 Make **Integrate** inactive with the reason shown on the row when sessions are off, the agent has no `integrate` prompt or its executable is missing, keeping the rows visible in all three cases, and show a failed start's reason on the row rather than in a panel; verify with the `integrateUnavailable` cases in `test/agents.test.ts` (this project unit-tests the pure decision; it has no DOM render harness)
- [x] 5.3 Open the session panel for a started integration and render its in-place wording in `src/ui/sessionPanel.tsx`: the folder, no branch, and the existing in-place sentence that the agent edits the folder directly with no branch, no commit and no undo; on the session ending, refresh discovery and config so an integrated repository appears on the board and leaves the list; verify in `bun run dev` against a real repository without OpenSpec
- [x] 5.4 Add the Integrate prompt field to `src/ui/agentSettings.tsx` next to the other prompts, with its no-placeholder rule stated; verify with the `integrate` prompt cases in `test/agents.test.ts` (accepted without a placeholder, rejected with one, rejected with a bypass flag) and in `bun run dev`
- [x] 5.5 Add the styles for the third list and the disabled-action reason to `src/ui/styles.css`, matching the candidate rows; verify at phone width in both themes on the product build

## 6. Demo

- [x] 6.1 Add one synthetic integratable repository to `src/ui/demo/sampleData.ts`, an integration transcript to `src/ui/demo/transcripts.ts` and the `integratable`/`POST /api/integrations` handling to `src/ui/demo/demoApi.ts` and `demoSessions.ts`, so that finishing the transcript turns it into a tracked enabled repository with a small sample of changes and removes it from the list, not persisted across reload; verify with `test/demoApi.test.ts`, `test/demoSessions.test.ts` and `test/demoTranscripts.test.ts`, and by building the demo and confirming no network request leaves the page

## 7. Docs and final checks

- [x] 7.1 Update the agent-sessions section of `CLAUDE.md` with the second in-place case (an integration session, the only in-place session in a git repository) and note in invariant 1 that integration adds no new dashboard write, and add a short section to `README.md`; verify by reading them against the `agent-sessions` and `repo-integration` deltas
- [x] 7.2 Run `bun run check`; verify it passes
- [x] 7.3 Run `bun run build`, start `dist/openspec-dashboard`, and integrate a scratch git repository end to end — Integrate, agent runs `openspec init`, the repository appears on the board; verify the compiled binary behaves as `bun run dev` does
- [x] 7.4 Run `openspec validate integrate-repos-without-openspec --strict`; verify it reports the change as valid
