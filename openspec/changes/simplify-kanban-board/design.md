# Design

## Context

Placement is one pure function, `deriveStage` in `src/shared/columns.ts`, run by the scanner for every checkout's copy
of a change. The column list comes from `boardColumns(snapshot)`, which builds artifact columns per schema (with a
`spec-driven` display-order override) and appends `IMPLEMENTATION_COLUMNS` from `src/shared/types.ts`. Both the board
(`src/ui/kanban.tsx`) and the overview (`src/ui/overview.tsx`) call `boardColumns`. `Stage` values are used by
`mergeChanges.ts` (leading copy), `availableActions` (starters), `isComplete` (to-archive counts) and the demo. The
activity log diffs consecutive snapshots by `column` string, and the scanner starts from the cached
`~/.openspec-dashboard/cache/snapshot.json`.

Requirements are in `specs/kanban-board/spec.md` ("Board columns follow the lifecycle phases", "Cards show only what an
overview needs"); motivation is in proposal.md.

## Goals / Non-Goals

**Goals:**
- One fixed column list, independent of schemas, derived by the same single function.
- A drafting progress bar that reuses the task meter.
- No spurious activity entries on the first scan after the upgrade.

**Non-Goals:**
- Changing how `specsSynced` is computed (change-scanner keeps it; it just stops affecting placement).
- Recording artifact-by-artifact progress in the activity feed (moves between `Backlog`, `Drafts`, `Ready` are still
  recorded; "design written" inside `Drafts` no longer is).
- Rewriting old activity entries or remembered group state keyed by old column names.

## Decisions

**D1 — Stage ids follow the columns.** `Stage` becomes `"backlog" | "drafts" | "unknown" | "ready" | "implementing" |
"done" | "archived"`, one stage per column. `unknown` replaces today's `artifact`/`Unknown` pairing for unreadable
changes; `availableActions` already decides Draft from `artifacts`, so an unreadable change keeps offering Draft and
never Implement or Archive. A `STAGE_COLUMN` map in `types.ts` replaces `IMPLEMENTATION_COLUMNS` as the one list of
lifecycle columns and their order. *Alternative:* keep the old ids and only relabel columns — rejected, it leaves
`synced` and `artifact` meaning nothing and invites the old logic back.

**D2 — Placement.** `deriveStage` keeps its order (archived → all tasks ticked → some tasks ticked → artifacts), drops
the `specsSynced` branch, and replaces the leading-run rule with a count: `done === 0` → `backlog`, `done === total`
→ `ready`, otherwise `drafts`. `StageInput.specsSynced` is removed; the scanner still reports `specsSynced` on the
change. `isComplete(stage)` becomes `stage === "done"`.

**D3 — Columns.** `boardColumns(snapshot)` returns `Backlog, Drafts, [Unknown], Ready, Implementing, Done, Archived`;
the snapshot is only consulted for `Unknown`. `DISPLAY_ORDER`, `displayOrder` and `artifactLabel` are removed from
`columns.ts`: their only use was ordering and naming artifact columns (the detail view has its own `artifactLabel`).

**D4 — Drafting meter.** `Meter` gains a `unit` (`"tasks"` | `"artifacts"`) used for the tooltip and accessible name
(`2 of 4 artifacts written` / `3 of 12 tasks complete`); the visual stays identical. `ChangeCard` shows the artifact
meter when `card.stage === "drafts"` (from `card.artifacts`), else the task meter when `tasks.total > 0`. No new
snapshot field: the counts are already in `artifacts`. *Alternative:* a distinct colour for drafting — rejected; the
column already says which phase it is and the user asked for the same bar.

**D5 — Leading copy.** `STAGE_RANK` in `mergeChanges.ts` becomes `unknown 0, backlog 1, drafts 2, ready 3, implementing 4,
done 5, archived 6`; the existing "more done artifacts" tie-break now does the work that the per-artifact columns used to do.

**D6 — No spurious moves after the upgrade.** When the scanner adopts the cached snapshot at start-up, it re-derives
each cached change's `stage` and `column` with the current `deriveStage` from the fields the cache already holds
(`archived`, `schema`, `artifacts`, `tasks`). The first diff then compares like with like. This lives at the cache read
(`src/server/cache.ts` or where the scanner adopts it), not in `diffSnapshots`, which stays a pure function of two
snapshots. *Alternative:* map old names in the diff (`Proposal`→`Drafts`, `Synced`→`Done`) — rejected, it hardcodes
schema names and never goes away. *Alternative:* drop the cache — rejected, it would make every repository look newly
tracked.

**D7 — Hints, markers, highlighting.** `COLUMN_HINT` gets `Backlog`, `Drafts` and a new `Done` text ("All tasks
complete; ready to archive"); `Synced` entries go from `COLUMN_HINT`, `LIFECYCLE_KIND` and the `hot` check. `Backlog`
and `Drafts` fall through to neutral.

**D8 — Demo.** `sampleData.ts` derives placement through `deriveStage` already; its `FLOW` list and the `synced`
sample flags are updated so every new column has a card (demo-site "Every column is populated").

## Risks / Trade-offs

- [Less history detail: "design written" is no longer a move event] → Accepted; the goal is fewer, human-level
  phases. The Drafts meter shows the current count.
- [A synced-but-unarchived change is indistinguishable from an unsynced one on the board] → Accepted per the request
  (archive does both); `specsSynced` stays in the API for the detail view or a later badge.
- [Stale `minimized` overrides keyed by `Proposal`/`Synced` remain in localStorage] → Harmless; they never match again.

## Migration Plan

Ships as one release; no data migration beyond D6. Rollback is reverting the commit: an older binary re-derives the
old columns on its next scan, and at worst records one round of moves back to the old names.
