# Design

## Context

See proposal.md for the motivation. Today the same controls live in two places:

- **Row**: `AgentControls` in `src/ui/overview.tsx` renders `AgentToggle`, `AgentPicker`, `PrTitlesPicker`,
  `AutoMergeToggle` and the `ProjectConsoleButton` in an **Agent sessions** column. `LabelsButton` and `DisableButton`
  sit in `row-actions`.
- **Tile**: `TileSettings` is a native `<details>` whose panel calls the same controls as functions, wrapped in
  `SettingLine`, so a control that returns `null` leaves no line. `useTileSettingsPanels` keeps one panel open at a
  time and closes it on Escape or on a click outside.

The controls in `src/ui/projectSettings.tsx` are hook-free. Their state lives in `useTracking`
(`src/ui/untracked.tsx`), and the UI tests (`test/projectSettingsUi.test.ts`) walk the vnodes that `Row`, `Tile`
and the controls return when called as plain functions. The labels dialog is the precedent for a per-project dialog:
`Tracking.labelsOpen`, `openLabels` and `closeLabels`, and `RepoLabelsDialog` rendered once by `Overview` on top of
`Modal`.

`Modal` (`src/ui/modal.tsx`) handles Escape in the capture phase, the backdrop click and the close control. It does not
move focus back to the control that opened it.

## Goals / Non-Goals

**Goals:**
- One dialog component and one open-state for both layouts, so rows and tiles cannot drift apart again.
- Reuse the existing controls unchanged: the same accessible names, roles, tooltips, off-globally links and busy
  states.
- Return focus to the gear on every close: Escape, the close control, the backdrop, and after the labels dialog
  reached from the settings dialog.

**Non-Goals:**
- Any server, API or configuration change. Saving still goes through the `Tracking` methods.
- Moving **Rename** into the dialog. It edits the name in place, where the name is.
- Changing the labels dialog's content, or the board header's settings.
- Fixing the existing icon-only buttons (rename, labels, disable) against the ui-theme rule that an icon sits beside
  text. The gear follows the same pattern as today's tile gear: an accessible name and a tooltip.

## Decisions

### The dialog's open-state lives in `Tracking`, like the labels dialog
Add `settingsOpen?: string`, `openSettings(id)` and `closeSettings()` to `Tracking`. `Overview` resolves the repository
with `repoOf(config, tracking.settingsOpen)` and renders `ProjectSettingsDialog` once, next to `RepoLabelsDialog`, and
only while that repository is enabled and in the snapshot. Rows and tiles stay hook-free: the gear only calls
`tracking.openSettings(id)`.
*Alternative*: local state per row or tile (as `<details>` effectively was). Rejected: two layouts would need two
implementations, and "at most one dialog" would need the coordination hook we are removing.

### `openLabels` swaps the dialogs; a successful Disable clears `settingsOpen`
`openLabels(id)` also clears `settingsOpen`, so the labels dialog replaces the settings dialog instead of stacking on
it, and two capture-phase Escape handlers never compete. In `disable`'s success path, `settingsOpen` is cleared when it
names that repository. Rendering already hides the dialog once the repository is no longer managed, but clearing the
state as well stops a later re-enable from reopening a stale dialog. On failure the dialog stays open and shows
`tracking.errors[id]`.

### Focus returns to the gear, found by a data attribute
The gear carries `data-project-settings="<id>"`. `Modal` gains an optional `returnFocus?: () => HTMLElement | null`.
It is called when the modal unmounts, deferred by one animation frame so the overview has re-rendered, and the element
it returns is focused if it is still connected. `ProjectSettingsDialog` and `RepoLabelsDialog` both pass a function that
queries `[data-project-settings="<id>"]`. That is how closing labels, opened from the settings dialog, lands back on
the gear: by then the Labels button that opened it is gone.
*Alternative*: remember `document.activeElement` when the modal mounts. Rejected because it breaks in exactly the
labels hand-off: the remembered element is the Labels button inside a dialog that no longer exists. Making the hook
opt-in also leaves the other modals (New change, branches, cleanup) as they are.

### Dialog content reuses the controls as functions inside `SettingLine`
`ProjectSettingsDialog` lays out `SettingLine` rows exactly as `TileSettings` does today: Agent sessions, Agent, PR
titles, and Docs auto-merge with `short: true`. A `Labels` line holds `LabelsButton`, followed by a separated
**Stop tracking** line with `DisableButton`. The busy hint (`aria-live`) and the error notice are copied from
`RepoLabelsDialog`. `SettingLine` moves from `overview.tsx` to `projectSettings.tsx` next to the dialog. Every
control already calls `stopPropagation`, which no longer matters inside a modal but does no harm.
The dialog is `Modal` with `title="Settings"`, `subtitle={repo.name}`, `icon={<IconSettings />}` and the label
`Settings of <name>`. The gear's `aria-label` reads `Settings of <name>`, matching today's tile summary, and its title
is "Settings: this project's agent sessions, agent, PR titles, docs auto-merge, labels and Disable".

### Row and tile layout
- Table: drop the **Agent sessions** `<th>` and the `agent-cell` `<td>` (the `PendingTableRow` column count goes from
  7 to 6). `row-actions` becomes `ProjectConsoleButton`, `PullButton` (when it applies) and `SettingsButton`.
  `AgentControls` is deleted.
- Tile footer: `ProjectConsoleButton`, `PullButton` and then `SettingsButton` pushed to the end (`margin-left: auto`).
  `TileSettings` and `useTileSettingsPanels` are deleted, along with the `.tile:has(.tile-settings[open])` rules.
- The gear is shown only when the project has a config entry (`repo`). That covers the "no config entry yet" case in
  the existing tests, and pending rows render no actions anyway.
- The console keeps its separator styling, moved from `.agent-controls .project-console-btn` to the actions cell.

### CSS
`.setting-line`, `.setting-label` and `.setting-disable` stay but are scoped to the dialog (`.project-settings`). The
panel's absolute positioning, `.tile-settings*`, `.agent-cell` and `.agent-controls` go. The `.control.agent-toggle`
rules stay because the controls are unchanged. The global `.agent-toggle` scoping is
`polish-overview-and-header`'s job; this change rebases onto it.

## Risks / Trade-offs

- [Settings take one more click] → They are changed rarely; the figures the user scans daily get the room. The gear is
  in the same place on every row and tile.
- [Focus return depends on the gear still being on the page] → After Disable the gear is gone; `returnFocus` returns
  null and focus falls back to the body, as when any dialog's opener disappears. Acceptable, and stated in the spec
  ("if that button is still on the page").
- [Merge conflicts with `polish-overview-and-header`] → Declared in `depends-on.yaml`; implement after it merges and
  re-check the toggle CSS visually, including the dashed off-globally border inside the dialog.
- [Tests walk the old panel and the row's agent cell] → Rewrite those tests against `ProjectSettingsDialog`, called as
  a function. The test asserting that the panel lists what a row offers becomes: the dialog opened from a row and from
  a tile is the same component with the same lines.

## Migration Plan

UI only, with nothing persisted. It ships in one release, and rolling back means reverting the commit.
