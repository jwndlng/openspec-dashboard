# Tasks

## 1. Configuration and setup flag

- [x] 1.1 Add `setup?: "pending"` to `Config` (`src/shared/types.ts`) and `configSchema` (`src/server/config.ts`), accepting only `"pending"` and dropping any other value; verify in `test/config.test.ts` that a config without the key loads without it and is not rewritten, and that `setup: "yes"` is dropped
- [x] 1.2 Add `freshConfig()` (defaults plus `setup: "pending"`) and use it in `loadConfig` for the missing-file and reset-invalid paths only; verify in `test/config.test.ts` that a first start and a reset both produce `setup: "pending"` and `defaultConfig()` is unchanged
- [x] 1.3 Make `PUT /api/config` carry the stored `setup` through whatever the body says, inside the serialised config-write queue; verify in `test/setupApi.test.ts` that a body without `setup` keeps `pending` and a body with `pending` after done leaves no key

## 2. Setup endpoints

- [x] 2.1 Create `src/server/setup.ts` with the fixed folder-name list and `suggestRoots(home, config)` (one `stat` per name, `canonicalPath`, de-duplicated, configured roots and ignore paths filtered out); verify with a new `test/setup.test.ts` using a temporary home that holds folders, a same-named file and a configured root
- [x] 2.2 Add `markSetupDone()` that removes `setup` through the config write queue and writes nothing when not pending; verify in `test/setup.test.ts` that roots, repos and agent settings are unchanged and the file's mtime is unchanged on a second call
- [x] 2.3 Wire `GET /api/setup` and `POST /api/setup/done` in `src/server/api.ts` (the POST behind `crossSiteRefusal`); verify in a new `test/setupApi.test.ts` the response shape, done-twice, and a cross-site `403` that leaves the config unchanged

## 3. Environment instructions

- [x] 3.1 Add `instructions?: { text: string; command?: string }[]` to `EnvironmentCheck` in `src/shared/types.ts`, and an `install` table per platform (`darwin`, `linux`, `win32`) to the Claude Code, Codex and Antigravity presets in `src/shared/agentDefaults.ts`, with commands checked against each tool's install documentation; verify `bun run typecheck` passes and `test/agents.test.ts` asserts every preset has steps for each platform
- [x] 3.2 In `src/server/environment.ts`, attach platform-chosen instructions to every `warning`/`problem` check (git, git-identity naming only the missing keys, openspec-cli, github-cli with install vs `gh auth login`, agents from their preset or the generic step) and none to `ok`/`not-needed`; make the platform injectable for tests and verify in `test/environment.test.ts` the scenarios of the `environment-check` delta, including that no instruction contains `GH_TOKEN`'s value
- [x] 3.3 Show instructions with a copy control per command in Settings' Environment section (`src/ui/environment.tsx`, with a shared `CommandSteps` component in `src/ui/commandSteps.tsx`); verify in `test/environmentUi.test.ts` that a `problem` check renders its steps and copy control and an `ok` check renders none

## 4. Wizard logic

- [x] 4.1 Create `src/ui/setupState.ts` with pure functions: `shouldOpenSetup` (pending, ready, other overlays, already opened, demo), the Agents step's option list and preselection (the configured default when found, else the first found agent, else the configured default), each step's save built from a fresh config as additions only (`workspaceSave`, `agentsSave`, returning `null` when nothing changes), and the Done summary (whether Skip needs a confirmation is the view's: it knows what was entered); verify with a new `test/setupState.test.ts` covering every scenario of the Workspace, Agents and Done requirements
- [x] 4.2 Extend `shouldAutoStart` in `src/ui/tourState.ts` with `setupPending`; verify in the tour state test that the tour waits while setup is pending or the wizard is open and starts after it closes, and that a re-run of setup does not start a seen tour
- [x] 4.3 Add `getSetup()` and `markSetupDone()` to `src/ui/api.ts`; verify `bun run typecheck`

## 5. Wizard UI

- [x] 5.1 Create `src/ui/setupWizard.tsx`: modal dialog (focus trap and inert page via the existing `modal.tsx`), step header "n of 5" with step names, Back/Continue/Skip setup, Escape with confirmation when entries are unsaved; verify in a new `test/setupWizardUi.test.ts` that the dialog is named, shows "3 of 5" on Agents, and Back keeps an entered root
- [x] 5.2 Implement the Welcome and Workspace steps: configured roots, typed roots with `~`, suggestions from `GET /api/setup`, discovery via `POST /api/discover` with the latest-result-only sequencing from `discoveryState.ts`, candidate checkboxes checked by default, missing-root marking, integratable count with the overview pointer; Continue saves via `PUT /api/config` then `POST /api/repos/track` per checked candidate, staying on the step with the error on failure; verify in `test/setupWizardUi.test.ts` the tracked/unchecked scenario and that Skip before Continue saves nothing
- [x] 5.3 Implement the Agents step: the risk statement (shared text with `agentSettings.tsx`), switch, agent choice with found marks from the environment report, install steps for a missing choice via `CommandSteps`; Continue saves the additions only; verify in `test/setupWizardUi.test.ts` the Codex-preselected scenario and that leaving it unchanged sends no request
- [x] 5.4 Implement the System check step (fresh `GET /api/environment` on entry, Re-check with a working state, "everything needed is in place") and the Done step (summary, remaining problems, Finish); Finish and Skip call `POST /api/setup/done` and close even if it fails; verify in `test/setupWizardUi.test.ts`
- [x] 5.5 Mount the wizard in `src/ui/app.tsx`: load setup state with the config, open it by `shouldOpenSetup`, count it as an overlay for the tour, and expose `openSetup` to Help; add **Run setup again** next to **Take the tour** in `src/ui/help.tsx`/`helpContent.tsx`; add styles to `src/ui/styles.css` that hold at 400px; verify in `test/helpContent.test.ts` and by hand in a browser with `SPEC_CONTROL_HOME` pointed at an empty directory: the wizard opens; Back keeps an entered root; Skip before Continue saves nothing; Escape with an entry asks first; at 400px nothing scrolls sideways; Finish starts the tour; a reload shows neither

## 6. Demo, docs and checks

- [x] 6.1 Answer `GET /api/setup` (`pending: false`, one fixed suggestion) and `POST /api/setup/done` in memory in `src/ui/demo/demoApi.ts`, and keep the wizard from opening by itself in the demo; verify in `test/demoApi.test.ts` and that `bun run build:demo` (or the demo test) shows no wizard on first load
- [x] 6.2 Add a What's new entry in `src/ui/changelog.ts` and describe the first start in `README.md`; verify the changelog test passes
- [x] 6.3 Run `bun run check` and `bun run build`, then start `dist/spec-control --no-open` with an empty `SPEC_CONTROL_HOME` and confirm `GET /api/setup` returns `pending: true` with suggestions from the real home, and `POST /api/setup/done` clears it
