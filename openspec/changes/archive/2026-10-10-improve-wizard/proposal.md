# Proposal

## Why

The first setup wizard (`setup-wizard`) gets a new user started, but it stops halfway. Workspace roots have to be
typed as paths. The Agents step takes exactly one agent, though many users have several CLIs installed. It never
mentions the main console, and it leaves out the project settings that decide what each project's sessions do (agent,
PR titles, Docs auto-merge, auto fetch), so a user who finishes setup still has to open every project's settings dialog
one at a time. The dialog itself is also cramped: a narrow modal with tight spacing, for the first thing a new user
sees. This change finishes the wizard: the base setup comes first (workspace, agents, console), then every enabled
project's settings, all in a larger, roomier dialog.

## What Changes

- **Workspace: choose a folder with the system's folder dialog.** A **Choose folder…** button opens the operating
  system's own folder picker (Finder on macOS) on the machine the server runs on, and the chosen folder is added as a
  root. Typing a path and the one-click suggestions stay as they are, because the picker can be missing (a Linux
  machine without a desktop session or without `zenity`/`kdialog`). The discovered projects are still listed with
  checkboxes and tracked on Continue.
- **Agents: add every agent CLI the user uses, not just one.** The step lists the configured profiles and every preset
  not configured yet, each with a checkbox and marked found or not found. Presets found on this machine are checked by
  default. The user can also add a custom agent with a name and a command. The user picks the **default agent** among
  the checked ones. Continue adds every checked preset and custom agent as a profile. As before, the wizard never
  removes or edits a profile and never switches agent sessions off.
- **Agent sessions switched on by default in the wizard.** The Agents step's **Turn agent sessions on** starts checked,
  next to the statement of what sessions may do; continuing turns them on unless the user unchecks it. The
  configuration's own default stays off, so nothing changes for a user who skips setup or upgrades.
- **New step, Console.** It explains the main console: an agent with no change and no repository, run in the console
  folder, opened from the top bar, for questions and work across projects. When more than one profile is configured
  the user chooses the **console agent** there: the default agent, or any configured profile.
- **New step, Project settings.** It covers every enabled tracked project, the ones just tracked included. It shows
  the defaults (agent sessions Enabled, the default agent, no PR title convention, Docs auto-merge Off, auto fetch
  every minute) and offers two modes. **Same settings for all projects** is one form applied to every project.
  **Individual settings** walks through the projects one at a time ("Project n of N"). Only the settings the user
  changed are saved; everything else keeps each project's own value. Settings that do not apply to a project (git-only
  ones on a folder without git, Docs auto-merge without agent sessions, Agent with one profile) are left out, as in the
  project settings dialog.
- The steps become **Welcome, Workspace, Agents, Console, Project settings, System check, Done**, shown as "n of 7".
  Welcome and Done cover the new topics: agents added, the console agent, and how many projects' settings were saved.
- **A bigger, roomier wizard.** A wider and taller dialog with a steady height between steps, more padding and space
  between groups, one text size on every step, larger form controls, and steps that fit without scrolling at 1280×800. The 400px viewport rule is unchanged.
- **Automatic fetch waits for setup.** While setup is pending, no project is fetched automatically, so the projects
  the Workspace step tracks are not fetched before the user chose their Auto fetch in Project settings. Fetching starts
  under each project's setting once setup is finished or skipped. Defaults and existing installations are unchanged.
- **Steps passed turn green.** In the step list at the top, every step before the current one is shown green with a
  check, and announced as done.
- **New `POST /api/setup/folder`.** The server opens the native folder picker and answers with the chosen path or
  `cancelled`. It is a mutating route under the same-origin guard, because it starts a process. The script is a
  constant, and nothing from the request reaches the command line. One picker runs at a time. `GET /api/setup` gains
  `folderPicker`, which says whether a picker is available on this machine.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `setup-wizard`: seven steps instead of five. Workspace gains the native folder picker. Agents takes several agents,
  a custom one and the default. There are new Console and Project settings steps. Welcome, Done and the "reads and
  writes" rule are updated (the folder picker is the one process the wizard may start), and the dialog's size and
  spacing are specified.
- `dashboard-api`: `GET /api/setup` gains `folderPicker`, and the new `POST /api/setup/folder` is added.
- `repository-pull`: no automatic fetch while setup is pending; fetching starts once setup is done.

## Impact

- Depends on `setup-wizard` being archived first (`depends-on.yaml`): its `setup-wizard` spec and its `dashboard-api`
  setup endpoints are what this change modifies.
- `src/server/setup.ts`: the folder picker. Per platform it runs one fixed command (`osascript` on macOS; `zenity` or
  else `kdialog` on Linux; PowerShell on Windows) with no shell, and reports whether a picker exists.
  `src/server/api.ts`: the new route and `folderPicker`.
- `src/shared/types.ts` (`SetupState.folderPicker`, the picker result). `src/shared/repoSettings.ts` (new): how a
  project's settings are stored and when they apply, extracted from the per-setting routes in `src/server/api.ts` so
  that the routes and the wizard share them. `src/ui/sessionState.ts`, `src/ui/agentSettings.tsx`: the profile a new
  agent gets, shared by Settings and the wizard.
- `src/ui/setupWizard.tsx`, `src/ui/setupState.ts` (several agents, custom agent, console agent, project settings saves
  and the "only what changed" rule), `src/ui/projectSettings.tsx` (its controls are reused or factored so that the
  wizard shows the same wording), `src/ui/api.ts`, `src/ui/styles.css`, `src/ui/demo/demoApi.ts` (the picker answers
  with a fixed demo folder), `src/ui/changelog.ts`, `README.md` (first start).
- Tests: the picker route (guard, cancel, one at a time, the command chosen per platform, nothing from the body on the
  command line) using a fake picker on `PATH`. The step logic: multi-agent save, console agent save, project settings
  in both modes with only changed fields written, applicability per project. The step list.
- `src/server/autoFetch.ts` (no timer while setup is pending), `src/server/api.ts` (`POST /api/setup/done` re-plans
  the automatic fetch), `CLAUDE.md` (invariant 1's automatic fetch never runs while setup is pending).
- Invariants: no write to a tracked repository beyond what the existing config and tracking routes already allow, and
  no network. The folder picker is a local process that shows a dialog and reads nothing but the user's choice; it
  cannot modify a repository, so invariant 1 is unchanged, and it opens no connection, so invariant 4 is unchanged.
  Project settings are saved through `PUT /api/config`, exactly as the project settings dialog saves them.
