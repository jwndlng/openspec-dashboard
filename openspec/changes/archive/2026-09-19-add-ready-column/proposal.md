## Why

A change whose artifacts are all done but with zero tasks ticked lands in `Implementing`, so the column mixes "planned and waiting to be picked up" with "actually in progress". With many repos on one board that hides the most useful signal: what is ready to start versus what someone is already working on.

## What Changes

- New `Ready` column (stage `ready`) between the last artifact column and `Implementing`.
- A change is `Ready` when every artifact is done and no task is ticked (`tasks.done == 0`, including a missing or empty tasks file, which keeps its "no tasks" warning badge).
- `Implementing` now strictly means at least one task is ticked and not all are (`0 < tasks.done < tasks.total`).
- Column order becomes: artifact columns → `Ready` → `Implementing` → `Done` → `Archived`.
- **BREAKING** `ChangeSnapshot.stage` gains the value `"ready"`; changes previously reported as `implementing` with `0/N` tasks are now `ready`. Cached snapshots are simply replaced by the next scan.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: the column placement rule and column order gain `Ready`; the "ready to apply" and "empty tasks file" scenarios move from `Implementing` to `Ready`.

## Impact

- `src/shared/types.ts` (`Stage`, `IMPLEMENTATION_COLUMNS`), `src/shared/columns.ts` (`deriveStage`), `test/parsers.test.ts`.
- UI renders columns from `boardColumns()`, so no layout code changes are expected; verify the header counts and any per-column styling in `src/ui/kanban.tsx` / `src/ui/styles.css`.
- README column description.
- No API shape, config or dependency changes.
