# Tasks

## 1. Archive is available in Synced

- [x] 1.1 In `src/shared/types.ts`, make `availableActions` offer `archive` for stage `done` or `synced` (inline condition, no import from `columns.ts`); extend the `availableActions` test in `test/agents.test.ts` with a `synced` case expecting `["archive"]` and verify `bun test test/agents.test.ts` passes
- [x] 1.2 In `test/terminalSessions.test.ts`, add a case that opens an Archive session for a change in `Synced` (a complete change whose delta specs are already in the main specs, or that has none — adjust the generated fixture together with the test if no such change exists) and expects branch `chore/archive-<change>`; keep the existing "not Done" refusal; verify `bun test test/terminalSessions.test.ts` passes

## 2. Preconfigured Archive prompt syncs without asking

- [x] 2.1 In `src/shared/agentDefaults.ts`, replace the Archive prompt of `CLAUDE_PROFILE` with the one from design.md and export `FORMER_ARCHIVE_PROMPTS = ["/opsx:archive {change}"]`; update `test/agents.test.ts` to assert the default starts with `/opsx:archive {change}`, mentions syncing, contains no newline, and that `openingPrompt` for `archive` yields one string starting with `/opsx:archive <change>`; verify the test passes
- [x] 2.2 In `src/server/config.ts`, upgrade a former preconfigured Archive prompt on the `claude` profile inside `validateConfig` (exact match against `FORMER_ARCHIVE_PROMPTS`; missing or different prompts untouched; other profile ids untouched); add tests in `test/config.test.ts` for: former prompt upgraded, edited prompt kept, removed prompt stays removed, a custom profile with the former text kept, and a saved-then-loaded config carrying the new prompt; verify `bun test test/config.test.ts` passes

## 3. UI and docs

- [ ] 3.1 In `src/ui/sessions.tsx`, change the Archive starter tooltip to say that the agent syncs the specs and archives the completed change; verify in `bun run dev` that the starter shows on a card in `Synced` and on one in `Done`, with the new tooltip
- [x] 3.2 Update the agent sessions section of `README.md`: Archive is offered in Done and Synced, the preconfigured prompt syncs specs first without asking, a former default prompt in an existing config is upgraded, and how to get the question back (edit the prompt in Settings); verify the text matches the delta spec

## 4. Verification

- [x] 4.1 Run `bun run check` and verify lint, typecheck and all tests pass
- [x] 4.2 Run `bun run build` and, with `OPENSPEC_DASHBOARD_HOME` pointing at a temp directory holding a config with the former prompt, start `dist/openspec-dashboard` and verify `GET /api/config` returns the new Archive prompt for the `claude` profile
- [x] 4.3 Run `openspec validate archive-syncs-by-default --strict` and verify it reports the change as valid
