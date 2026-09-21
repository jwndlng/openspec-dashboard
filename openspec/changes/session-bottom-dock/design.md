# Design

## Context

`SessionProvider` (`sessions.tsx`) holds one `panelId`, mirrored to `?session=`; `SessionPanel` (`sessionPanel.tsx`) is a `position: fixed` aside on the right with `SessionTabs`, a header and one `TerminalView` keyed by session id. `TerminalView` owns an xterm instance, a `FitAddon` driven by a `ResizeObserver`, and the WebSocket; the server replays scrollback to every viewer that attaches, so mounting and unmounting views is cheap and lossless. Everything else (cards, Open work, the end-session dialog, next-step prompts) addresses the panel through `ui.openPanel(id)`.

## Goals / Non-Goals

**Goals:** terminals in a wide, short dock; up to three visible; the board fully usable above; no server change.
**Non-Goals:** draggable splitters between panes (equal widths for now); detaching into windows; keeping the right panel as an option (one layout to maintain); more than three panes; persisting which sessions were shown across browser restarts beyond the URL.

## Decisions

### D1 — State: a list of shown ids plus the focused one
`panelId` becomes `shown: string[]` (max 3, pane order) and `focusedId`. All transitions are pure functions in `sessionState.ts`, unit-tested without a DOM:
- `showSession(shown, focusedId, id)` → already shown: focus it; fewer than 3: append; else replace the focused pane (falling back to the last pane). Returns `{ shown, focusedId }`.
- `hideSession(shown, focusedId, id)` → removes, focus moves to the neighbour.
- `shownFromSearch(search)` / `searchWithShown(search, shown)` → `?session=a,b,c`, first three, deduplicated; a single id is the old format and still valid.
`ui.openPanel(id)` keeps its name and meaning ("show this session") and now calls `showSession`; `openPanel(undefined)` collapses. Callers do not change. *Replace focused rather than oldest:* it is the pane the user is looking at when asking for another session, and it makes the result predictable.

Ids in the URL that match no session are dropped once the session list has loaded (not before, or a reload would lose them).

### D2 — Components
`sessionPanel.tsx` is split: `SessionDock` (container, resize handle, tab strip, maximise/collapse), `SessionPane` (today's header + `TerminalView` + default responses for one id, plus the pane's ✕) and the existing `TerminalView`, untouched except that focus-in reports `ui.focus(id)`. Panes are keyed by session id, so reordering or replacing one pane never remounts the others' terminals. `FitAddon` already refits on container resize, which covers dock height, pane count and window changes; the server receives the resulting `resize` as today.

### D3 — Layout
`.session-dock { position: fixed; left: 0; right: 0; bottom: 0; height: var(--dock-h) }`, panes in a CSS grid `repeat(n, minmax(0, 1fr))`. The provider sets `--dock-h` on `document.documentElement` (collapsed: the tab strip's height; none: `0px`) and `.main` gets `padding-bottom: var(--dock-h)`, so the page's own scrolling reveals everything. Height: pointer drag on a 6 px handle with `role="separator"`, `aria-orientation="horizontal"`, arrow keys ±24 px; clamped to `[160px, 100vh − 120px]`; stored in `localStorage` like the theme, read defensively. Below 900 px window width panes stack to one visible pane with the tab strip doing the switching (three 300 px terminals are useless).

### D4 — Focus and input isolation
Each pane has its own `TerminalView` and socket, so input isolation is structural. The focused pane gets a brand-coloured top border (shape + colour). `focusTick` (used after a next-step prompt) becomes `{ id, tick }` so only the addressed pane takes the keyboard.

## Risks / Trade-offs

- Three xterm instances and sockets at once → bounded by the cap; terminals not shown hold nothing.
- Narrow panes make agents wrap heavily → equal split of a full-width dock gives each pane at least a third of the window; stacking below 900 px.
- I cannot see the rendered result → values (default height 40vh, limits, breakpoint) are constants in one place; the PR asks the user to check both themes.
- Conflicts with open PRs #33/#34 in `sessionPanel.tsx`/`styles.css` → rebase after they merge; this change moves code into `SessionPane` mostly verbatim to keep that rebase mechanical.
