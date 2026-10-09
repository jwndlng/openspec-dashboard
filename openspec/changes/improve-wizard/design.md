# Design

## Context

The wizard of `setup-wizard` is `src/ui/setupWizard.tsx` (hook-free step views plus the stateful `SetupWizard`) and
`src/ui/setupState.ts` (pure step logic: choices, preselection, each step's save, the summary). Each step builds its
save from a fresh `GET /api/config` when the user continues, and only adds. Project settings are saved today by the
overview's `Tracking` controls in `src/ui/projectSettings.tsx`, all through `PUT /api/config`. The console agent is
`agentSessions.consoleAgent`, where an absent value means the default. `setup-wizard` ruled out a native folder picker
because the desktop app has no bridge and a browser cannot hand the server a path. That still holds, but the server runs
on the user's own machine (loopback only), so the server can show the dialog itself. See `proposal.md` for the
motivation and the specs for the behaviour.

## Goals / Non-Goals

**Goals:**
- A real folder dialog in both the browser and the desktop app, through one server route, and without a desktop
  bridge.
- The settings the user sees in the wizard are the same settings, with the same wording, as Settings and the project
  settings dialog. They are not a second copy of their rules.
- Saves still only add or change what the user touched. A re-run of setup can never undo something set elsewhere.

**Non-Goals:**
- A folder picker in Settings' Workspace roots or in New project. The route is generic enough to be used there later,
  but that would be its own change.
- Editing prompts, resume commands or environment of an agent in the wizard. A custom agent gets the profile that
  Settings' **+ Add agent** creates, with the name and command filled in, and Settings stays the place to refine it.
- Labels, Rename and Disable in the Project settings step: they are about what a project is, not how its sessions
  behave.
- Detecting whether a custom agent's command exists before it is saved. The System check step reports it, after the
  save.

## Decisions

### The server shows the folder dialog
`POST /api/setup/folder` spawns one constant argument list with `Bun.spawn` (no shell), with `cwd` set to the dashboard
home:
- macOS: `osascript -e 'tell me to activate' -e 'POSIX path of (choose folder with prompt "Choose a workspace folder" default location (path to home folder))'`.
  `tell me to activate` brings the dialog in front of the browser or the desktop window. Exit code 1 with error
  `-128` means cancelled.
- Linux: `zenity --file-selection --directory --title=…`, else `kdialog --getexistingdirectory ~`. Exit code 1 with no
  output means cancelled. It is available only when `DISPLAY` or `WAYLAND_DISPLAY` is set and the program is on the
  `PATH`.
- Windows: `powershell -NoProfile -STA -Command <constant script>` using `System.Windows.Forms.FolderBrowserDialog`. An
  empty output means cancelled.

The output is trimmed, the trailing separator is stripped, and the result goes through `canonicalPath`. Anything that
is not an existing directory is answered `failed`. A module-level "open" flag gives the `409`. A ten-minute timer kills
the process. Availability uses `Bun.which` and is computed per request (cheap), so `GET /api/setup` stays free of
process starts.
*Alternative:* Electrobun's native dialog in the desktop app. Rejected: it needs the bridge that the `desktop-app` spec
deliberately does not have, and browsers would still lack it. *Alternative:* `<input type="file" webkitdirectory>`.
Rejected: it hands the page file contents, not the folder's absolute path, and it would upload a listing of every file.

The route is a POST under `crossSiteRefusal` because it starts a process, the same reasoning as
`POST /api/repos/<id>/issues`. No CLAUDE.md invariant changes: the process touches no repository and no network.
CLAUDE.md's summary of the wizard ("starts no process") is updated to name this one exception.

### Agents: a checklist plus a default, saved as appends
`setupState.ts` replaces the single choice with `{ enable, checked: string[], custom: CustomAgent[], defaultAgent }`.
`agentChoices` already merges configured profiles and presets. Configured ones become `locked` (checked, disabled).
`agentsSave` appends unconfigured checked presets (a `structuredClone` of the preset) and valid custom agents, in list
order, then sets `defaultAgent`. A custom agent's id comes from the same `slugId` Settings uses (moved to a shared
helper), so ids never collide with configured ones. Its command is parsed with the same `parseArgLines`, and its
prompts come from one exported `newAgentProfile(name, command)`, which Settings' **+ Add agent** also uses. The default
agent picker offers only checked agents. Unchecking the current default picks the preselection rule again.

