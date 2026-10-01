# Proposal

## Why

`simplify-project-mgmt` moved Enable, Disable, Ignore and Integrate to the Projects overview. Two lists of
repositories are still left in Settings: the **Tracked repositories** section (enable checkbox, rename, forget) and the
**Repositories** list inside Agent sessions (per-repository on/off and agent picker). Each repeats the overview's list
of projects, and each has to be saved separately. The user now manages a project in three places. Everything that is
about one project should be on that project's row on the overview, and it should take effect at once, like Enable and
Disable already do.

## What Changes

- **BREAKING (UI)**: Settings loses the **Tracked repositories** section (`tracked`) and its navigation entry. Old
  `?section=tracked` deep links fall back to the top, like any unknown section. Settings keeps Workspace roots,
  Scanning, Agent sessions, Shared OpenSpec config and Environment.
- **BREAKING (UI)**: The Agent sessions section loses its **Repositories** list. A hint in its place says that agent
  sessions are switched on or off per project on Projects, and links there. The global **Enable agent sessions**
  switch stays in Settings and stays off by default.
- Each managed project on the overview, as a table row and as a tile, gets:
  - an **Agent sessions** toggle labelled **Enabled** / **Disabled**, saved at once. A project with no saved setting
    shows **Enabled**, as today: once the global switch is on, every project is included unless switched off. While
    the global switch is off, the toggle is shown but inactive, with the reason and a link to Settings › Agent sessions;
  - an **agent picker** beside the toggle, saved at once, offering "default agent" and every configured profile. It is
    shown only when more than one agent profile is configured and the project's agent sessions are enabled;
  - **Rename**: the name becomes an input in place. Enter or leaving the field saves, Escape cancels, and an empty
    name is refused. The new name is shown at once on the overview and the boards without waiting for a
    scan.
  - **Labels**: a dialog with the labels editor that add-project-labels put in Settings (custom labels, hiding a
    detected label). Each edit is saved at once.
- Each **disabled** entry under Unmanaged projects gets **Forget**, saved at once and without a confirmation. It
  removes the repository from the configuration, along with its name and agent settings. Discovery then runs again,
  so a forgotten repository that is still under a workspace root shows up again as a discovered `OpenSpec` entry.
- New same-origin-guarded API routes, each one narrow config update through the serialised `updateConfig`:
  `POST /api/repos/<id>/name` (`{ name }`), `POST /api/repos/<id>/agent` (`{ enabled?, agentId? }`, where
  `agentId: null` means the default agent), `POST /api/repos/<id>/labels` (`{ labels?, hiddenLabels? }`), and `POST /api/repos/<id>/forget`, which works only on a disabled
  repository. `PUT /api/config` is unchanged. Settings still sends `repos` back as it received them.
- The demo implements the four operations in memory, like `trackRepo` and `setRepoEnabled`.

## Capabilities

### New Capabilities

None. The behaviour belongs to existing capabilities.

### Modified Capabilities

- `project-overview`: new requirements for per-project settings on managed rows and tiles (agent-session toggle,
  agent picker, rename) and for Forget on disabled entries.
- `settings-page`: the section list drops `tracked`, and the navigation-count requirement drops the Tracked
  repositories count.
- `repo-discovery`: the Settings view no longer lists, toggles, renames or forgets tracked repositories. Forgetting
  happens on the overview.
- `agent-sessions`: a project is switched off for agent sessions, and given its own agent, on the projects overview
  instead of in the Agent sessions settings.
- `dashboard-api`: a new requirement for the per-repository settings endpoints (name, agent, labels, forget).
- `project-labels`: custom labels and hidden detected labels are edited in a dialog on the overview, saved at once,
  instead of in Settings → Tracked repositories.
- `demo-site`: the per-project settings and Forget work in the demo's in-memory configuration.

## Impact

- `src/server/api.ts`: the four routes, behind `crossSiteRefusal`, using `updateConfig` and `afterConfigChange` like
  the existing tracking routes.
- `src/ui/api.ts`, `src/ui/demo/demoApi.ts`: `renameRepo`, `setRepoAgent`, `setRepoLabels`, `forgetRepo` on the `Api` interface.
- `src/ui/untracked.tsx`: `useTracking` gains rename, agent and forget actions with the same busy and error handling.
  Disabled entries get **Forget**.
- `src/ui/overview.tsx`, `src/ui/overviewState.ts` (if row data needs the agent setting), `src/ui/styles.css`: the
  toggle, the picker and rename on rows and tiles.
- `src/ui/settings.tsx`, `src/ui/settingsSections.ts`: the `tracked` section removed.
- `src/ui/labels.tsx`: the editor's tooltip and wording point to the overview; a `RepoLabelsDialog` wraps it.
- `src/ui/agentSettings.tsx`: the Repositories list removed and replaced by a link to Projects.
- `test/`: `trackingApi.test.ts` (new routes, guard, refusals, serialised writes), `untrackedUi.test.ts`,
  `overview.test.ts`, `settingsSections.test.ts`, `agentSettingsUi.test.ts`, `demoApi.test.ts`.
- `README.md`, if it mentions renaming or per-repository agent settings in Settings.
- Invariant 1 is untouched: the routes write only `~/.openspec-dashboard/config.json`. Invariant 2a: each route goes
  through `crossSiteRefusal`. The global sessions switch is still off by default. No new dependency and no network.
- **Overlap**: `add-project-labels` is merged but not archived yet; its labels editor moves here, and the
  `project-labels` delta must be archived after it (archive refuses a delta against a spec that does not exist yet). `finish-integrate` also edited
  `src/ui/agentSettings.tsx` (prompt fields only), but it is merged, so this change builds on its code.
  `add-validate-phase` and `do-not-open-console-on-action` touch none of these files.

## Non-goals

- Changing the global agent-sessions default, or moving the global switch, agent profiles, shortcuts or the console
  folder out of Settings.
- Renaming, toggling agent sessions or picking an agent for unmanaged entries.
- Forgetting an enabled repository directly. It is disabled first, which is one click on the same overview.
- Changing what the per-repository agent setting does once saved.
