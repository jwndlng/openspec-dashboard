# Tasks

## 1. Control state

- [x] 1.1 Make `projectConsoleControl` (`src/ui/sessionState.ts`) return `state`, the running session's badge label
  (`working` or `may need you <duration>`). Leave it unset when no session runs or the control is unavailable. Extend
  `test/projectConsoleUi.test.ts` to cover all three cases and to assert that the name and title are unchanged.
  `bun test test/projectConsoleUi.test.ts` passes.

## 2. Labelled control

- [x] 2.1 Give `ProjectConsoleButton` (`src/ui/projectConsole.tsx`) a `variant: "board" | "project"` prop. Render the
  terminal icon, the visible text `Console`, and, when `state` is set, an `aria-hidden` `.console-state` span. Use a
  regular `btn` for `"board"` and an outlined `btn sm` (not ghost) for `"project"`. Keep the dot, `aria-label`,
  `title`, `disabled` and the `stopPropagation` click handling. Check: `bun run check` typechecks.
- [x] 2.2 Add styles in `src/ui/styles.css` for the labelled control: icon, label and state on one line
  (`white-space: nowrap`), a muted state text, the outlined `project` variant, and a visible separation from the
  settings toggles inside `.agent-controls`. Check in `bun run dev` in light and dark themes.

## 3. Placement

- [x] 3.1 On the board (`src/ui/kanban.tsx`), remove the control from the path row. Render it first in `band-actions`
  with `variant="board"`. Render `band-actions` also when only the console is offered (`projectConsoleUnavailable(...)
  !== null`). Check in `bun run dev`: the order is Console, Pull, Clean up, New change. Also check a board whose scan
  failed and a board with agent sessions disabled (no empty action area).
- [x] 3.2 On the overview (`src/ui/overview.tsx`), render the control in `AgentControls` with `variant="project"`, set
  apart from the toggles. Check in `bun run dev` that clicking it on the row and on the tile opens the overlay without
  opening the board, and that the row stays usable at phone width.
- [x] 3.3 Check the demo site (`src/ui/demo/`) renders the new control without errors, including a running demo
  console's state text.

## 4. Wrap-up

- [x] 4.1 Run `bun run check` (lint, typecheck, tests) and `bun run build`. Both succeed. Open the built binary's UI
  once to confirm the control shows on the board and the overview.
