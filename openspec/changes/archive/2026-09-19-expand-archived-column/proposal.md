## Why

`Archived` is the only column that does not behave like a column: it starts as a 48px vertical strip, has to be clicked open on every page load, and once open it carries a close button no other column has. That made sense when the board was one crowded wall of cards, but the board is now grouped by repository and split into per-repository boards, where the most recent archives are useful context ("what just shipped here?") and the odd-one-out strip is mostly friction. Anyone who does not want to see archived changes already has the "hide archived" filter, which persists in the URL.

## What Changes

- The `Archived` column renders like every other column: always open, same width, same header (title and count), same repository groups and cards. The collapsed strip, the click-to-expand behaviour and the close (×) button are removed.
- It stays **bounded**: at most the 25 most recently archived changes, newest first, selected before grouping by repository. When the bound cuts the list the header count reads `25 of 96`; otherwise it shows the total, like other columns.
- The "hide archived" filter is unchanged and becomes the one way to take the column off the board.
- The requirement is renamed from "Archived column is collapsed and bounded" to "Archived column is bounded" to match.
- Applies equally to the combined board and the per-repository boards (they share the column).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `kanban-board`: the requirement "Archived column is collapsed and bounded" is renamed to "Archived column is bounded" and changed — the column is no longer collapsed by default or expandable; it is a regular, always-open column that keeps the 25-most-recent bound and the total count.

## Impact

- `src/ui/kanban.tsx`: `ArchivedColumn` loses its open/closed state, the collapsed button branch and the close button; it keeps the sort, the `ARCHIVED_LIMIT` slice and the `N of M` count, and gets the same header markup (including the column hint tooltip) as `Column`.
- `src/ui/styles.css`: remove the now-unused `.column.collapsed` rules.
- `README.md`: the board description says "Archived (collapsed, 25 most recent)".
- No server, API, snapshot, config or dependency changes. The `project-overview` spec only says the archived column is "the same as on the combined board", which remains true.
- In-flight changes: `revise-board-phases` also edits `kanban.tsx` and the `kanban-board` spec, but a different requirement (column derivation); no delta conflict. It adds a `COLUMN_HINT` map for header tooltips — `Archived` should get an entry there if it has none.
