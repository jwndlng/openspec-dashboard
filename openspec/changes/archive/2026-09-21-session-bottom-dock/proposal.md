# Proposal

## Why

Agent terminals live in a fixed panel on the right. It covers part of the board, it is narrow and tall — the wrong shape for a terminal, whose output is wide — and it shows one session at a time, so steering several agents means flipping between tabs without ever seeing two of them. The user runs several sessions at once and wants to watch them together.

## What Changes

- **Bottom dock instead of the right panel.** Agent sessions are shown in a dock at the bottom of the window, spanning its full width, like the terminal pane of an editor. The right-hand panel is removed (**BREAKING** for the layout only; every function of the panel stays).
- **Up to three sessions side by side.** The dock shows one, two or three terminals next to each other, sharing the width equally. Each pane has its own compact header (change, repository, agent, session badge, work status, and the session's actions: next step, Ship, Resume, End / Clean up, Delete record, Copy cd), its own terminal and its own default responses.
- **Tabs for all of them.** The tab strip lists every running session — there can be more than three. A tab shows whether its session is currently in a pane. Selecting a tab that is not shown opens it in a free pane, or, when three are shown, replaces the pane that has the keyboard focus. Selecting a tab that is shown focuses its pane. A pane can be closed (✕ on the pane) without ending its session.
- **The board stays usable.** The page gets bottom padding equal to the dock's height, so no card is hidden behind it. The dock's height can be dragged at its top edge and is remembered in the browser; it can be maximised, and **collapsed to the tab strip**, which keeps running sessions one click away. Closing the last pane collapses the dock; with no running session and nothing shown there is no dock at all.
- **Deep links keep working.** The URL carries the shown sessions in order (`?session=<id>,<id>,<id>`); an old single-id link opens one pane.
- Unchanged: what a terminal shows and how input reaches it, session lifecycle, the end-session dialog, the server and its API.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: the session panel requirement becomes a bottom dock with up to three panes; the tab requirement covers sessions that are not shown.

## Impact

- UI only: `src/ui/sessionPanel.tsx` (split into dock, pane and tabs), `src/ui/sessions.tsx` (provider: a list of shown sessions and the focused one instead of a single `panelId`), `src/ui/sessionState.ts` (URL helpers, pane selection — pure, tested), `src/ui/app.tsx`, `src/ui/styles.css`, `src/ui/demo/` if the demo gains sessions first.
- Each shown pane holds one WebSocket and one xterm instance: at most three.
- Open PRs #33 (one-click sending) and #34 (demo sessions) touch `sessionPanel.tsx` and `styles.css`; this change should be rebased onto them once merged.
- `README.md` agent sessions section.
