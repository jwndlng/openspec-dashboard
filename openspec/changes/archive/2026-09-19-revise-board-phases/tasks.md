## 1. Stage and column derivation

- [x] 1.1 In `src/shared/types.ts`, add `"new"` and `"synced"` to `Stage`, add optional `specsSynced?: boolean` to `ChangeSnapshot` (doc comment: only set for complete, non-archived changes), and add `"Synced"` to `IMPLEMENTATION_COLUMNS` between `Done` and `Archived`
- [x] 1.2 In `src/shared/columns.ts`, add `DISPLAY_ORDER` (`spec-driven`: proposal, design, specs, tasks) and a `displayOrder(schema, artifacts)` helper: listed ids by table position, unlisted ids after them in schema order, unknown schemas untouched
- [x] 1.3 Rewrite the artifact branch of `deriveStage` (it now needs `schema` and optional `specsSynced` in `StageInput`): empty artifacts → `Unknown`; longest leading run of done artifacts in display order → `New` (empty run) or the last artifact's label; keep `Archived` / `Implementing` / `Ready` precedence; split complete into `synced` (`specsSynced === true`) and `done`
- [x] 1.4 Add and export `NEW_COLUMN` and `isComplete(stage)` (`done | synced`)
- [x] 1.5 Update `boardColumns`: start with `New`, use display order per schema, omit each schema's last artifact, keep majority-schema merging and the `Unknown` rule
- [x] 1.6 Update the column derivation table and board-columns tests in `test/parsers.test.ts` for every scenario in the `kanban-board` delta (new, proposal only, specs-before-design, specs written, ready, implementing with open artifact, done, synced, no deltas, empty tasks, unreadable, spec-driven column list, other-schema column list)

## 2. Sync detection

- [x] 2.1 Re-export `parseDeltaSpec`, `extractRequirementsSection` and `normalizeRequirementName` from `src/server/openspecAdapter.ts` via the `@openspec-core/*` alias, and confirm the parser modules do no `import.meta.url` / module-relative file access
- [x] 2.2 Create `src/server/specSync.ts` with a pure `isDeltaSynced(deltaText, mainText | undefined)` implementing the ADDED / MODIFIED / REMOVED / RENAMED rules with whitespace-normalized block comparison, and `changeSpecsSynced(source, changeDir, repoPath)` that finds `specs/*/spec.md`, reads the matching main specs and returns `{ synced, warnings }` (no deltas → synced; read/parse error → not synced plus a warning)
- [x] 2.3 Unit-test `isDeltaSynced`: not applied, applied, modified-with-old-text, whitespace-only differences, removal, rename, missing main spec, empty delta, added requirement later modified in main (still synced)
- [x] 2.4 Add a round-trip test: copy a small change with ADDED and MODIFIED deltas plus a main spec into a temp project, run the project's `openspec archive <name> -y` there, and assert the archived delta is reported synced against the resulting main specs (and not synced against the original ones)
- [x] 2.5 In `src/server/scanner.ts`, evaluate `changeSpecsSynced` only for non-archived changes with all tasks complete, pass the result into `deriveStage`, set `specsSynced` on the snapshot, and append its warnings to the change's warnings
- [x] 2.6 Scanner tests in a temp repo: complete change with unapplied delta → `Done`; after writing the requirement into the main spec → `Synced`; complete change without `specs/` → `Synced`; in-progress change → `specsSynced` omitted; unparseable delta → `Done` with a warning and `ok: true`

## 3. UI

- [x] 3.1 In `src/ui/kanban.tsx`, replace `stage === "done"` checks with `isComplete` (completion badge, "to archive" badge) and highlight the count of both `Done` and `Synced`
- [x] 3.2 Add `title` tooltips to column headers for the lifecycle columns (`New`: nothing written yet; `Done`: complete, specs not synced; `Synced`: specs synced, ready to archive) 
- [x] 3.3 In `src/ui/overviewState.ts`, count `toArchive` with `isComplete`, and update `test/overview.test.ts` with a synced change
- [x] 3.4 Check that existing fixtures-based tests in `test/scanner.test.ts` still assert the right columns under the new semantics and update expectations where the flip applies

## 4. Verification and docs

- [x] 4.1 Run `bun run check`
- [x] 4.2 Run `bun run build` and start `dist/openspec-dashboard --no-open` on a spare port against a temp dashboard home: confirm a complete change reports `specsSynced` (proves the parser works inside the compiled binary)
- [x] 4.3 Run `bun run dev` and verify on the real data: column order `New, Proposal, Design, Specs, Ready, Implementing, Done, Synced, Archived` with no `Tasks` column; this repo's complete-but-unarchived change sits in `Done` or `Synced` as appropriate; Projects overview stage columns match; both themes
- [x] 4.4 Update `README.md`: the lifecycle and what each column means, that `Synced` is derived by comparing delta specs with `openspec/specs/`, and that changes without deltas skip `Done`
