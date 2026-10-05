# Tasks

## 1. Report required artifacts

- [x] 1.1 Add an optional `required?: boolean` to `ArtifactStatus` in `src/shared/types.ts`, documented as "named by the schema's `apply.requires`; absent in snapshots recorded before it was reported"; verify `bun run check` typechecks
- [x] 1.2 In `readChangeArtifacts` (`src/server/openspecAdapter.ts`) set `required` on every artifact from `schema.apply?.requires`, every artifact `true` when the schema declares none; verify with a test in `test/artifacts.test.ts` that a `spec-driven` change reports only `tasks` as required and a schema without `apply.requires` reports all as required

## 2. Derive Ready from required artifacts

- [x] 2.1 Change `deriveStage` (`src/shared/columns.ts`) so `Ready` needs every required artifact done, falling back to every artifact when no artifact carries the flag or none is required (design D2); update its doc comment; verify with new cases in `test/parsers.test.ts`: no design → `Ready`, only tasks → `Ready`, design but no tasks → `Drafts`, unflagged artifacts keep today's columns, a schema with all artifacts required behaves as before
- [x] 2.2 Raise the "tasks file has no tasks" warning in `src/server/scanner.ts` when every required artifact (same rule as 2.1, shared helper exported from `columns.ts`) is done; verify with a scanner test that a change without `design.md` and an empty `tasks.md` carries the warning
- [x] 2.3 Confirm `src/server/cache.ts` re-derivation keeps the flag from cached artifacts and that an old cached snapshot without it keeps its column; verify with a cache test (or extend an existing one)

## 3. Fixtures and scanner coverage

- [x] 3.1 Add a synthetic change without `design.md` (proposal, specs, tasks with open boxes) to a fixture repository under `test/fixtures/`, and mention it in `test/fixtures/README.md`; verify a scanner test places it in `Ready` and that existing fixture assertions (column counts, overview totals) are updated where they now differ

## 4. Help and demo

- [x] 4.1 Reword `ready` in `src/ui/helpContent.tsx` to say the artifacts needed to implement are written (for spec-driven: tasks; a design is optional) and no task is ticked yet; verify the help-page column test still passes
- [x] 4.2 Add a `Ready` change without a design to `src/ui/demo/sampleData.ts` (setting `required` on its artifacts), and verify the demo board shows it in `Ready` with **Implement** offered

## 5. Verify

- [x] 5.1 Run `bun run check` and verify lint, typecheck and tests pass
- [x] 5.2 Run `bun run dev` against a scratch repository with a change that has proposal, specs and tasks but no design, and verify its card sits in `Ready` and offers **Implement** (and **Draft artifacts**)
- [x] 5.3 Run `openspec validate redefine-implement-state --strict` and verify it passes
