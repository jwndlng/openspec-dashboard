# Proposal

## Why

The `Archived` column shows every recent archive alike, so the few archives that still have to be pushed and merged are
buried among the many that are long wrapped up. The board should put what needs attention first and keep finished work
out of the way.

## What Changes

- The board tells apart two kinds of archived change: **merged**, whose archive has reached the repository's main
  checkout, and **pending**, whose archive exists only in a linked worktree — or whose agent worktree still holds
  work that isn't merged yet (uncommitted, not pushed, or pushed but not merged).
- A new **Hide merged** switch in the filter bar, **on by default**, makes the `Archived` column show only pending
  archives. Turning it off shows every archive, as today. The choice is kept in the URL (`merged=1` when merged
  archives are shown). Only a value that differs from the default counts as an active filter, and **Clear filters**
  resets it to on.
- The `Archived` column's count, its `25 of <total>` bound and the number of changes shown follow the switch: merged
  archives it hides are neither counted nor take a place in the bound of 25.
- The switch is disabled while **Hide archived** is on, because there is no column for it to act on.
- The demo site gets archives that are still pending, so its default `Archived` column is not empty.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: the board filters gain **Hide merged** (on by default, in the URL). The `Archived` column's content,
  count and bound follow that switch, and the filter bar gains the switch.
- `demo-site`: the sample data includes archives that are still pending in a worktree, so the default demo board shows
  the `Archived` column with cards.

## Impact

- `src/ui/filters.ts` — new `hideMerged` field, default `true`, parsed from and written to `merged=1`, and counted in
  `hasActiveFilters` only when it is off.
- `src/ui/kanban.tsx` — the pending/merged predicate is applied to the `Archived` column before the bound, and the
  number of changes shown follows it.
- `src/ui/sessionState.ts` (or a small new helper beside it) — the pure pending/merged predicate over a card and the
  session worktrees.
- `src/ui/boardFilters.tsx` — the **Hide merged** switch.
- `src/ui/demo/sampleData.ts` — pending archives in linked worktrees.
- Tests: `test/boardFilters.test.ts`, plus a new test of the predicate, and `test/demoData.test.ts` where it asserts on
  archives.
- No server, API, scanner or snapshot change: the snapshot already records which checkout each change comes from.
  Nothing is written to any repository.
