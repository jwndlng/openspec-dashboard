# Proposal

## Why

The projects overview repeats the Kanban board on every row: one count column per stage (Backlog, Drafts, Ready,
Implementing, Done, …) in the table and a stage strip on every tile. That is more data than a landing page needs — it
widens the table, crowds the tiles and pulls the eye away from what the overview is for: which project to open next.
Whoever wants the breakdown per stage already has it on the project's board and on **All changes** (`/board`).

## What Changes

- The overview table no longer has one column per board stage; a row keeps the repository name, the open total, the
  to-archive count, work in progress, pull requests, the last-updated age and its settings.
- The overview tiles no longer show the per-stage strip; a tile keeps the open and to-archive totals as large numbers,
  the badges and the checkout summary, at the same fixed size.
- Nothing else changes: sorting (including by open count), search, the work-in-progress filter, the header band's
  `Tracked`/`Open`/`To archive` counts, "no open changes", the scan-failure warning and the drill-down stay as they are.
  The per-stage breakdown remains on every board.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-overview`: "Overview rows summarise each repository", "Overview offers a table and a tiles layout" and
  "Tiles have one size and one layout" drop the per-stage counts from rows and tiles.

## Impact

- `src/ui/overview.tsx` — drop the stage columns from the table header and `Row`, the stage strip from `Tile`, and the
  `stages` prop and its `boardColumns` computation; adjust the colspans that counted the stage columns.
- `src/ui/overviewState.ts` — drop `stageCounts` from `OverviewRow`.
- `src/ui/styles.css` — remove the now unused `.stage-strip` and `.projects th.stage` rules; keep the tile's fixed size.
- Tests: `test/overview.test.ts`, `test/untrackedUi.test.ts`, `test/labelChipsUi.test.ts`,
  `test/projectSettingsUi.test.ts` (the `stages` prop and the pending row's colspan).
- `README.md` (the Projects bullet), `src/ui/changelog.ts` (What's new entry).
- No API, server, scanner or snapshot change; no new dependency.