### Console: one field, one rule
`consoleSave(current, choice)` returns `null` when `choice` (with `undefined` for **Default agent**) equals the stored
`consoleAgent`. Otherwise it returns the config with only that field changed. It reads the profiles after the Agents
step's save, so newly added agents are offered. The explanation text is shared with the console overlay's empty state
where the wording overlaps, so the two cannot drift apart.

### Project settings: a draft of edits, applied to a fresh config
The step keeps `edits` rather than whole repo copies: in "all" mode a `Partial<ProjectSettings>`, and in "individual"
mode a `Map<repoId, Partial<ProjectSettings>>`, where `ProjectSettings` is
`{ agentEnabled, agentId, prTitleConvention, autoMergeDocs, autoFetchSeconds }`. Only touched fields are in the draft,
which is what "only what the user changed" means. Switching modes keeps both drafts, and Continue saves the visible
mode's draft. `projectSettingsSave(current, mode, edits, isGit)` maps each edit onto each applicable repo through
small pure setters. Those setters are extracted from the server's per-setting routes, where the dialog's values are stored,
into `src/shared/repoSettings.ts` (for example `withAutoFetch(repo, seconds)`, which drops the key for the default, and
`withRepoAgent(repo, patch)`), so the routes and the wizard store values identically. Applicability (`settingApplies(setting, repo, config, isGit)`) is extracted the
same way from the dialog's visibility rules. The "shared value or Keep each project's setting" display is
`commonValue(repos, setting)`. Editing a "Keep each project's setting" field and setting it back to that option removes
the edit.

`isGit` per repo comes from the latest snapshot, which the wizard receives as a prop and which the app keeps
current as scans finish. Discovery candidates carry no `isGit`, and adding it would change `repo-discovery` for one
consumer. So while a covered repo has no snapshot entry yet (tracked a moment ago, its first scan running), the step
shows "Reading projects…" and renders the form once every covered repo has one. Tracking triggers a scan, but a
scan asked for while another runs is dropped, so a second project tracked right after the first would wait for the
next poll. While it waits, the step asks for a scan (`POST /api/scan`, read-only, a no-op while one runs) and reads
`GET /api/state` every 1.5 seconds.

The form controls are the dialog's controls, rendered controlled (value plus `onChange`) instead of saving
immediately. The pickers in `projectSettings.tsx` are split into a presentational part (labels, options, tooltips,
accessible names) and the `Tracking` wrapper that saves at once. The wizard uses the presentational part, so wording
and option lists stay single-sourced.

### Steps and layout
`SETUP_STEPS` grows to seven, and the frame already derives "n of N" from it. The dialog gets its own size class rather
than `.modal.wide`: `width: min(960px, 100% - 32px)`, `height: min(720px, 100dvh - 48px)`, a flex column with the body
`overflow: auto` between a fixed head and footer, so the size is steady across steps. The body uses 32px horizontal
padding, 24px between groups, 15–16px text, and form controls of at least 40px. Under 560px the dialog falls back to
the full width minus the page margin, with the current tighter padding. The tokens already in `styles.css` (`--gap-*`,
`--radius-*`) are used, with no new colours.

### Demo
`demoApi.ts` answers `GET /api/setup` with `folderPicker: true` and `POST /api/setup/folder` with
`{ status: "chosen", path: <demo root> }`, so the button can be seen working without opening any dialog.

## Risks / Trade-offs

- [macOS asks for Automation permission, or the dialog opens behind the window] → `choose folder` from `osascript`
  itself needs no Automation permission (it does not script another app), and `tell me to activate` raises it. If it
  still fails, the step shows the reason and typing stays available.
- [The server runs where the user is not, e.g. over SSH with a forwarded port] → on Linux, availability requires a
  display. On macOS a dialog could appear on a screen nobody watches. It is closed after ten minutes and answered
  `cancelled`, and the typed path is always available.
- [Applying "same for all" overwrites a project's deliberate value] → only fields the user touched are written, mixed
  values read **Keep each project's setting**, and the form says how many projects each setting applies to.
- [Projects still scanning have no `isGit`] → the step waits for their first scan, saying so, and Continue and Skip
  stay available meanwhile. A scan that fails still yields an entry (`ok: false`, `isGit` as detected), so the wait
  ends.
- [Larger dialog on small laptop screens] → the height is capped by the viewport and the body scrolls inside.

## Migration Plan

No data migration: no new configuration key. The change has to land after `setup-wizard` is archived, because its
deltas modify that spec. Rolling back to an earlier binary leaves the configurations it wrote fully readable.
