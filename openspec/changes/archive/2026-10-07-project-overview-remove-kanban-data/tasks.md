# Tasks

## 1. Overview data

- [x] 1.1 Remove `stageCounts` from `OverviewRow` and from `overviewRows` in `src/ui/overviewState.ts`; update the
      assertions in `test/overview.test.ts` that read it and verify `bun test test/overview.test.ts` passes.

## 2. Table and tiles

- [x] 2.1 In `src/ui/overview.tsx`, drop the `stages` memo and the `boardColumns` import from `Overview`, the stage
      `<th>`s from the table header, and the `stages` prop and stage `<td>`s from `Row`; make the "no open changes" cell
      `colSpan={2}` and the pending row `columns={7}`. Verify the table header lists Repository, Open, To archive, PRs,
      Work in progress, Updated, Agent sessions and the actions column, and no stage name.
- [x] 2.2 Remove the `stages` prop and the `.stage-strip` list from `Tile`, keeping the totals and "no open changes" in
      the tile body; verify a tile for a repository with open changes renders no element with class `stage-strip`.
- [x] 2.3 Delete the `.stage-strip` and `.projects th.stage` rules from `src/ui/styles.css`, and check with
      `bun run dev` that tiles keep one size in both themes and the table fits without the stage columns.
- [x] 2.4 Update the `Row`/`Tile` call sites in `test/untrackedUi.test.ts`, `test/labelChipsUi.test.ts` and
      `test/projectSettingsUi.test.ts` for the removed `stages` prop, and add a test that `Row` and `Tile` for a
      repository with open changes show its open and to-archive counts but no per-stage count (spec scenarios
      "Row content", "No stage columns", "Tile content"); verify `bun run check` passes.

## 3. Docs

- [x] 3.1 Update the **Projects** bullet in `README.md` so it no longer promises open changes per stage; verify by
      reading the bullet.
- [x] 3.2 Add a What's new entry at the top of `src/ui/changelog.ts` saying the overview no longer shows per-stage
      counts and that the breakdown is on each board and on **All changes**; verify `bun run check` passes.
