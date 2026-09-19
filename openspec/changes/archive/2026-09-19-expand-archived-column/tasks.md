## 1. Column rendering

- [x] 1.1 Add a pure helper `recentArchived(cards, limit)` (archive date descending, sliced to `limit`) in `src/ui/repoGroups.ts` or next to `ARCHIVED_LIMIT`, and unit-test it: newest first, bound applied, fewer than the limit returns all, input not mutated
- [x] 1.2 Give `Column` in `src/ui/kanban.tsx` an optional `countLabel` prop that replaces `cards.length` in the header when set
- [x] 1.3 Render `Archived` through `Column`: pass `recentArchived(archivedCards, ARCHIVED_LIMIT)` as cards and `countLabel` of `"<shown> of <total>"` when bounded, otherwise the total; keep `hot` off and keep the `filters.hideArchived` check at the render site
- [x] 1.4 Delete `ArchivedColumn` (open state, collapsed button branch, × button) and any imports that become unused
- [x] 1.5 Make sure `COLUMN_HINT` has an `Archived` entry (e.g. "Archived changes — 25 most recent") so its header has the same tooltip behaviour as other columns

## 2. Styles and docs

- [x] 2.1 Remove the unused `.column.collapsed` rules from `src/ui/styles.css` and check nothing else references `collapsed`
- [x] 2.2 Update the board description in `README.md` ("Archived (collapsed, 25 most recent)" → always shown, 25 most recent, hide with the filter)

## 3. Verification

- [x] 3.1 `bun run check` passes (lint, typecheck, tests)
- [x] 3.2 `bun run build:ui` and check the real board in both themes: `Archived` is open on load with the same header and width as other columns, shows `25 of N`, cards are grouped by repository, there is no × or click-to-collapse, and "hide archived" removes it and survives a reload
- [x] 3.3 Check a repository board (`/repo/<id>`) with fewer than 25 archived changes: all shown, plain count, no group headers
- [x] 3.4 `openspec validate expand-archived-column --strict` passes
