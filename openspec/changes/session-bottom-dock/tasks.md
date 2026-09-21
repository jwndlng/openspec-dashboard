# Tasks

## 1. State
- [x] 1.1 Pure helpers: `showSession`, `hideSession`, `shownFromSearch`, `searchWithShown` (max three, dedupe, old single-id links) with tests
- [x] 1.2 Provider: `shown` + `focusedId` instead of `panelId`; `openPanel` keeps working for every caller; unknown ids dropped once sessions are loaded; addressed focus tick

## 2. Dock
- [x] 2.1 Split `sessionPanel.tsx` into `SessionDock`, `SessionPane`, `TerminalView`; panes keyed by session id
- [x] 2.2 Tab strip: all running sessions, shown marker, select → show/replace/focus
- [x] 2.3 Pane ✕, collapse to tab strip, maximise
- [x] 2.4 Height: drag handle, keyboard, clamp, remembered in the browser; `--dock-h` reserved below the page content

## 3. Styles
- [x] 3.1 Bottom dock, pane grid, focused pane marker, stacked layout on narrow windows; remove the right-panel styles; theme tokens only

## 4. Docs and verification
- [x] 4.1 `README.md` agent sessions section
- [x] 4.2 `bun run check`, `bun run build`, `build:demo`; rebase onto main if #33/#34 merged
