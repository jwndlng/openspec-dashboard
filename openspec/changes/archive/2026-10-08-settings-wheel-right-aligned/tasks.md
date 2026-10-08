# Tasks

## 1. Alignment

- [x] 1.1 In `src/ui/styles.css`, right-align the projects table's actions cell with a selector that outranks `.projects th, .projects td` (`.projects .row-actions { text-align: right; }`, replacing the bare `.row-actions` alignment). Verify that `bun run build:demo` plus a headless screenshot of the overview at a width where the whole table fits shows every row's gear at the right edge, `orbit-data`'s too.
- [x] 1.2 Add a test to `test/overviewStyles.test.ts` asserting that a rule whose selector is scoped under `.projects` and targets `.row-actions` sets `text-align: right`. Verify that it fails against the old CSS and passes with the fix (`bun test test/overviewStyles.test.ts`).

## 2. Check

- [x] 2.1 Confirm the tile footer still ends with the gear at its right edge (screenshot of the tiles view) and run `bun run check`. Verify that it passes.
