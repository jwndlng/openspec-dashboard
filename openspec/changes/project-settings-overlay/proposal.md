# Proposal

## Why

The projects overview is overloaded. Every table row shows the project's settings inline: the Agent sessions switch, the
agent picker, the PR titles picker and the Docs auto-merge switch, followed by Labels and Disable. Each tile has a
different home for the same settings, a disclosure panel laid over the tile. The rows are wide and noisy, the two
layouts behave differently, and a setting changed once in a while takes as much room as the figures the user scans
every day.

## What Changes

- Each managed project's row and tile get one **settings** icon button (a gear). Its accessible name and tooltip name
  the project.
- The gear opens a **project settings dialog** built on the existing `Modal`. It holds, in this order, the Agent
  sessions switch, the agent picker, the PR titles picker and the Docs auto-merge switch, then **Labels** and
  **Disable** set apart after them. Each control keeps today's behaviour, wording, switch role, visibility rules and
  off-globally state (a link to Settings › Agent sessions). The dialog shows the project's saving state and error,
  like the labels dialog does.
- The dialog closes with Escape, with its close control and with a click on the backdrop. Focus then returns to the
  gear that opened it. It also closes when the project leaves Managed projects, for example after Disable. **Labels**
  replaces it with the labels dialog, and closing that dialog also returns focus to the gear.
- **BREAKING (UI)**: the table loses its **Agent sessions** column. The row's inline settings, its Labels button and
  its Disable button go away. The row's action cell holds **Console**, **Pull** (when it applies) and the gear.
- **BREAKING (UI)**: the tile's **Settings** disclosure panel goes away, along with the logic that keeps one panel
  open at a time. The tile's footer holds **Console**, **Pull** (when it applies) and the gear at the end.
- **Console** stays on the row and the tile: it is an action, not a setting. **Rename** stays beside the name.
- A pending `Scanning…` entry still offers no settings, so it shows no gear.
- No server, API or configuration change. The onboarding tour points only at the hero header, and neither the tour
  nor the demo targets the inline controls; the demo shows the dialog with no change to its data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-overview`: "Each managed project carries its own settings on the overview" moves the settings from inline
  (row) and the tile panel into the project settings dialog, for both layouts. "Tiles have one size and one layout"
  replaces the footer's Settings disclosure with the gear and drops the panel scenarios. "Repositories are enabled,
  disabled and ignored from the overview" offers a tracked repository's Disable in that dialog.
- `project-labels`: "Custom labels are edited on the projects overview" offers **Labels** in the project settings
  dialog instead of directly on the row and tile.
- `project-console`: "Each managed project offers a project console" sets the overview's Console control apart from
  the settings button instead of from inline agent settings.

## Impact

- `src/ui/overview.tsx`: `Row`, `Tile`, the table header, `AgentControls`, `TileSettings`, `SettingLine` and
  `useTileSettingsPanels`, plus rendering the new dialog.
- `src/ui/projectSettings.tsx`: the new `ProjectSettingsDialog` and `SettingsButton`. The existing controls are reused
  unchanged.
- `src/ui/untracked.tsx`: `Tracking` gains `settingsOpen`, `openSettings` and `closeSettings`. `openLabels` closes the
  settings dialog.
- `src/ui/modal.tsx`: an optional way to choose where focus returns on close.
- `src/ui/styles.css`: rules for the dialog's setting lines. The rules for `.agent-cell`, `.agent-controls`,
  `.tile-settings` and the panel are removed.
- `test/projectSettingsUi.test.ts` and any other UI test that walks the row cells or the tile panel.
- `openspec/specs/project-overview`, `project-labels` and `project-console`, through the delta specs.
- **Dependency**: `polish-overview-and-header` changes the same `.agent-toggle` CSS and the overview's toggles. This
  change is implemented on top of it once it has merged.
