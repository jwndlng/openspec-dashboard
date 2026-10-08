# Tasks

## 1. Before starting

- [x] 1.1 Confirm `polish-overview-and-header` has merged, rebase this branch onto `origin/main`, and check that `bun run check` passes before any edit

## 2. State and focus plumbing

- [x] 2.1 Add `settingsOpen`, `openSettings(id)` and `closeSettings()` to `Tracking` in `src/ui/untracked.tsx`. `openSettings` clears that project's error, `openLabels` clears `settingsOpen`, and a successful Disable clears `settingsOpen` when it names that repository. Verify with a unit test on the tracking reducer, or with the UI test in 5.1
- [x] 2.2 Add an optional `returnFocus` to `Modal` (`src/ui/modal.tsx`). On unmount it focuses the returned element one frame later, if that element is still connected. Leave the other modals unchanged, and verify that `bun test` still passes for the modal-based dialogs

## 3. The dialog and the gear

- [x] 3.1 Move `SettingLine` into `src/ui/projectSettings.tsx`. Add `SettingsButton` there: a ghost icon-only gear with `data-project-settings=<id>`, the aria-label `Settings of <name>` and a tooltip, which calls `tracking.openSettings` and stops the click. Verify with a test that its accessible name includes the project's name
- [x] 3.2 Add `ProjectSettingsDialog` on `Modal` (title Settings, subtitle the name, gear icon). It holds the lines Agent sessions, Agent, PR titles and Docs auto-merge (short), then Labels, then a separated Stop tracking line with Disable, plus the busy hint and error notice. It passes `returnFocus` to the gear. Verify by calling it as a function in a test and checking the line order and that controls that do not apply leave no line
- [x] 3.3 Pass the same `returnFocus` (to the gear) to `RepoLabelsDialog`, and verify with a test that it is set for the dialog's project

## 4. Overview layout

- [x] 4.1 In `src/ui/overview.tsx`, drop the Agent sessions `<th>` and the `agent-cell` `<td>`, delete `AgentControls`, set the `PendingTableRow` column count to 6, and make `row-actions` hold Console, Pull and the gear. Remove the row's Labels and Disable. Verify with a test that a row holds no switch, picker, Labels or Disable
- [x] 4.2 Replace `TileSettings` with `SettingsButton` at the end of the tile footer, and delete `useTileSettingsPanels` and its call. Verify with a test that the footer holds Console, Pull and the gear, and that no `details` element remains
- [x] 4.3 Render `ProjectSettingsDialog` in `Overview` next to `RepoLabelsDialog`, only while `settingsOpen` names an enabled repository that is in the snapshot. Verify in the running app (`bun run dev`) that it opens from a row and from a tile without opening the board
- [x] 4.4 Update `src/ui/styles.css`: scope the `.setting-line` rules to the dialog, move the console separator to the actions cell, and remove `.agent-cell`, `.agent-controls`, `.tile-settings*` and the `.tile:has(.tile-settings[open])` rules. Verify with `grep` that nothing references the removed classes, and check in both themes that the row height and the tile size are unchanged

## 5. Tests

- [x] 5.1 Rewrite the row and tile tests in `test/projectSettingsUi.test.ts` against the dialog. Cover: switches, pickers, PR titles and auto-merge inside the dialog, with the same names and roles; the off-globally link; a folder without git; one agent; a pending entry with no gear; the same dialog from a row and a tile; Labels replacing the dialog; Disable from the dialog; and an error shown in the dialog. Verify with `bun test test/projectSettingsUi.test.ts`
- [x] 5.2 Update any other test that walks the row cells or the tile panel (search `test/` for `agent-cell`, `tile-settings` and `Settings of`), and verify that `bun run check` passes

## 6. Tour, demo and manual checks

- [x] 6.1 Confirm that no `data-tour` anchor and no demo or screenshot code targets the removed controls (`grep -rn "tile-settings\|agent-cell\|agent-controls" src scripts`). Then open the demo build (`bun run build:demo`) and check that the gear opens the dialog in both layouts
- [x] 6.2 Check manually in `bun run dev`, with the keyboard only: Tab to a row's gear and press Enter, toggle Docs auto-merge, press Escape, and confirm that focus is back on the gear. Repeat from a tile, and through Labels then Escape. With agent sessions off globally, confirm that the dialog shows the dashed off-globally links to Settings › Agent sessions
- [x] 6.3 Run `bun run build` and open `dist/spec-control` to confirm that the dialog works in the compiled binary
