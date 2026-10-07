## 1. Home resolution and environment variables

- [x] 1.1 `dashboardHome()` in `src/server/paths.ts`: `SPEC_CONTROL_HOME`, else `OPENSPEC_DASHBOARD_HOME`, else `~/.spec-control`, plus a module-level fallback the migration can set to the old home for one run; add `oldDefaultHome()`/`newDefaultHome()` helpers; `test/paths.test.ts` covers the order, empty values and the fallback
- [x] 1.2 Print the deprecation notice for `OPENSPEC_DASHBOARD_HOME` on start (`src/server/index.ts`) and name `SPEC_CONTROL_HOME` in the environment check's remedy (`src/server/environment.ts`); `test/environment.test.ts` passes with updated expectations
- [x] 1.3 Switch `test/helpers.ts` and every test that sets the home to `SPEC_CONTROL_HOME`; keep one test proving `OPENSPEC_DASHBOARD_HOME` still works; `bun test` passes and no test touches the real `~`

## 2. Home migration

- [x] 2.1 New module `src/server/homeMigration.ts` taking the old and new paths as parameters (never the real `~` in tests): decide whether to migrate (no explicit home, new absent, old present and not a link to new), rename, create the link, and on a failed rename set the old-home fallback and return the reason; unit tests in temp directories cover migrate, nothing to do, both exist, old is a link to new, old is a link elsewhere, and rename refused
- [x] 2.2 Rewrite stored paths: every `sessions/*/meta.json` `worktreePath` and every path in `config.json` under the old home, written atomically through the session store and `saveConfig`; delete `cache/snapshot.json`; tests assert the rewritten records and that files without old paths are byte-for-byte unchanged
- [x] 2.3 Worktree repair: for each `worktrees/<repoId>/<name>/` that is a linked worktree, derive the main checkout from its `.git` file and run `git -C <main checkout> worktree repair <new path>` through the existing git runner (`GIT_OPTIONAL_LOCKS=0`); add `worktree repair` to the allow-listed write commands; a test with a temp repository proves `git worktree list` shows the new path, a user's own linked worktree record is unchanged, and the main checkout's `HEAD`, refs, index and working tree are byte-for-byte unchanged
- [x] 2.4 `migration.json` in the new home records pending steps with their last error; on each start without an explicit home, retry pending steps and drop those that succeed or whose worktree directory is gone; tests cover a repository that is missing on the first run and present on the second
- [x] 2.5 Start-up order in `src/server/index.ts`: `--help`/`--version` return first; resolve the port from `--port` or read-only from the old or new `config.json`; bind with a `503` "starting" handler; migrate; load config, sessions and scanner; `server.reload()` with the real handlers; print the migration outcome once; a test proves a busy port exits without moving anything and `--version` neither moves nor writes
- [x] 2.6 Environment check: the `dashboard-home` check turns `warning` while migration steps are pending, the rename was refused, or both homes exist as real directories, naming what is left and why (`src/server/environment.ts`); `test/environment.test.ts` covers each case and the plain `ok`
- [x] 2.7 Verify end to end with the compiled binary: `bun run build`, then run `dist/spec-control --no-open` with `HOME` pointed at a temp directory holding a synthetic `.openspec-dashboard/` (config, two session records, a session worktree of a temp repository); confirm the moved home, the link, rewritten records and `git worktree list`; record the commands in the PR

## 3. Shared-config markers and depends-on header

- [x] 3.1 `src/server/sharedConfig.ts`: write `spec-control:shared` (begin, end, rule comment, and the managed notice naming `spec-control`); parse both prefixes, a block's begin and end with the same prefix, mismatched prefixes unreadable; reject both strings in a profile context; tests cover former-prefix sections reported `in-sync`, a scan writing nothing, an apply rewriting kept sections to the new prefix with the diff showing it, mixed prefixes unreadable, and all existing round-trip tests still passing
- [x] 3.2 Update the demo's marker writer in `src/ui/demo/demoApi.ts` to the new prefix; `test/demoApi.test.ts` passes
- [x] 3.3 `depends-on.yaml` header names `spec-control` (`src/server/createChange.ts`); the create-change tests assert the new header and existing files are read unchanged

