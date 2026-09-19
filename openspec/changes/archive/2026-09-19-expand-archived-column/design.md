## Context

`src/ui/kanban.tsx` renders the board's columns with two components. `Column` is the regular one: a `section.column` with a header (`h2` with a hint tooltip, count) and `RepoGroups`. `ArchivedColumn` is a special case with local `open` state: closed, it is a `button.column.collapsed` — a 48px strip with vertical text and the total count; open, it is a regular-looking column plus a × button, showing the 25 most recently archived changes. The state is not persisted, so the column is collapsed again after every reload or navigation. The "hide archived" filter (URL-persisted) removes the column entirely.

## Goals / Non-Goals

**Goals:**

- `Archived` looks and behaves like any other column: always open, same header, same width, no extra controls.
- Keep the board usable with ~100 archived changes across repositories.
- Remove dead code and CSS rather than leaving an unused collapsed mode behind.

**Non-Goals:**

- Changing the 25-change bound, making it configurable, or adding "show more"/pagination.
- Changing the "hide archived" filter or its default (archived stays visible by default).
- A generic collapse feature for all columns.
- Changing how archived changes are scanned or what archived cards show.

## Decisions

### D1. Keep the 25-most-recent bound

"Like every other column" is about presentation and interaction, not about dropping the limit. Unbounded, the combined board would render ~100 archived cards (growing forever) in a column whose value is "what was archived recently". The bound stays, applied before grouping by repository as today, so the same 25 cards are shown as in the currently expanded column.

*Alternative — unbounded with column scrolling*: columns already scroll independently, so it would work, but it costs render time on every poll and buries recent archives of small repositories under the alphabetically-first repository's long history.

### D2. The header count is the only place the bound is visible

Regular columns show a single number. `Archived` shows the total when everything fits and `25 of 96` when the bound applies — the same text the expanded column uses today. Showing just `25` would misreport the total; showing just `96` above 25 cards would look like a bug. No extra footer or "more…" row: nothing is actionable there (non-goal).

### D3. Fold the special case into `Column` instead of keeping a second component

`ArchivedColumn` minus its state and buttons is `Column` plus a sort/slice and a different count label. `Column` gets an optional `countLabel` (defaults to `cards.length`), and the board computes the bounded list for `Archived` with a small pure helper (`recentArchived(cards, limit)`), so headers — including the hint tooltip from `COLUMN_HINT` — cannot drift apart again. `hot` stays off for `Archived`.

*Alternative — keep `ArchivedColumn` and delete the collapsed branch*: smaller diff, but keeps two header implementations, which is how the column came to look different in the first place.

### D4. "hide archived" is the opt-out, and it already persists

With the strip gone, a user who wants the space back ticks "hide archived"; that lives in the URL, so unlike the old collapsed state it survives reloads and can be bookmarked. No new control is needed.

## Risks / Trade-offs

- [The board gets one full column (272px) wider by default, so more horizontal scrolling on small screens] → `Archived` is the last column, so it is the part that scrolls out of view; "hide archived" removes it and persists.
- [More DOM on first paint: up to 25 extra cards] → bounded and small compared with the 40+ open cards already rendered.
- [Merge overlap with `revise-board-phases` in `kanban.tsx`] → the edit is confined to `ArchivedColumn`/`Column` and the render site; rebase on whatever lands first.
