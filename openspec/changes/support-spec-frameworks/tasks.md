# Tasks

## 1. Contract and registry

- [ ] 1.1 Add `FrameworkId` and `FRAMEWORK_INFO` (`openspec` → label `OpenSpec`, changesDir `openspec/changes`) to `src/shared/types.ts`, plus optional `framework` on `RepoSnapshot` and `DiscoveredRepo`; verify `bun run check` typechecks
- [ ] 1.2 Create `src/server/frameworks/framework.ts` with `FrameworkLayout`, `FrameworkProject`, `FrameworkChange` and the abstract `SpecFramework` (design D1), including the default `claims`, `listChanges` (archive date prefix, `CHANGE_NAME` filter and the existing skip warnings, moved from `LocalRepoSource.listChanges`), `missingMessage` and `parseTasks` (delegating to `tasksParser.ts`); verify by typecheck
- [ ] 1.3 Create `src/server/frameworks/registry.ts` with `FRAMEWORKS`, `frameworkById`, `detectFramework`, `claimFramework` and `writablePaths` (allow-list: `openspec`) per design D2/D5; verify with unit tests in the new `test/frameworks.test.ts` for order, first match and an unclaimed folder

## 2. OpenSpec module

- [ ] 2.1 Move `src/server/openspecAdapter.ts` to `src/server/frameworks/openspec/adapter.ts` unchanged except the embedded schema's relative import path; update importers (`test/parsers.test.ts` and server modules); verify `bun test test/parsers.test.ts` passes
- [ ] 2.2 Move `parseMarker` and its regexes from `scanner.ts` to `src/server/frameworks/openspec/marker.ts`, and `src/server/specSync.ts` to `src/server/frameworks/openspec/specSync.ts` (main specs path from the layout); update `test/specSync.test.ts` imports; verify it passes unchanged
- [ ] 2.3 Implement `OpenSpecFramework` in `src/server/frameworks/openspec/index.ts` (design D4): layout, `isProject` (`openspec/config.yaml|yml`), `claims`, `missingMessage` (today's text), `readProject` (schema from `config.yaml`), `readChange` (marker, `readChangeArtifacts`, "could not read artifacts" warning), `artifactOutputs`, `specsSynced`, `scaffold` (`.openspec.yaml` with schema and created); register it; verify `test/frameworks.test.ts` asserts the OpenSpec layout and scaffold text

## 3. Framework-neutral consumers

- [ ] 3.1 Remove layout knowledge from `src/server/source.ts`: drop `exists()`/`listChanges()` path literals in favour of the module (design D3), make `dirtyFiles` take the layout root; verify `bun test test/scanner.test.ts` passes unchanged
- [ ] 3.2 Refactor `src/server/scanner.ts`: resolve the module once per repository with `claimFramework` (unclaimed → `ok: false` with `missingMessage()`), pass it through `RepoContext`, call `readProject`/`readChange`/`parseTasks`/`specsSynced` in `scanChange`, use `layout.changesDir` for the worktree mtime and `layout.root` for `lastUpdatedAt`, set `framework` on success and keep the previous one on failure; verify the scanner, merge, dependency and archive tests pass, with only `framework: "openspec"` added where a whole snapshot is compared
- [ ] 3.3 Refactor `src/server/discover.ts` to walk with `detectFramework` and every module's `layout.skipDirs`, set `framework` on candidates, and keep `isOpenSpecRepo`/`findOpenSpecRepos` only if callers still need them; switch `src/server/integration.ts` confirmation to `detectFramework`; verify `test/discover.test.ts` and `test/integration.test.ts` pass
- [ ] 3.4 Refactor `src/server/artifacts.ts` to list files through the repository's module (`artifactOutputs`) and `listChanges`; verify `test/artifacts.test.ts` and `test/artifactsApi.test.ts` pass unchanged
- [ ] 3.5 Offer shared config only for repositories whose `framework` is `openspec` (`src/server/sharedConfig.ts` / its API route); verify the shared-config tests pass unchanged

## 4. Writers take paths from the layout

- [ ] 4.1 `src/server/createChange.ts`: resolve the module, refuse when `writablePaths` returns none, take `changesDir`/`archiveDir` from it and the marker file from `scaffold()`; same exclusive-create and the same single `git add`; verify `test/createChange.test.ts` and `test/createChangeApi.test.ts` pass unchanged
- [ ] 4.2 `src/server/dismissChange.ts`, `src/server/pull.ts` (`CHANGES_PREFIX`), `src/server/sessions/worktree.ts` (change copy) and `src/server/sessions/workStatus.ts` (docs prefix): replace `openspec/changes`/`openspec/` literals with the values from `writablePaths`; verify dismissal, pull, worktree and auto-merge tests pass unchanged
- [ ] 4.3 Add to `test/frameworks.test.ts` a stub read-only module registered in a test registry: its changes land in the right columns via `deriveStage`, carry no `specsSynced`, and create/dismiss/pull-leftover/worktree copy refuse it through `writablePaths`; verify the test passes
- [ ] 4.4 Add a test that scanning every fixture repository, listing artifacts and reading one artifact file through the modules leaves every fixture byte-for-byte unchanged; verify it passes

## 5. UI, docs and verification

- [ ] 5.1 `src/ui/kanban.tsx`: take the board subtitle's changes directory from `FRAMEWORK_INFO[repo.framework ?? "openspec"]`; set `framework: "openspec"` in `src/ui/demo/sampleData.ts`; verify the demo tests pass and the board still reads `· openspec/changes`
- [ ] 5.2 Update `CLAUDE.md`: Layout gains `src/server/frameworks/`, invariant 3 names `src/server/frameworks/openspec/adapter.ts` and says framework-specific code lives in its module; grep shows no remaining reference to `src/server/openspecAdapter.ts` outside archived changes
- [ ] 5.3 Run `bun run check` and confirm it passes
- [ ] 5.4 Run `bun run build`, start `dist/spec-control` against a config tracking `test/fixtures/demo-ops` with a temporary `SPEC_CONTROL_HOME`, and confirm `/api/state` reports `framework: "openspec"` and artifact statuses with no "could not read artifacts" warning
- [ ] 5.5 No What's new entry: nothing users see changes (the subtitle text is identical); confirm the final diff has no visible UI change before skipping `src/ui/changelog.ts`