## 4. Browser storage keys

- [x] 4.1 New `src/ui/storage.ts`: the `spec-control.` prefix and the one-time copy from `openspec-dashboard.*` recorded in `spec-control.migrated`, all inside try/catch; tests cover copy, new value wins, no copy after the marker (a removed theme stays removed), former keys kept, and storage that throws
- [x] 4.2 Move the six keys (`theme.ts`, `tourState.ts`, `groupState.ts`, `autoRefresh.ts`, `whatsNewState.ts`, `activityState.ts`) to the new prefix and run the copy before the first read; existing UI state tests pass and `grep -rn "openspec-dashboard\." src/ui` finds only `storage.ts`

## 5. Build and release

- [x] 5.1 `scripts/build.ts` reads `SPEC_CONTROL_VERSION`, else `OPENSPEC_DASHBOARD_VERSION`, else `dev`, and defines `SPEC_CONTROL_BUILD_VERSION`; `src/server/version.ts` reads it; `SPEC_CONTROL_VERSION=v1.2.3 bun run build && ./dist/spec-control --version` prints `v1.2.3`, and `test/version.test.ts` passes
- [x] 5.2 `.github/workflows/release.yml` sets `SPEC_CONTROL_VERSION`; check with `actionlint`

## 6. Text that names the home

- [x] 6.1 UI copy: `~/.spec-control/` in `settings.tsx`, `agentSettings.tsx` (text and console-folder placeholder), `helpContent.tsx`, `pullState.ts`; demo paths in `src/ui/demo/demoSessions.ts`, `demoApi.ts` and `sampleData.ts`; update `test/pullUi.test.ts`, `test/demoSessions.test.ts` and the other UI tests that assert these strings; `grep -rn "openspec-dashboard" src` finds only the former-prefix handling in `paths.ts`, `homeMigration.ts`, `sharedConfig.ts` and `storage.ts`
- [x] 6.2 Comments naming the home (`src/server/sessions/store.ts`, `pull.ts`, `integration.ts`, `src/shared/types.ts`) and `scripts/screenshots.ts`'s temp prefix
- [x] 6.3 What's new entry at the top of `src/ui/changelog.ts`: state moved to `~/.spec-control/` with a link at the old path, `OPENSPEC_DASHBOARD_HOME` deprecated, and sessions ended before the upgrade may resume without their earlier conversation for agents that key history by directory; `test/whatsNew.test.ts` passes

## 7. Docs

- [x] 7.1 `CLAUDE.md`: remove the note that the old name stays on purpose, replace every `~/.openspec-dashboard/` with `~/.spec-control/` and `OPENSPEC_DASHBOARD_*` with `SPEC_CONTROL_*`, and add the home migration's `git worktree repair` to invariant 1's list of writes (seven entries become eight)
- [x] 7.2 README and CONTRIBUTING: home paths, `SPEC_CONTROL_VERSION`, and a short upgrade note about the automatic move and the link; `grep -rn "openspec-dashboard" README.md CONTRIBUTING.md CLAUDE.md` finds only the release-verification note for pre-rename releases and the upgrade note

## 8. Verification

- [x] 8.1 `bun run check` passes; `openspec validate rename-local-identifiers --strict` passes
- [x] 8.2 `test/pull.test.ts` and `test/pullRequestsApi.test.ts` still prove scans leave fixture repositories byte-for-byte unchanged, and a new test proves a start with nothing to migrate runs no `git worktree repair`
- [x] 8.3 Note in the PR that `rename-to-spec-control` must be archived before this change, since this change's `dashboard-api` and `release-publishing` deltas build on its versions of those requirements
