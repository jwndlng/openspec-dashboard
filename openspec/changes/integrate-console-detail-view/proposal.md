# Proposal

## Why

An agent session is shown in a dock at the bottom of the window: a full-width strip with up to three terminals side by
side, its own tab strip across every repository, a draggable height, a maximised state and a collapsed state. It is a
second place to be, next to the board, with its own navigation — and once more than two or three sessions exist,
finding the one you meant means reading a strip of tabs that says nothing about what the change is or where it stands.

A session belongs to exactly one change. So does the detail view, which already gathers everything about that change in
one place. Putting the terminal there makes the console one tab among the change's artifacts instead of a parallel
surface, and leaves a single global list — **Open work** in the top bar — as the only thing that has to span
repositories.

## What Changes

- The change detail view gains a **Console** tab next to its artifact tabs, carrying the session's terminal, its
  header (agent, worktree, branch, badges), its default responses and its actions. The tab and the panel below it use
  the existing blue `--info` token, so the console reads as a different kind of surface from the artifact tabs.
- When a change has more than one session — an Implement session and an Archive session run in separate worktrees —
  the Console tab lists them and shows the selected one, the way the Specs tab lists its files. The selected session is
  part of the URL.
- **BREAKING (UI):** the bottom dock is removed — with it the three-pane layout, the cross-repository tab strip, the
  draggable and remembered height, maximise and collapse, the reserved page space below the board, and the
  `?session=a,b,c` query parameter. Sessions are no longer shown side by side.
- The top bar's **Open work** control becomes the one global view of agent activity: it counts and lists running
  sessions as well as worktrees with uncommitted, unpushed, pushed or merged work, and shows itself whenever either
  exists. Every entry leads to its change's detail view on the Console tab.
- Everything that used to "open the session panel" — the running badge on a card, the work-status badge, a starter
  sent into a running session, an Open work entry — now opens that change's detail view with the Console tab selected.
- A session whose change is no longer in the snapshot (the archive worktree of a change that is already archived, an
  adopted worktree) still opens the detail view by its recorded repository and change name: the artifact tabs explain
  that there is nothing to read, and the Console tab works.
- While the keyboard focus is in the terminal, `Escape` goes to the agent and does not close the overlay. Focus
  elsewhere in the overlay, the backdrop and the close control keep closing it, and closing never ends a session.

## Capabilities

### New Capabilities

None. The console changes where it lives, not what a session is.

### Modified Capabilities

- `change-detail`: the tab strip is no longer one tab per artifact — it gains a Console tab that is not an artifact,
  with its own colour, its own session selection in the URL and its own `Escape` behaviour; the overlay now hosts a
  live terminal, and the detail route must resolve for a change the snapshot no longer carries when a session does.
- `kanban-board`: the dock, its panes and its tab strip are removed; the Open work list widens to running sessions and
  becomes the only cross-repository view of them; every control that opened the session panel now navigates to the
  change's detail view.

## Impact

- `src/ui/app.tsx` — `ChangeDetail` moves inside `SessionProvider` (today it is rendered outside it, and outside
  `div.app`); `SessionDock` is removed from the shell.
- `src/ui/sessionPanel.tsx` — `SessionDock`, `SessionTabs` and the dock's height/maximise/collapse logic go;
  `TerminalView` and the pane header survive as the Console tab's body.
- `src/ui/sessionState.ts` — the pane and dock helpers (`shownFromSearch`, `searchWithShown`, `showSession`,
  `hideSession`, `MAX_SHOWN`, `clampDockHeight`, the `DOCK_*` constants, `sessionTabs`) go; `sessionsForChange` and
  `worktreeForChange` become the Console tab's source.
- `src/ui/sessions.tsx` — `openPanel` navigates to the detail route instead of mutating pane state; `OpenWork` lists
  running sessions too.
- `src/ui/changeDetail.tsx`, `src/ui/routes.ts` — the Console tab, its session selection in `DetailQuery`, and the
  focus-aware `Escape` handling.
- `src/ui/styles.css` — the `.session-dock` / `.dock-*` / `.session-tabs` blocks go; the Console tab and its panel take
  `--info` and `--info-border`; the terminal needs a bounded `min-height: 0` box inside the overlay's flex column, and
  `.console-pane` must itself be a column flex container or that `flex: 1` resolves against nothing.
- `test/dockGeometry.test.ts` is removed with the dock; `test/changeDetail.test.ts` and `test/workStatusUi.test.ts`
  grow the new behaviour. No new colour token, but `test/repoContrast.test.ts` gains `--info` among the hues a
  repository may not wear, and `test/consoleLayout.test.ts` is added for the terminal's box.
- `README.md` — the wording and screenshots that describe the dock.
- No server, API, config or dependency change: the terminal WebSocket, the session records and every guard stay as
  they are. The demo gets the new behaviour for free.

**Changes this one overlaps, and how:**

- `review-open-work-menu` **narrowed** the Open work list to running sessions only, on the reasoning that unshipped
  worktrees were reachable from their cards and from the dock's tab strip. Removing the dock takes one of those away,
  and a worktree whose change has left the board never had a card — so this change **widens** the list again: running
  sessions first, exactly as that change specified them, then the worktrees it excluded. It has since been archived
  (`openspec/changes/archive/2026-09-23-review-open-work-menu`), so the requirement this change works against is the
  narrowed one it left. Its narrowing of *sessions* is kept; only its exclusion of worktrees is reversed.

  That reversal retires four of that requirement's scenarios, one of them (`Stale worktrees stay out`) outright, so
  `Open work list` is **REMOVED** with a `Reason` naming all four and the new behaviour is **ADDED** as
  `Open work lists running sessions and unshipped work`. A `MODIFIED` block replaces a requirement whole, so it cannot
  say that a scenario dies on purpose — keeping the old title over the opposite outcome would leave a false scenario in
  the main spec. This follows `refactor-design`, which retired `Visual design follows the dashboard token set` the same
  way.
- `sessions-in-non-git-repos` added sessions that run **in place**, in a tracked folder that is no git repository and
  therefore has no worktree. That is why the Open work list is built from sessions rather than from worktrees here: a
  worktree-keyed list would silently drop those sessions, and this list is the only place that can find them. The
  Console tab shows an in-place session like any other, minus Ship, work status and worktree removal.
- `refactor-design` **took the work-status badge off the card** and put it in the detail view's header, and its
  `Migration` already states that activating it opens the Console tab. So this change's `MODIFIED` block for
  `Cards show the work status of their change's worktree` had nothing left to modify — that requirement is gone from
  `kanban-board` — and it is dropped from the delta; the behaviour it asked for is already in `change-detail`'s
  "Detail header shows the change's state". In the UI that badge is `WorkStatus` (`src/ui/sessions.tsx`), rendered by
  the detail header and by Open work rows, never by a card.
