# Proposal

## Why

The project console control is a 15px terminal icon with no label. On the board it sits at the end of the path row,
after the folder path and **Copy cd**, far from the board's actions. On the projects overview it is the last of several
small icon controls in the agent settings cluster. Users don't find it, and when they do, the icon alone doesn't say
what it opens. The project console is how a user reaches their agent for project work that is not a change. It should
look like an action the user can take, not like a detail of the folder path.

## What Changes

- The project console control gets a visible text label, **Console**, next to its terminal icon, everywhere it is
  shown. Its accessible name and tooltip stay as they are and still name the project, and the visible label is part of
  that name.
- On the repository board the control moves out of the path row into the header's action area. It sits first, ahead of
  **Pull**, **Clean up** and **New change**, and is styled as a regular (non-ghost) button. The action area is shown
  whenever the control is offered, also when the project's last scan failed, because the control does not depend on a
  successful scan.
- On the projects overview (table row and tile) the control becomes an outlined, labelled button. It is set apart from
  the agent settings toggles so it reads as an action, not a setting.
- While a project console runs, the control shows its state in words next to the label as well as with the dot:
  `working`, or `may need you` with how long the terminal has been silent. These are the same words as the session
  badge shows everywhere else.
- Inactive, missing and pending-entry behaviour, the overlay and the session rules are unchanged.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-console`: the control is labelled and placed with the board's actions; its running state is shown in words
  on the control itself, not only in its tooltip and accessible name.

## Impact

- `src/ui/projectConsole.tsx`: `ProjectConsoleButton` gets a visible label, a short running-state text and a variant
  for the board action area.
- `src/ui/kanban.tsx`: the board header renders the control in `band-actions` instead of the path row. The action area
  is also rendered when only the console is offered.
- `src/ui/overview.tsx`: the row and tile render the labelled control apart from the settings toggles.
- `src/ui/sessionState.ts`: `projectConsoleControl` also returns the short visible state text.
- `src/ui/styles.css`: styles for the labelled control in all three places; the tile footer wraps instead of cutting its
  controls off.
- `src/ui/kanban.tsx` also gets a one-line fix found while checking this change: the board's pull-request watch passed
  the browser's `setTimeout` unbound, which threw "Illegal invocation" whenever a card linked a pull request that was
  not ready yet, and broke the board's later effects — among them the project console overlay, which then never
  started a console.
- `test/projectConsoleUi.test.ts`: covers the visible state text.
- `src/ui/changelog.ts`: a What's new entry.
- No server, API, session or invariant changes. Nothing new is written, run or fetched.
