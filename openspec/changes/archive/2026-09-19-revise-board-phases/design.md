## Context

`deriveStage` in `src/shared/columns.ts` (shared by server and UI) maps a change to a `stage` and a display `column`: `Archived` → `Done` (all tasks ticked) → `Implementing` (≥1 ticked) → `Ready` (all artifacts done) → otherwise the label of the *first artifact that is not done*, in schema order. `boardColumns` builds the column list from the artifact labels of the most common schema (then other schemas'), plus `Ready`, `Implementing`, `Done`, `Archived`. The scanner calls `deriveStage` and stores the result on each `ChangeSnapshot`; the UI groups cards by `column`, and the Projects overview counts by `column` too.

The bundled `spec-driven` schema orders artifacts `proposal, specs, design, tasks`; `specs` and `design` both depend only on `proposal`, `tasks` on both.

Syncing (merging a change's delta specs into `openspec/specs/`) can happen on its own (`/opsx:sync`) or as part of `openspec archive`. Nothing on disk records that a sync happened. CLAUDE.md invariants that matter here: the dashboard stores no facts that are not derivable from the repositories, library internals are reached only through `src/server/openspecAdapter.ts`, and anything relying on module-relative file lookup breaks in the compiled binary.

## Goals / Non-Goals

**Goals:**
- Columns read as "this step is complete": `New → Proposal → Design → Specs → Ready → Implementing → Done → Synced → Archived`.
- Distinguish "complete, needs sync" from "synced, needs archive", derived purely from repository content.
- Stay schema-driven: no fixed column list, other schemas still work.

**Non-Goals:**
- Performing a sync or archive from the dashboard (it stays read-only).
- A marker file or any dashboard-side memory of sync state.
- Detecting *partial* sync per capability in the UI (the state is a single boolean per change).
- Renaming artifact labels (`Specs` stays the label derived from the artifact id; no hardcoded "Specification").
- Changing `Ready` / `Implementing` / `Done` task rules.

## Decisions

### D1: A column names the last completed step
For a non-archived change whose tasks do not yet place it in `Implementing` or later: take the schema's artifacts in display order (D2) and find the longest prefix in which every artifact is `done`. Empty prefix → `New`. Full list → `Ready` (unchanged rule: all artifacts done). Otherwise → the label of the last artifact in the prefix.

*Why a contiguous prefix rather than "the furthest artifact that is done":* `specs` and `design` can be written in either order. With "furthest", a change with proposal + specs but no design would sit under `Specs`, claiming a step the flow has not reached. The prefix rule is conservative and deterministic: a change is at step N only when steps 1…N are all complete. The cost — specs written early are not visible as progress until design exists — is acceptable, and the card is still correct about what is finished.

The precedence above the artifact logic is unchanged: `Archived`, then `Synced`/`Done` (all tasks ticked), then `Implementing` (≥1 ticked, even if an artifact is still open).

### D2: Display order is the schema order, with one override for `spec-driven`
A small table in `columns.ts`, `DISPLAY_ORDER = { "spec-driven": ["proposal", "design", "specs", "tasks"] }`. For a schema in the table, artifacts are sorted by their position there; ids not listed keep their schema-relative order after the listed ones (so a project-local variant of `spec-driven` with an extra artifact still works). Schemas not in the table use schema order untouched. `ChangeSnapshot.artifacts` stays in schema order (the scanner requirement says so); only column derivation reorders.

*Alternatives considered:* (a) derive the order topologically from the dependency graph — `specs` and `design` are at the same depth, so it cannot produce design-first without a tie-break that is just a hardcode in disguise. (b) A user setting — over-engineered for one schema and one preference. The override is explicit, tiny, and leaves the "not hardcoded to `spec-driven`" guarantee intact because unknown schemas are untouched.

### D3: The last artifact in display order has no column
Under D1 a change can only be "at" the last artifact when all artifacts are done, which is `Ready`. So `boardColumns` emits `New`, then each schema's artifact labels *except its last in display order*, then `Ready, Implementing, Done, Synced, Archived`. For `spec-driven`: `New, Proposal, Design, Specs, Ready, …` — exactly the requested lifecycle, with no `Tasks` column. Multi-schema merging (majority schema first, then new labels from other schemas) is unchanged.

A change whose artifacts could not be read (`artifacts: []`) keeps today's `Unknown` column rather than `New`, so a broken change is not mistaken for a fresh one.

### D4: Sync state is detected by checking the delta against the main specs
New `src/server/specSync.ts`, pure over strings plus a thin file-reading wrapper. For every `specs/<capability>/spec.md` in the change directory, parse it with the library's `parseDeltaSpec` and the main spec `openspec/specs/<capability>/spec.md` with `extractRequirementsSection` (both exposed through `openspecAdapter.ts`). The delta is synced when all of:

| Delta section | Condition on the main spec |
|---|---|
| ADDED | a requirement with the same normalized name exists |
| MODIFIED | the requirement exists and its block equals the delta block after whitespace normalization (trim, strip trailing spaces, collapse blank-line runs) |
| REMOVED | no requirement with that name |
| RENAMED | `to` exists and `from` does not |

The change is `specsSynced` when every delta file is synced. A missing main spec fails any ADDED/MODIFIED condition. A change with no delta files, or only empty deltas, is synced (nothing to do). ADDED is matched by name only: after a sync, later changes may legitimately modify that requirement, and that must not flip an old change back.

The scanner evaluates this only for non-archived changes whose tasks are all complete — the only place the answer changes the column — so ordinary scans pay nothing. It is a handful of small file reads; no git, no writes. Any error while reading or parsing yields `specsSynced: false` plus a change warning, which keeps the change in `Done` (the safe side: "check this before archiving").

*Alternatives considered:* (a) a marker written by the sync step — violates "the repository is the source of truth" unless OpenSpec itself wrote it, which it does not. (b) Comparing mtimes or commits of `openspec/specs/` against the change — says something changed, not that *this* delta was applied. (c) Re-running the library's apply logic and diffing the result — it lives in the CLI's archive command, not in a pure exported function, and would couple the dashboard to write-path internals.

*Fidelity check:* the comparison must agree with what the real tool produces. A test copies a fixture change into a temp project, runs the project's own `openspec archive` there, and asserts that the archived delta is reported as synced against the resulting main specs. If the CLI ever normalizes blocks differently, that test fails rather than the board silently never reaching `Synced`.

### D5: `Synced` counts as complete everywhere `Done` does
`Stage` gains `"new"` and `"synced"`. A helper `isComplete(stage)` (`done | synced`) in `columns.ts` replaces the scattered `stage === "done"` checks: the card's "✓ complete · Nd" badge, the board's "N to archive" badge, the overview's `toArchive`, and the highlighted (`hot`) column count, which now applies to both `Done` and `Synced`. The `project-overview` spec already says "complete but not archived", so its text needs no change.

`deriveStage` takes a new optional input `specsSynced`; `done` vs `synced` is decided there so server and UI keep one source of truth.

## Risks / Trade-offs

- [MODIFIED comparison is too strict, e.g. someone reformats the main spec by hand] → The change shows `Done` instead of `Synced`: a false "needs sync", never a false "safe to archive". Whitespace normalization absorbs the common cases; the round-trip test pins the tool's own output.
- [`openspec archive` syncs and archives in one step, so `Synced` is often skipped] → Expected. `Synced` is for the separate-sync workflow and for changes without deltas; it costs nothing when unused.
- [A complete change with no delta specs lands in `Synced`, which may read oddly] → It is accurate for what the column means operationally ("only archiving left"); documented in the README and the column tooltip.
- [Parser API is a library internal and may move] → It is imported only in `openspecAdapter.ts` via the existing `@openspec-core/*` alias, covered by tests, and the dependency is version-pinned by the lockfile.
- [Cached snapshots carry old column names after upgrade] → Columns the new list does not know would hide those cards until the first scan; the scan starts at launch and takes seconds. Not worth a cache version bump.
- [Semantics flip surprises the user of existing bookmarks/muscle memory] → Called out as breaking in the proposal and README; there is no persisted state keyed by column name.

## Migration Plan

Ship as one change; no data migration. Rollback is reverting the commit (the optional `specsSynced` field is ignored by older code).

## Open Questions

None blocking.
