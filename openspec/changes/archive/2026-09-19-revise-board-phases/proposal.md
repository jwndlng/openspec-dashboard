## Why

The board's phases do not match how a change actually moves. Artifact columns are named after the *next* artifact to write, so a brand-new change sits under "Proposal" and a change whose proposal is finished sits under "Specs" — the opposite of how the column reads. The `spec-driven` schema lists specs before design although design is normally written first. And the end of the lifecycle is one step short: after the last task is ticked a change still has to be synced (its delta specs merged into `openspec/specs/`) and then archived, but the board shows both as a single `Done`, so nothing tells you which finished changes still need a sync.

## What Changes

- **BREAKING** (board semantics): every column now means *the last step that is complete*, giving the lifecycle `New → Proposal → Design → Specs → Ready → Implementing → Done → Synced → Archived`.
  - `New`: the change exists but its first artifact is not written yet.
  - Artifact columns (`Proposal`, `Design`, `Specs`): that artifact and everything before it are written. A change with only a proposal moves from today's `Design` column to `Proposal`.
  - The last artifact (`tasks` in `spec-driven`) no longer has a column: once it is written every artifact is done, which is `Ready`. `Ready`, `Implementing` and `Done` keep their current rules.
  - `Synced` (new): all tasks complete **and** the change's delta specs are already reflected in `openspec/specs/` — it only needs archiving. `Done` now specifically means "complete, specs not synced yet". A complete change with no delta specs has nothing to sync and goes straight to `Synced`.
- Artifact columns are shown design-before-specs for the `spec-driven` schema. Other schemas keep their own artifact order; the rule stays schema-driven, not a fixed column list.
- The scanner detects sync state from the repository alone (no marker file): it parses each delta spec and checks the main spec for added requirements being present, modified requirements matching, removed ones being absent and renames being applied.
- Everything that treats `Done` as "complete, not archived" also covers `Synced`: the completion badge on cards, the highlighted column count, the board's and the overview's "to archive" numbers. The overview's stage columns follow the new board columns automatically.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `kanban-board`: "Board columns are derived from schema and implementation state" is rewritten for last-completed-step semantics, the `New` and `Synced` columns, the dropped last-artifact column and the display order.
- `change-scanner`: adds a requirement that the scanner reports whether a complete change's delta specs are synced into the main specs.

## Impact

- `src/shared/types.ts`: `Stage` gains `"new"` and `"synced"`; `ChangeSnapshot` gains optional `specsSynced`; `IMPLEMENTATION_COLUMNS` gains `Synced`.
- `src/shared/columns.ts`: `deriveStage` and `boardColumns` (last-completed semantics, display order, `New`, dropped last artifact column).
- `src/server/openspecAdapter.ts`: wraps the library's pure `parseDeltaSpec` / `extractRequirementsSection` (no `import.meta.url` lookups, safe in the compiled binary). New `src/server/specSync.ts` for the comparison; `src/server/scanner.ts` calls it for complete, non-archived changes. File reads only — no new git commands, no writes.
- `src/ui/kanban.tsx`, `src/ui/overviewState.ts`: treat `synced` like `done` for badges, highlighting and to-archive counts.
- `test/`: column derivation table, board column order, sync detection (including a round trip through the real `openspec archive`), scanner integration.
- `README.md`: the lifecycle description.
- Snapshots cached by an older version hold old column names; they are replaced by the first scan after upgrade (a few seconds).
- In-flight changes: does not touch "Cards show repository, name, progress, activity and branch" (which `truncate-branch-name` is expected to modify), nor anything `dedupe-discovery` modifies.
