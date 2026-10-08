# Proposal

## Why

In the projects table the settings gear does not sit at the right edge of its row. The actions cell is meant to be
right-aligned, but a more specific rule that left-aligns every cell of the table overrides it. So the gear lands
right after whichever actions a row happens to have. A row without **Pull** (a scan that failed) or without a fetch note
shows its gear further left than its neighbours, and the gears form a ragged line instead of one column.

## What Changes

- The projects table's actions cell is right-aligned, so every row's settings gear sits at the right edge of the row
  and the gears line up across rows, whichever of Console, Pull and the fetch note a row shows.
- The tile footer already ends with the gear at its right edge. It is unchanged, and its existing behaviour is now
  stated in the requirement too.
- A style test guards the alignment rule against being overridden again.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-overview`: "Each managed project carries its own settings on the overview" now requires the settings button
  to sit at the right edge of a row's actions, aligned across rows, and at the right edge of a tile's footer.

## Impact

- `src/ui/styles.css`: the alignment rule of the projects table's actions cell.
- `test/overviewStyles.test.ts`: a guard for that rule.
- `openspec/specs/project-overview/spec.md`, through this change's delta.
- No server, API, data or behaviour change beyond layout. Nothing that touches a repository.
