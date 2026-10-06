# Design

## Context

See proposal.md — Why. Today `Overview` in `src/ui/overview.tsx` computes `stages` from `boardColumns(snapshot)` minus
`Archived` and passes it to `Row` (one `<td>` per stage, plus `colSpan={stages.length + 2}` for the "no open changes"
cell) and `Tile` (the `.stage-strip` list), and to `PendingTableRow` as `columns={stages.length + 7}`. The counts come
from `OverviewRow.stageCounts`, filled in `overviewRows` (`src/ui/overviewState.ts`). Nothing else reads `stageCounts`.
A tile is a fixed-size grid (`grid-template-rows: 40px 46px minmax(0, 1fr) minmax(44px, auto)`, `min-height: 296px`)
whose third row holds `.tile-body` with the totals and, below them, the strip.

## Goals / Non-Goals

**Goals:**
- Remove the per-stage counts from both overview layouts and every piece of code that only exists for them.
- Keep every tile the same size and keep the totals where they are.

**Non-Goals:**
- No change to the boards (the per-stage breakdown stays there), the header band, sorting keys, the URL state or the
  snapshot/API (`RepoSnapshot` keeps whatever it has; the overview simply stops deriving per-stage counts).
- No option to bring the columns back; **All changes** and the repository board are the place for that view.

## Decisions

- **Delete rather than hide.** Drop the `stages` prop from `Row` and `Tile`, the `stages` memo and the `boardColumns`
  import from `Overview`, and `stageCounts` from `OverviewRow`. A hidden-but-computed column would be dead code and
  would keep the `boardColumns` dependency on the overview alive for nothing. Alternative considered: a toggle to show
  stage columns — rejected, the user asked for less, and the boards already give the breakdown.
- **Colspans become constants.** The "no open changes" cell spans the open and to-archive columns (`colSpan={2}`); the
  pending row spans the columns after the name (`columns={7}`), i.e. what it spans today minus the stages. The
  existing test that asserts the pending row's colspan keeps passing its own value through, so it stays a check of
  `PendingTableRow`, while a new assertion pins the table header to the non-stage columns.
- **Tile keeps its grid.** `.tile-body` keeps its row and `justify-content: flex-end`, so the large totals sit at the
  bottom of the body above the checkout footer, exactly where they are today; the tile's fixed size does not depend on
  the strip. The `.stage-strip` and `.projects th.stage` rules are deleted; `.projects .zero` stays (the to-archive
  placeholder still uses it).

## Risks / Trade-offs

- [Users relied on the at-a-glance stage breakdown] → it is one click away on the project's board and on **All
  changes**; the What's new entry says where it went.
- [Tiles look emptier] → the body keeps its height so tiles stay uniform; the large totals remain the visual anchor.
  Checked visually in both themes with `bun run dev`.
