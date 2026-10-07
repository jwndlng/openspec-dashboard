# Tasks

## 1. Tile structure

- [x] 1.1 Rearrange `Tile` in `src/ui/overview.tsx` into the identity, status, figures, checkouts and footer zones: remove Pull, Labels and Disable from the header, order the badge area as the spec lists, and verify by walking the node tree in a test that the header holds no button and the zones appear in order
- [x] 1.2 Move `OpenPrCount` into a figures row with Open and To archive as three labelled figures; render the idle tile with "no open changes" in place of the two totals, keeping the PR figure, and no count per stage; verify with a test on an idle and a busy tile
- [x] 1.3 Give `TileCheckouts` (no children) its own line below the figures, and make the footer Console, Pull (git and scan ok only) and the Settings summary; verify with a test that a folder without git offers no Pull and a pending tile has no footer actions

## 2. Settings panel

- [x] 2.1 Add the `<details class="tile-settings">` disclosure whose panel renders one labelled line per applicable setting (Agent sessions, Agent, PR titles, Docs auto-merge, Labels) by calling the existing controls, then Disable after a divider, stopping click propagation; verify that `test/projectSettingsUi.test.ts` and `test/untrackedUi.test.ts` still find and activate every control on a tile without the board opening, adjusting them only to look inside the panel
- [x] 2.2 Add a test that the panel shows exactly the lines a row shows for the same project (one agent profile → no Agent line; no git → no PR titles or auto-merge line)
- [~] 2.3 Add the single effect in `Overview` that keeps one panel open, closes it on Escape (returning focus to its summary) and on an outside `pointerdown`; verify by hand in `bun run dev` with two tiles

## 3. Styles

- [~] 3.1 Rewrite the `.tile` grid rows, the figures row, the footer and the `.tile-settings` panel in `src/ui/styles.css` (panel absolutely positioned inside the tile, scrolling; no hover lift while open; footer never wraps, checkout summary truncates); verify in `bun run dev` that tiles of a busy, an idle, a non-git and a failed repository have equal heights and matching zone positions, in light and dark themes, at a narrow window without horizontal scroll

## 4. Wrap-up

- [x] 4.1 Add a `src/ui/changelog.ts` entry describing the reorganised tiles and the Settings panel, and update the console sentence in `src/ui/helpContent.tsx` if it still says where the button sits; verify the What's new and Help pages render
- [x] 4.2 Run `bun run check` and `bun run build`, and open the tiles layout in the built binary; verify both succeed and the tiles look as in the dev build
