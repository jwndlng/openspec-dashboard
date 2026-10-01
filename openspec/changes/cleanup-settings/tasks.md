# Tasks

## 1. Server: per-repository settings endpoints

- [x] 1.1 Add `POST /api/repos/<id>/name` in `src/server/api.ts` (trimmed non-empty string, else 400; unknown id 404), routed through `tracking(...)` and `updateConfig`, and verify with new cases in `test/trackingApi.test.ts` (rename keeps `enabled` and `agent`, blank name 400, unknown id 404)
- [x] 1.2 Add `POST /api/repos/<id>/agent` (`enabled?: boolean`, `agentId?: string | null`; a missing `agent` object starts from `{ enabled: true }`; `null` deletes `agentId`; non-boolean/invalid type, unknown profile or empty body 400; unknown id 404) and verify with tests covering switch-off, select, clear, unknown agent and that a session start for a switched-off repository is refused
- [x] 1.3 Add `POST /api/repos/<id>/labels` (`labels?`, `hiddenLabels?` as string lists under the config's label rules; empty list removes the key; neither field 400; unknown id 404; no scan) and verify with tests for set, clear, hidden kept and duplicate refused
- [x] 1.4 Add `POST /api/repos/<id>/forget` (removes a disabled repository; enabled 409; unknown 404; no scan triggered) and verify with tests, including that forgetting leaves the repository a discovery candidate again
- [x] 1.5 Verify the four routes refuse a cross-site request with 403 and that concurrent name and agent writes for two repositories both persist (tests in `test/trackingApi.test.ts`)

## 2. Client API and demo

- [x] 2.1 Add `renameRepo`, `setRepoAgent`, `setRepoLabels` and `forgetRepo` to the `Api` interface and the HTTP implementation in `src/ui/api.ts`, and verify `bun run typecheck` fails until the demo implements them
- [x] 2.2 Implement the four operations in `src/ui/demo/demoApi.ts` on the in-memory config with the same refusals (`ApiError` 400/404/409), and verify with cases in `test/demoApi.test.ts`

## 3. Overview: per-project settings and Forget

- [x] 3.1 Make `enabledOnly` in `src/ui/overviewState.ts` overlay configured names onto snapshot repositories, and verify with a unit test in `test/overview.test.ts` that a renamed repository shows its config name before any scan
- [x] 3.2 Extend `useTracking` in `src/ui/untracked.tsx` with `rename`, `setAgent` and `forget` actions (same busy and error handling; `forget` re-runs discovery), and verify in `test/untrackedUi.test.ts` that busy and error state are per repository
- [x] 3.3 Add **Forget** beside Enable on `disabled` entries only, with the tooltip from the spec, and verify in `test/untrackedUi.test.ts` that discovered and integratable entries have no Forget
- [x] 3.4 Add the agent-session switch (`role="switch"`, Enabled/Disabled label, the project's name in its accessible name, inactive with reason and a link to `/settings?section=agents` while sessions are off globally) to table rows and tiles in `src/ui/overview.tsx`, with `stopPropagation`, and verify in `test/overview.test.ts` for both layouts and for the global-off state
- [x] 3.5 Add the agent picker ("default agent" plus each profile; only with more than one profile and agent sessions enabled for the project) to rows and tiles, and verify in `test/overview.test.ts` that it is absent with one profile and that choosing "default agent" sends `agentId: null`
- [x] 3.6 Add Rename (pencil beside the name, input in place, Enter/blur save, Escape cancels, blank refused with a message, unchanged name sends nothing, one field open at a time, no row navigation) to rows and tiles, and verify in `test/overview.test.ts`
- [x] 3.7 Add a **Labels** action to rows and tiles opening a `Modal` around `RepoLabelsEditor` whose edits save at once through `setRepoLabels` (busy and error shown in the dialog; tooltip text in `src/ui/labels.tsx` no longer points to Settings), and verify in `test/overview.test.ts` or a new `test/labelsUi.test.ts`
- [x] 3.8 Make sure pending `Scanning…` entries offer none of these controls, and verify in `test/overview.test.ts`
- [~] 3.9 Style the toggle, the picker, the pencil and Forget in `src/ui/styles.css` for both themes and both layouts, and verify with `bun run dev` in the browser at desktop width and at 400px that no row overflows

## 4. Settings cleanup

- [x] 4.1 Remove the Tracked repositories section from `src/ui/settings.tsx` and `"tracked"` from `SECTION_IDS` in `src/ui/settingsSections.ts`, and verify in `test/settingsSections.test.ts` that `?section=tracked` parses as unknown and the section list is roots, scanning, agents, shared-config, environment
- [x] 4.2 Make Settings' Save send `repos` from the latest `config` prop, dropping any `agentId` that names no remaining profile, and verify with a test that a rename on the overview survives a later Settings save of a dirty draft, and that removing a selected profile saves without an "unknown agent" error
- [x] 4.3 Replace the Repositories list in `src/ui/agentSettings.tsx` with a hint linking to Projects, drop the now-unused per-repository code, and verify in `test/agentSettingsUi.test.ts` that the section lists no repository and links to `/`
- [x] 4.4 Update hints that point to Settings for renaming or forgetting (e.g. the Workspace roots copy and the `IGNORE_HINT` tooltip, if affected) and `README.md` where it describes tracked repositories or per-repository agent settings in Settings; verify with a grep for "Tracked repositories" in `src/` and `README.md`

## 5. Verification

- [x] 5.1 Run `bun run check` and verify lint, typecheck and all tests pass
- [~] 5.2 Run `bun run build` and verify the compiled `dist/openspec-dashboard` serves the overview with the new controls and that rename, agent toggle, picker and Forget work against a temporary `OPENSPEC_DASHBOARD_HOME`
- [x] 5.3 Run `openspec validate cleanup-settings --strict` and verify the change is valid
