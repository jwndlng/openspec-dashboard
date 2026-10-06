# Design

## Context

`ProjectConsoleButton` (`src/ui/projectConsole.tsx`) is a single component, a `btn sm ghost` icon button with a status
dot. It is rendered in three places: the board header's path row (`src/ui/kanban.tsx`, after **Copy cd**), and
`AgentControls` in `src/ui/overview.tsx`, which is used by both the overview table row and the tile. Its name, tooltip,
disabled state and badge come from `projectConsoleControl` (`src/ui/sessionState.ts`), which is unit-tested in
`test/projectConsoleUi.test.ts`. The board's action area (`band-actions`) is only rendered when
`canGit || repo.ok`, but the spec says the control must not depend on a successful scan.

## Goals / Non-Goals

**Goals:**
- One component in all three places, with a placement variant. No second, divergent console control.
- The visible state text comes from the same `sessionBadge` the name and tooltip already use, so the words cannot
  diverge.

**Non-Goals:**
- No change to the overlay, the session manager, the API or which sessions count as a project's console.
- No change to the main console control in the top bar, which keeps its icon-only form.
- No onboarding-tour step for the project console. That can be a separate change.

## Decisions

- **A `variant` prop on `ProjectConsoleButton`: `"board"` or `"project"`.** `"board"` renders a regular `btn` (not
  `sm`, not `ghost`) that matches its neighbours in `band-actions`. `"project"` renders an outlined `btn sm` for the
  overview row and tile. Both show `<IconTerminal/> Console`, plus the state text while a session runs. This follows
  `PullButton`'s `compact` prop instead of adding a second component. *Alternative:* separate board and overview
  components. Rejected, because the availability and state logic would have to stay in sync twice.
- **`projectConsoleControl` returns `state?: string`, the badge's `label`.** It is set only while a session runs. The
  component renders it as a muted `<span class="console-state">`. The dot stays as a second cue. The accessible name
  already contains the badge label, so screen readers hear it once through the name. The visible span is
  `aria-hidden`, so it is not announced twice. *Alternative:* render the full `SessionBadgeView`. Rejected, because the
  pill is too heavy inside a button and would duplicate the dot.
- **Visible label in the accessible name.** The name is `Open the console of <project>`, which contains "console", so
  the label-in-name rule (WCAG 2.5.3) holds without changing the name. The tests keep asserting the name unchanged.
- **Board action area rendering.** The condition becomes
  `canGit || repo.ok || consoleOffered`, where `consoleOffered` is `projectConsoleUnavailable(...) !== null`. That is
  the same check the button uses to decide whether to render. That way the area never renders empty.
- **Overview separation.** In `AgentControls` the console button moves out of the settings cluster's flow behind a
  divider (`.agent-controls .project-console-btn { margin-left: … }` with a left border/gap). On the tile it keeps
  the right-hand slot that `agent-controls` already takes in `.checkouts`. No new column in the table.
  *Found while implementing:* the tile's fixed 296px height and 44px footer already cut the settings off on main
  (and hid the icon control behind them). The footer now wraps and the tile has a minimum height instead of a fixed
  one, so the labelled control is always visible; tiles in one grid row still share the tallest one's height.

## Risks / Trade-offs

- [Wider overview rows] A labelled button with state text is wider than an icon, and the agent cell can wrap on narrow
  windows. → Use a short label ("Console"). The state text is the badge's short label, and the cell already wraps
  gracefully (`inline-flex` with gap). Check the result at phone width.
- [Changing state text shifts layout] `working` ↔ `may need you 4m` changes the button width while polling. → Accept
  it on the board, because the button sits at the start of a wrapping flex row. Give `.console-state` `white-space: nowrap`.
