# Tasks

## 1. Session kind and shared helpers

- [x] 1.1 Add `ProjectConsoleSession` (`projectConsole: true`, `repoId`, `folder`, `inPlace: true`, no change, action or branch) to `src/shared/types.ts`. Add `isProjectConsole()`, and make `isChangeless()` and `changeSessions()` treat it as changeless. Verify with `bun run typecheck` and a unit test that `changeSessions()` drops it.
- [x] 1.2 Add the pure helper `projectConsoleSessions(sessions, repo)`. It returns the repo's project consoles plus the integration sessions whose `folder` equals the repo's canonical path. Add a picker that returns a running one first, else the newest by `createdAt`. Verify with unit tests: setup session only, newer console wins, running integration beats ended console.
- [x] 1.3 Audit every `repoId`-keyed session lookup in `src/server/` and `src/ui/` (duplicate-open, `hasOpenSession`, card session lookups, Open work, activity `report`, `listWorktrees`). Each must ignore project consoles, either through `changeSessions()`/`isChangeless()` or explicitly. Verify by grepping `repoId ===` and noting each site in the PR.

## 2. Manager and API

- [x] 2.1 Implement `SessionManager.openProjectConsole(repoId)` in the order the design gives: 403, 404, 409 for a disabled repo, 403 for a repo excluded from sessions, 409 when the folder is missing, return a running console or integration, 409 when another in-place session uses the folder, 503 when the agent is missing. Then start `launchWithoutPrompt(agentFor(config, repo))` in `repo.path` with no git. Verify with `test/projectConsole.test.ts` using the fake agent: it prints its argv and cwd, and there is no `{prompt}` argument.
- [x] 2.2 Add `prepareProjectConsoleRestart` and dispatch `resume` to it. Check that the agent and repo are still configured, the folder still exists, and no other session runs in the folder. Make sure `restart()` creates no worktree for the kind. Verify with a test that ends and resumes a project console and finds the same cwd, with no `git` spawned (git shim or spy).
- [x] 2.3 In `openSession`, refuse with 409 an in-place change session when any running session's `worktreePath` is `repo.path`. In `openProjectConsole`, the reason names the change. Verify with a test on a tracked fixture folder without git, in both orders.
- [x] 2.4 Make the change-only routes (`ship`, `resolve-conflicts`, `prompt`, `GET worktree`) answer 409 for a project console, and make `close` ignore `removeWorktree`. Give `notAChange()` a project-console message. Verify with API tests.
- [x] 2.5 Add `POST /api/repos/<id>/console` in `src/server/api.ts` behind `crossSiteRefusal`, returning `{ session, created }`. Verify with API tests: open, open twice returns the same session, running integration returned, excluded repo 403, unknown 404, cross-site 403, failed scan still opens.
- [x] 2.6 Write the side-effect tests: opening, running and ending a project console in a temp git repo leaves branch, index, refs and working tree byte-for-byte unchanged (until the fake agent writes). The session does not show up in `worktrees()`, the activity log or Open work data. Repository cleanup's preview of that repo is unchanged while it runs. Verify that `bun test test/projectConsole.test.ts` passes.

## 3. UI

- [x] 3.1 Add `api.openProjectConsole(repoId)` to `src/ui/api.ts`, and the demo counterpart in `src/ui/demo/demoApi.ts` and `demoSessions.ts`, which returns an in-memory session with a short canned transcript. Verify with `bun run typecheck` and `bun run build:demo`.
- [x] 3.2 Extend `SessionProvider` (`src/ui/sessions.tsx`) with `projectConsoles`, `projectConsoleRepoId` and `showProjectConsole`. Add `projectConsoleControl(sessions, repo)` to `src/ui/sessionState.ts`, giving the name, title and badge in words, modelled on `consoleControl`. Verify with unit tests in the existing sessionState test file for the running, waiting with silence length, and none states.
- [~] 3.3 Create `src/ui/projectConsole.tsx` with `ProjectConsoleButton` and `ProjectConsoleOverlay`. The overlay shows the header (project, agent, folder, badge), `IN_PLACE_WARNING`, the terminal, default responses, End session, and Resume / New console / Delete record once ended. It auto-starts when there is no session, and it handles Escape and focus like `console.tsx`. Mount it in `app.tsx` and include it in `otherOverlayOpen`. Verify by opening it with `bun run dev` against a fixture repo.
- [~] 3.4 Place `ProjectConsoleButton` on managed project rows and tiles in `src/ui/overview.tsx`, with `stopPropagation` so the board does not open and nothing shown for `Scanning…` entries, and in the single-repo board header in `src/ui/kanban.tsx`. Make it inactive with a reason when the project's sessions are off or its agent is missing, and hidden when sessions are off globally. Verify in `bun run dev`: clicking on a row does not navigate, and the tooltip shows the reasons.
- [~] 3.5 Run the end-to-end flow manually in `bun run dev`. Do New project, let the agent run `openspec init`, close the overlay, run discovery. Then the project's console control shows the running state and opens the same setup terminal. Once it has ended, it shows Resume and New console. Record the result in the PR.

## 4. Docs and checks

- [x] 4.1 Update `CLAUDE.md`: invariant 1's in-place / main-checkout wording and the agent sessions section now include the project console. Also update `src/ui/helpContent.tsx` (a project console entry), and `README.md` if it lists session kinds. Verify by reading the diff for consistency with the specs.
- [x] 4.2 Run `bun run check` and `openspec validate console-project --strict`, both passing. Then `bun run build` and open a project console once from `dist/openspec-dashboard` to confirm the PTY works in the binary.
