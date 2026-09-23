# Proposal

## Why

The board shows one column per planning artifact (`Proposal`, `Design`, `Specs` for `spec-driven`, others for other
schemas) and a separate `Synced` column before `Archived`. Those are steps an agent runs through in minutes, and
`openspec archive` syncs and archives in one go, so a human reading the board gains nothing from telling them apart:
the columns mostly sit empty, widen the board and the overview, and make the board's shape depend on which schemas the
tracked repositories use. The phases a person actually cares about are: not started, being drafted, ready to build,
being built, finished, archived.

## What Changes

- **BREAKING (board layout)**: the board has six fixed lifecycle columns, in this order: `Backlog`, `Drafts`, `Ready`,
  `Implementing`, `Done`, `Archived` (plus `Unknown` between `Drafts` and `Ready` only while a change's artifacts
  cannot be read). Columns no longer depend on the schemas in use.
- `New` is renamed `Backlog` and now means *no artifact is written yet* (a freshly created change, with or without a
  `prompt.md`).
- The per-artifact columns (`Proposal`, `Design`, `Specs`, `Brief`, `Plan`, …) are replaced by one `Drafts` column:
  at least one artifact is written but not all of them. A card in `Drafts` shows a progress bar of written artifacts,
  `done/total` over the schema's artifacts, styled like the task progress bar and labelled so it is not mistaken for
  tasks.
- The `Synced` column is removed. A change whose tasks are all ticked is in `Done` until it is archived, whether or not
  its delta specs are already synced; it then moves to `Archived`. `specsSynced` stays in the snapshot but no longer
  affects placement.
- Internal stage identifiers follow the columns: `backlog`, `drafts`, `ready`, `implementing`, `done`, `archived`
  (`new`, `artifact` and `synced` go away). The leading copy of a change across checkouts is still chosen by stage,
  then by written artifacts, then by ticked tasks.
- The projects overview shows counts for the same, shorter column list; column hints, header markers, the demo sample
  and the README follow the new names.
- Activity recorded before this change keeps the column names it was recorded with (history is not rewritten).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: column derivation and column list (Backlog/Drafts, no artifact columns, no Synced); the card shows a
  drafting progress bar in `Drafts`; column header markers for the new names.
- `change-scanner`: the stage order used to pick the leading copy of a change names the new stages.
- `project-overview`: per-stage counts use the new column list; a repository board no longer has schema-specific
  columns.
- `change-creation`: a newly created change appears in `Backlog`.
- `activity-feed`: the example of a move event uses the new columns (the detection rule is unchanged).
- `demo-site`: the refused-action example names `Drafts`.

## Impact

- Code: `src/shared/columns.ts`, `src/shared/types.ts` (`Stage`, `IMPLEMENTATION_COLUMNS`),
  `src/server/mergeChanges.ts` (stage rank), `src/ui/kanban.tsx` (card meter, column hints, highlighted columns),
  `src/ui/boardMarks.ts`, `src/ui/overview.tsx` / `src/ui/overviewState.ts` (only via the shared column list),
  `src/ui/demo/sampleData.ts`, `README.md`.
- Tests: `test/parsers.test.ts`, `test/boardMarks.test.ts`, `test/groupState.test.ts`, `test/overview.test.ts`,
  `test/mergeChanges.test.ts`, `test/specSync.test.ts`, `test/worktreeScan.test.ts`, `test/terminalSessions.test.ts`,
  `test/scanner.test.ts`, `test/createChangeApi.test.ts`, `test/demoData.test.ts`, `test/agents.test.ts`,
  `test/format.test.ts`, and any other test asserting on old column names.
- API: `GET /api/state` reports the new `stage` values and column names. The dashboard's own UI is the only consumer.
- Stored state: remembered minimized repository groups keyed by an old column name simply stop matching (they fall
  back to the default); the activity log keeps old names in old entries.
- Ordering: `refactor-design` (merged, not yet archived) adds the kanban-board requirements "Cards show only what an
  overview needs" and "Column headers mark the lifecycle stage", which this change modifies. Archive `refactor-design`
  before this change. Illustrative column names inside other in-flight deltas (`refactor-design`'s tile scenario and
  change-detail checkout tooltip) are left to those changes; see design.md.
- No new dependencies, no new writes, no network: invariants 1–7 are unaffected.
