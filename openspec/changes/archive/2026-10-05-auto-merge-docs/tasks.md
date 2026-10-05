# Tasks

## 1. Configuration and API

- [x] 1.1 Add `autoMergeDocs?: boolean` to `RepoConfig.agent` in `src/shared/types.ts` and `z.boolean().optional()` to the `agent` object of `repoSchema` in `src/server/config.ts`; verify in `test/config.test.ts` that a config without it loads unchanged (no key added) and one with `"yes"` is rejected
- [x] 1.2 Accept `autoMergeDocs` in `POST /api/repos/<id>/agent` (`src/server/api.ts`): boolean sets it, `false` deletes the key, non-boolean → `400`, a body with none of `enabled`/`agentId`/`autoMergeDocs` → `400`; verify in `test/trackingApi.test.ts` (on then off on a repo without agent settings, `"yes"` refused, no scan triggered)

## 2. Docs-only check

- [x] 2.1 Add `shipsOnlyOpenSpec(worktreePath, base)` to `src/server/sessions/workStatus.ts` per design D3 (committed `diff --name-only -z <base>...HEAD` ∪ `status --porcelain=v1 -z --untracked-files=all` incl. both rename sides; fail closed); verify with a new `test/shipAutoMerge.test.ts` on temp git repositories: only `openspec/` changes → true; a `src/` file, an untracked root file, `docs/openspec/x.md`, `openspec-notes.md`, a rename from `src/` into `openspec/`, unknown base, and an empty diff → false

## 3. Ship prompt

- [x] 3.1 Add the one-line, agent-neutral `AUTO_MERGE_DOCS_INSTRUCTION` to `src/shared/types.ts` (design D4) and let `shipPrompt(agent, change, { autoMerge })` in `src/server/sessions/agents.ts` append it after the profile's Ship suffix; verify in `test/agents.test.ts` that without the flag the prompt is byte-for-byte today's (default and custom profile, with and without suffix) and with it ends with the instruction, contains no line break and names no vendor tool
- [x] 3.2 In `SessionManager.ship()` (`src/server/sessions/manager.ts`) call `shipsOnlyOpenSpec` only when `repo.agent?.autoMergeDocs === true`, using the same base as the work status, pass the result to `shipPrompt`, and return `autoMerge` on `ShipResult`; verify in `test/shipAutoMerge.test.ts` with the fake agent (running and restarted sessions) that the submitted prompt carries the instruction exactly when the setting is on and the branch is docs-only, that `autoMerge` matches, and that no `gh` process is started and the repository's refs are unchanged

## 4. UI

- [x] 4.1 Add `AutoMergeToggle` in `src/ui/projectSettings.tsx` (design D6) with a tooltip explaining the setting, shown on overview rows and tiles (`src/ui/overview.tsx`) only for git projects with agent sessions enabled, inactive while sessions are off globally, saving `{ autoMergeDocs }` through `src/ui/api.ts` and reverting on failure; verify in `test/projectSettingsUi.test.ts` (On/Off, hidden without git or with sessions disabled, inactive when off globally, revert on refusal)
- [x] 4.2 Show the "asked the agent to enable auto-merge — only OpenSpec documents changed" notice from `ShipResult.autoMerge` in `src/ui/sessionPanel.tsx` and `src/ui/endSessionDialog.tsx` (styles in `src/ui/styles.css`); verify with a UI test that the notice appears only when `autoMerge` is true
- [x] 4.3 Update the demo build's sample data if it constructs `ShipResult`/`RepoConfig.agent` objects so `bun run build` and the demo still type-check; verify `bun run check`

## 5. Docs and verification

- [x] 5.1 Add a README paragraph on **Auto-merge docs-only pull requests** (what counts as docs-only, that the agent enables auto-merge, that the dashboard merges nothing) and extend the Ship sentence under *Work status* in `CLAUDE.md`; verify by reading both
- [x] 5.2 Run `bun run check` and `bun run build`, start `dist/openspec-dashboard`, toggle the setting on a fixture repository's overview tile and confirm the config file gains and loses `autoMergeDocs`; `openspec validate auto-merge-docs --strict` passes
