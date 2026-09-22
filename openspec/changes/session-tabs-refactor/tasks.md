# Tasks

## 1. Strip height

- [ ] 1.1 Raise `.dock-bar` height in `src/ui/styles.css` from 36px to 44px and `DOCK_TABS_HEIGHT` in `src/ui/sessionState.ts` to 44 (design D4). Verify the typecheck in `bun run check` passes.
- [ ] 1.2 Add a test (e.g. in `test/sessionState.test.ts`, or the test file that already covers dock geometry) that reads the `.dock-bar` `height` from `src/ui/styles.css` and asserts it equals `DOCK_TABS_HEIGHT`. Verify it passes, and fails when either number is changed alone.

## 2. Tab surfaces

- [ ] 2.1 Give every `.session-tab` a `--bg-section` background and a `--border` outline on all sides with all corners rounded, inset from the strip's bottom edge; increase vertical padding from 5px to 7px (design D1, D4). Hover raises the outline to `--border-strong` (D2). Tokens only. Verify in the rendered UI that a not-shown tab is visible as its own shape against the strip, in both themes.
- [ ] 2.2 Make `.session-tab.shown` a classic attached tab: top corners rounded only, no bottom border, reaching the strip's bottom edge and covering its bottom border, `--fg-heading` text (D1, D2). Verify with one shown and one not-shown tab that the shown one joins the pane below and the other does not.
- [ ] 2.3 Keep the repository accent (`inset 3px 0 0 var(--repo-color)`) on both tab shapes and check it now sits on the tab's own edge, not floating in the strip. Verify with the demo build, which has sessions in two repositories.

## 3. Focused tab

- [ ] 3.1 Replace the 1px `border-top-color` on `.session-tab.active` with a 2px inset brand bar on top and a semibold change name; add a `.session-tab.repo-tint.active` rule combining both inset shadows so neither overrides the other and no tab changes height (design D3). Verify with three shown tabs, one tinted and focused, that the focused one is clearly marked and the other two are not, in both themes.

## 4. Checks and ship

- [ ] 4.1 Check the collapsed dock: every tab fully visible, the board's last row not hidden behind the strip (reserved space equals the strip height). Check 1, 3 and 5 tabs, with overflow scrolling horizontally as before.
- [ ] 4.2 Confirm `test/repoContrast.test.ts` still covers every tab ground in use (`--bg-base`, `--bg-section`) and passes unchanged; if another ground was introduced, add it there first.
- [ ] 4.3 Run `bun run check` and `bun run build`; confirm the embedded UI in `dist/openspec-dashboard` carries the new `.session-tab` rules.
- [ ] 4.4 Confirm every scenario in `specs/kanban-board/spec.md` of this change is covered by the test or a manual check above, and run `openspec validate session-tabs-refactor --strict`.
