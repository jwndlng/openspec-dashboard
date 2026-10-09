# Tasks

## 1. Folder picker (server)

- [x] 1.1 In `src/server/setup.ts`, add the constant picker command per platform (`osascript`; `zenity`, else `kdialog`, only with `DISPLAY`/`WAYLAND_DISPLAY`; PowerShell `FolderBrowserDialog`) and `folderPickerAvailable()` via `Bun.which`. Verify with a test that picks the command per platform and env, starting no process
- [x] 1.2 Implement `pickFolder()`: spawn without a shell, `cwd` the dashboard home, parse chosen / cancelled / failed, canonicalise and require an existing directory, one at a time, kill after ten minutes. Verify with tests using a fake picker on `PATH` (chosen, cancelled, non-directory, second request while open, timeout with a shortened limit, request body never in argv/env/stdin)
- [x] 1.3 Add `folderPicker` to `SetupState` in `src/shared/types.ts` and to `GET /api/setup`, add `POST /api/setup/folder` in `src/server/api.ts` behind `crossSiteRefusal`, and add `api.pickFolder` in `src/ui/api.ts`. Verify with API tests: `403` cross-site with no process started, `409` while open, `failed` without a picker

## 2. Shared pieces for the wizard

- [x] 2.1 Extract `newAgentProfile(name, command)` (next to `slugId` in `src/ui/sessionState.ts`), and use it for Settings' **+ Add agent**. Verify that the existing agent settings tests pass unchanged
- [x] 2.2 Extract the project-settings setters (`withRepoAgent`, `withPrTitleConvention`, `withAutoFetch`) from the server's per-setting routes and `settingApplies` from `src/ui/projectSettings.tsx` into `src/shared/repoSettings.ts` as pure functions, and have the routes and the dialog use them. Verify with unit tests for each setter (the default clears the key) and that the overview tests pass unchanged
- [x] 2.3 Split the dialog's controls (Agent sessions, Agent, PR titles, Docs auto-merge, Auto fetch) into presentational components that take `value`/`onChange` (the selects; the switches' tooltips and states are exported for the wizard's Enabled/Disabled and On/Off selects, which need a "Keep each project's setting" option), keeping labels, options, tooltips and accessible names. The dialog wraps them with `Tracking`. Verify that the project settings dialog renders and behaves as before (existing tests)

## 3. Step logic (`src/ui/setupState.ts`)

- [x] 3.1 Grow `SETUP_STEPS` to Welcome, Workspace, Agents, Console, Project settings, System check, Done. Verify with a test of the order and of "n of 7"
- [x] 3.2 Multi-agent model: `agentChoices` marks configured profiles locked, found presets are checked by default, custom agents are validated (name, first argument), the default agent is offered among checked ones with the preselection rule, and `agentsSave` appends checked presets and valid custom agents in order and sets the default. Verify with tests for every Agents scenario in the spec, including "save nothing"
- [x] 3.3 `consoleSave(current, choice)`: only `consoleAgent` changes, **Default agent** clears it, `null` when unchanged. Verify with tests
- [x] 3.4 Project settings: `commonValue`, the per-setting applicable count, edits drafts for both modes, and `projectSettingsSave(current, mode, edits, isGitById)` writing only touched fields to applicable projects, one config, `null` when nothing changed. Verify with tests for every Project settings scenario (all mode, mixed values kept, individual walk-through, folder without git, default clears, nothing changed)
- [x] 3.5 Extend `setupSummary` with agents added, console agent and projects changed. Verify with a test of the Done scenario

## 4. Wizard views (`src/ui/setupWizard.tsx`)

- [~] 4.1 Workspace: **Choose folder…** shown only with `folderPicker`, busy while open, cancel silent, failure shown, duplicates ignored, chosen folder runs discovery. Escape while the picker is pending does not skip setup. Verify with view tests and in `bun run dev` on macOS that Finder's dialog opens in front and the folder is added
- [x] 4.2 Agents: checklist with found/not found, locked configured profiles, install steps for each checked agent that is not found, **Add another agent** form with validation and removal, default-agent choice among the checked agents. Verify with view tests
- [x] 4.3 Console step: the explanation, the choice only with two or more profiles, the "sessions off" note. Wire `consoleSave` on Continue. Verify with view tests
- [x] 4.4 Project settings step: modes, "Keep each project's setting", the applicable counts, defaults named, "Project n of N" with Previous/Next project, "Reading projects…" until every covered project has a scan entry (pass the snapshot from `app.tsx`, and while waiting trigger a scan and read `GET /api/state`, since a scan asked for during another is dropped), the empty state, errors kept on a failed save. Verify with view tests and in `bun run dev` against fixture projects
- [x] 4.5 Update Welcome (five topics) and Done (new summary lines). Verify with view tests

## 5. Layout

- [x] 5.1 In `src/ui/styles.css`, give the wizard its own size (about 960×720, capped by the viewport), a fixed head and footer with a scrolling body, larger text, 40px+ controls and wider group spacing, and the narrow fallback under 560px. Verify in the browser at 1440×900 (steady size across steps) and at 400px (no horizontal scroll), in light and dark themes

## 6. Demo, docs and checks

- [x] 6.1 `src/ui/demo/demoApi.ts`: `folderPicker: true` and `POST /api/setup/folder` answering the demo's root. Verify with **Run setup again** in the demo build that **Choose folder…** adds the demo folder without a dialog
- [x] 6.2 Update `README.md`'s first-run paragraph (folder dialog, several agents, console, project settings). Verify by reading it against the specs
- [~] 6.3 Run `bun run check`, then `bun run build` and check **Choose folder…** in `dist/spec-control`. Verify that all checks pass and the compiled binary opens the dialog
- [x] 6.4 Add a What's new entry at the top of `src/ui/changelog.ts` for the improved setup (folder dialog, several agents, console and project settings steps, roomier wizard). Verify that it shows in the What's new view
