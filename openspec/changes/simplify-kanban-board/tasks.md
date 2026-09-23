# Tasks

## 1. Stages and placement (shared)

- [x] 1.1 In `src/shared/types.ts`, replace `Stage` with `backlog | drafts | unknown | ready | implementing | done | archived` and `IMPLEMENTATION_COLUMNS` with one ordered lifecycle column list (`Backlog`, `Drafts`, `Unknown`, `Ready`, `Implementing`, `Done`, `Archived`); update `availableActions` so Archive is offered for `done` only. Verify `bun run check` reports only the call sites fixed in the next tasks.
- [x] 1.2 Rewrite `deriveStage` in `src/shared/columns.ts` per design D2 (count of done artifacts; no `specsSynced` input; `unknown` for unreadable changes) and make `isComplete` mean `done`; remove `DISPLAY_ORDER`, `displayOrder` and `artifactLabel`. Verify with updated `test/parsers.test.ts` cases for every "Board columns follow the lifecycle phases" scenario (backlog, prompt only, proposal only, specs before design, only a later artifact, ready, implementing, done synced and unsynced, no tasks, archived, unknown).
- [x] 1.3 Rewrite `boardColumns` to return the fixed list with `Unknown` only when a change on that board is in it (D3). Verify in `test/parsers.test.ts`: spec-driven, `brief/plan/checklist`, mixed schemas, empty snapshot and an unknown change all give the expected list, with no `Synced` or artifact column.

## 2. Server

- [x] 2.1 Stop passing `specsSynced` into `deriveStage` in `src/server/scanner.ts` while still reporting `specsSynced` on the change; verify `test/specSync.test.ts` and `test/worktreeScan.test.ts` expect `Done` for synced and unsynced complete changes and `specsSynced` is still reported.
- [x] 2.2 Update `STAGE_RANK` in `src/server/mergeChanges.ts` (D5); verify `test/mergeChanges.test.ts` with the old `Proposal` examples renamed to `Drafts` plus the new "Further drafted in a worktree" case (3/4 artifacts in a worktree beats 1/4 in main).
- [x] 2.3 Re-derive `stage` and `column` of cached changes when the scanner adopts the cached snapshot at start-up (D6); verify with a test that a cached snapshot holding a change in `Specs` followed by a scan of the unchanged repository records no `change-moved` event, and one holding a change in `Synced` yields `Done` with no event.

## 3. UI

- [x] 3.1 Give `Meter` in `src/ui/kanban.tsx` a unit for tooltip and accessible name (`N of M artifacts written` / tasks) and show the artifact meter on `drafts` cards, the task meter otherwise when tasks exist, none in `Backlog` (D4); verify with a test of the card's meter choice and labels (`2/4`, `2 of 4 artifacts written`; `0/12` tasks in `Ready`; none in `Backlog`).
- [x] 3.2 Update `COLUMN_HINT`, the `hot` column check (`Done` only) in `src/ui/kanban.tsx` and `LIFECYCLE_KIND` in `src/ui/boardMarks.ts` (D7); verify `test/boardMarks.test.ts` expects neutral for `Backlog`/`Drafts`, accent for `Ready`/`Implementing`, success for `Done`, muted for `Archived`, warning for `Unknown`.
- [x] 3.3 Check `src/ui/overview.tsx` and `src/ui/overviewState.ts` for old names and `synced`; verify `test/overview.test.ts` counts per new column (`Drafts`, `Implementing`, `Done`) and the to-archive count from `Done` alone.
- [x] 3.4 Update the remaining tests asserting old column or stage names (`test/groupState.test.ts`, `test/agents.test.ts`, `test/terminalSessions.test.ts`, `test/scanner.test.ts`, `test/createChangeApi.test.ts`, `test/format.test.ts`, `test/activityEvents.test.ts`, others found by `grep -rn "Synced\|\"New\"\|\"Proposal\"\|\"Specs\"\|\"synced\"\|\"artifact\"" test`); leave activity-log fixtures that stand for old recorded history unchanged. Verify `bun test` passes.

## 4. Demo and docs

- [x] 4.1 Update `src/ui/demo/sampleData.ts` (`FLOW`, `synced` sample flags, the archived event's `from`) so every new column has a card; verify `test/demoData.test.ts` ("every column is populated") passes.
- [x] 4.2 Update `README.md` wherever it lists or describes board columns; verify `grep -n "Synced\|Proposal column" README.md` finds no stale column description.

## 5. Verification

- [x] 5.1 Run `bun run check` (lint, typecheck, tests) and verify it passes.
- [x] 5.2 Run `bun run build` and start `dist/openspec-dashboard` on test data; verify the board shows `Backlog`, `Drafts`, `Ready`, `Implementing`, `Done`, `Archived`, that a Drafts card shows an artifact bar with the right tooltip, and the overview shows the same columns minus `Archived`.
- [x] 5.3 Run `openspec validate simplify-kanban-board --strict` and verify it is valid.
