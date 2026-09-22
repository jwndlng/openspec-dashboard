# Proposal

## Why

Starting a change from the dashboard is only possible from one repository's board: from the combined Kanban
(`/board`) — where most of the day is spent — the user first has to navigate to the right project, then click
"New change". The combined board should offer the action itself and let the user pick the project there.

## What Changes

- The combined board (`/board`) gets a **New change** action. It opens the existing create-change form with one extra
  field, a **Project** dropdown listing every repository that can take a new change (enabled, last scan succeeded,
  has an `openspec/` directory to create into) — the same eligibility the repository header already uses.
- The dropdown is pre-selected when the choice is unambiguous: when exactly one repository is eligible, or when the
  board's repository filter narrows it to exactly one eligible repository. Otherwise it starts on an empty
  "Choose a project" entry and the form cannot be submitted until a project is chosen.
- Keyboard focus on open goes to the first field the user has to fill: the Project dropdown when nothing is
  pre-selected, else the change name field. The existing "focus moves once, never again" rule is kept.
- The action is absent when no repository is eligible.
- Submitting posts to the chosen repository's existing `POST /api/repos/<id>/changes`; the rescan and the card
  appearing without a reload work as today. The repository board header keeps its own New change action, without the
  dropdown (its project is fixed).
- No server, API, write-path or git change: the create-change endpoint and its enumerated write stay exactly as they
  are.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `change-creation`: the "New change" action is also offered on the combined board, with a project dropdown; the focus
  requirement names which field is focused when the dropdown is present; submission targets the chosen repository.
- `kanban-board`: the combined board shows the New change action (in its filter row) and the form above the columns.

## Impact

- `src/ui/newChangeForm.tsx` — optional project list; renders the Project dropdown when given, tracks the chosen
  repository, focuses the first field to fill.
- `src/ui/kanban.tsx` — the New change action and the open form on the combined board (filter row / above the board);
  `RepoHeader` keeps passing its fixed repository. **Overlap:** the in-flight `update-detail-view` change also edits
  `src/ui/kanban.tsx`, but only `ChangeCard`; this change touches `Kanban` and `RepoHeader` only.
- `src/ui/repoGroups.ts` (or a small new helper module) — a pure helper deciding the eligible repositories and the
  pre-selected one from the snapshot and the repository filter.
- `src/ui/styles.css` — layout of the dropdown inside the form, if the existing form rows need it.
- `test/` — unit tests for the eligibility/pre-selection helper.
- The demo gets the action for free; its API already refuses `createChange` with a message, which the form shows.
- Not touched: `src/server/`, `POST /api/repos/<id>/changes`, the "never writes" requirement and invariant 1.
