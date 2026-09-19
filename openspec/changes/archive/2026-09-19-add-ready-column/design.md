## Context

`deriveStage()` in `src/shared/columns.ts` is the single place that maps a change to a stage/column; server and UI share it. Today its rule order is: archived → Done (all tasks ticked) → Implementing (`tasks.done > 0`) → Implementing (all artifacts done) → first open artifact column. The fourth rule is what puts `0/N` changes into `Implementing`.

## Goals / Non-Goals

**Goals:**
- Separate "ready to apply" from "being applied" using data the scanner already has.

**Non-Goals:**
- Using `branchMatch`, worktrees or git activity as an "in progress" signal. Branches are often created at proposal time, so this would produce false positives; task ticks are the only unambiguous signal. Can be revisited.
- Per-column styling or WIP limits.

## Decisions

### D1: Only the fourth rule changes
Rule order stays; "all artifacts done" now yields `{ stage: "ready", column: "Ready" }`. The `tasks.done > 0 → Implementing` rule keeps precedence, so a change where someone ticked tasks while an artifact is still open stays in `Implementing` as today. *Alternative:* require all artifacts done for `Implementing` too — rejected, it would push actively worked changes back into an artifact column.

### D2: `Ready` is an implementation column, not an artifact column
`IMPLEMENTATION_COLUMNS` becomes `["Ready", "Implementing", "Done", "Archived"]`, so the column always exists and is schema-independent, exactly like the other three. *Alternative:* render it only when non-empty — rejected; a stable board layout is more useful and an empty `Ready` column is itself information.

### D3: Empty or missing tasks file counts as Ready
All artifacts done with `tasks.total == 0` (or `tasks: null`) goes to `Ready` with the existing "no tasks" warning badge: nothing has been started, and the badge already explains why there is no progress bar.

## Risks / Trade-offs

- [A schema artifact literally named `ready` would collide with the column label] → Same pre-existing risk as `done`/`implementing`; not handled.
- [Persisted snapshot cache contains old stages] → Overwritten by the first scan after start; the UI only trusts `column`, which is recomputed.
