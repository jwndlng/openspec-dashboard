## Why

On a board with many repositories a single column can run to dozens of cards: one busy repository pushes every other group below the fold, and the `Archived` column — always open since it became a regular column — adds up to 25 cards of finished work that is rarely the thing being looked for. Repository groups already carry a header with the name and card count, so a group can be reduced to exactly that line without losing the overview: what exists where stays visible, the detail is one click away.

## What Changes

- Every repository group on the board gets a toggle on its header that minimizes or expands it. A minimized group shows only its header — swatch, bold repository name, card count — and none of its cards; it keeps its tinted panel so it still reads as that repository's group.
- The toggle is a real button (keyboard operable, `aria-expanded`), with a chevron indicating the state. The whole header row is the click target.
- Minimizing is per group, i.e. per repository *and* column: minimizing `alpha` in `Implementing` does not touch `alpha` in `Ready`.
- Default state: groups in the `Archived` column start minimized; groups in every other column start expanded.
- The user's explicit choices are remembered in the browser (`localStorage`, like the theme preference) and survive reloads, scans and filter changes. Only deviations from the default are stored, keyed by repository id and column, so repositories that appear later still get the defaults.
- Counts are unaffected: a minimized group's header count and the column header count still include its cards. Filters, search, the stale threshold and the `Archived` bound of 25 apply before grouping exactly as today; minimizing never changes which cards match, only whether they are drawn.
- When a text search is active, groups containing matches are shown expanded regardless of their stored state, so search results are never hidden inside a minimized group; clearing the search restores the previous state.
- Unchanged: single-repository boards render cards flat without group headers, so there is nothing to minimize there (including their `Archived` column); the `Archived` column itself remains always open with no column-level collapse control; group order, colours and panel styling.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`:
  - adds a requirement that repository groups can be minimized to their header, with per-group state, `Archived` groups minimized by default, remembered choices, unaffected counts, and search overriding the minimized state;
  - modifies **Archived column is bounded**: on a multi-repository board the 25 most recent archived changes are presented as minimized repository groups by default rather than as open cards (the "Open by default" scenario changes; the column stays always open and keeps having no collapse control of its own).

## Impact

- `src/ui/kanban.tsx`: `RepoGroups` renders the header as a toggle button and skips the cards of minimized groups; it needs the column label to resolve the default and the active search text for the override.
- `src/ui/repoGroups.ts` (or a small new `src/ui/groupState.ts`): pure helpers for the default per column, resolving stored overrides, toggling, and (de)serialising the `localStorage` value; new unit tests alongside `test/repoGroups.test.ts`.
- `src/ui/styles.css`: header-as-button reset, chevron, hover/focus-visible state, minimized panel spacing — token-based, within the `.repo-group*` rules.
- `README.md`: one sentence in the board description.
- No server, API, snapshot or config changes; nothing is written outside the browser's `localStorage`.
- Other in-flight changes touching the board UI (`truncate-branch-name`: card badges; `create-change-from-dashboard`) do not overlap with the group header, but share `kanban.tsx` and `styles.css`.
