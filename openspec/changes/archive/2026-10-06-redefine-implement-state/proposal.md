# Proposal

## Why

A change only reaches `Ready` today once *every* artifact of its schema is written. For `spec-driven` that includes
`design.md`, which OpenSpec itself treats as optional: its schema's `apply.requires` names only `tasks`, and
`openspec apply` starts on a change without a design. So a small change with a proposal, specs and tasks — but,
sensibly, no design — sits in `Drafts` forever, its card offers **Draft artifacts** instead of **Implement**, and the
only way to move it is to write a design nobody needs. Tasks, on the other hand, are the one thing implementation
cannot do without.

## What Changes

- **`Ready` follows the schema's `apply.requires`.** A change is in `Ready` once every artifact its schema's
  `apply.requires` names is done (for `spec-driven`: `tasks`) and no task is settled yet. Artifacts the schema does
  not require for applying — `design`, and for `spec-driven` technically also `proposal` and `specs` — no longer hold
  a change back. A schema without `apply.requires` keeps today's rule: every artifact is required.
- **`Backlog` and `Drafts` are unchanged in meaning.** `Backlog` while no artifact is done, `Drafts` while some are
  done but a required one is not. `Implementing`, `Done`, `Archived` and `Unknown` are untouched, as are the column
  list and its order.
- **The scanner reports which artifacts are required.** Each artifact status carries whether the schema's
  `apply.requires` names it, so the shared column derivation — and the server's re-derivation of cached snapshots —
  decide `Ready` the same way. A cached snapshot written before this change carries no such flag and is read as
  "every artifact required", i.e. exactly as before, until the next scan.
- **The "no tasks" warning follows suit.** It is raised when every *required* artifact is done and the tasks file has
  no task, not only when every artifact is.
- **Help and the demo say so.** Help's `Ready` explanation names the required artifacts instead of "every planning
  artifact"; the demo board gains a `Ready` change without a design.

**Draft artifacts** stays offered while any artifact is not done, so a change in `Ready` without a design can still
have one drafted; **Implement** is offered beside it as for any `Ready` change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: "Board columns follow the lifecycle phases" — `Ready` requires the schema's apply-required artifacts,
  not every artifact; the "no tasks" scenario follows.
- `change-scanner`: "Artifact status is computed with the OpenSpec library" — each artifact status reports whether the
  schema's `apply.requires` names it.

## Impact

- `src/shared/types.ts` (`ArtifactStatus` gains an optional `required` flag), `src/shared/columns.ts`
  (`deriveStage`), `src/server/openspecAdapter.ts` (`readChangeArtifacts` sets the flag from `apply.requires`),
  `src/server/scanner.ts` ("no tasks" warning), `src/server/cache.ts` (re-derivation keeps working with and without
  the flag).
- `src/ui/helpContent.tsx` (`Ready` and `Drafts` wording), `src/ui/demo/sampleData.ts` (a `Ready` change without a
  design), `src/ui/changelog.ts` (a What's new entry).
- Tests: `test/parsers.test.ts` (column derivation), scanner/adapter tests and a fixture change without `design.md`
  under `test/fixtures/` (with `test/fixtures/README.md`).
- No API shape change beyond the optional flag; no new write, git command or network access.
