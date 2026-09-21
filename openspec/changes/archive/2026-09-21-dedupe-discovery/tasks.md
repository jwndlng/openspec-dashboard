## 1. Canonical paths

- [x] 1.1 Add a test that creates `Foo/` in a temp dir and asserts `realpathSync.native` of `foo/` returns the on-disk casing under Bun (skipped on case-sensitive volumes); if Bun does not normalise case, implement the per-segment `readdir` fallback from design Risks
- [x] 1.2 Add `canonicalPath(p)` to `src/server/paths.ts`: `expandPath` → `realpathSync.native` → strip trailing separator; non-existent paths return the normalised input
- [x] 1.3 Tests for `canonicalPath`: `~` expansion, trailing slash, `.` segments, symlinked directory, case variant (conditional), non-existent path unchanged

## 2. Config: canonical identity, ignorePaths, migration

- [x] 2.1 Add `ignorePaths: string[]` to `Config` in `src/shared/types.ts` and to `defaultConfig()`
- [x] 2.2 In `src/server/config.ts`, make the `absolutePath` zod transform use `canonicalPath`; add `ignorePaths` to `configSchema` as optional-on-input defaulting to `[]`; make `repoId`/`newRepoConfig` hash and store the canonical path
- [x] 2.3 Add `migrateConfig(raw)`: default `ignorePaths`, canonicalise and dedupe `scanRoots`/`ignorePaths` (order kept), canonicalise repo paths, recompute ids, collapse same-id repos (enabled wins, else first; keep that entry's name); return whether anything changed plus a warning line naming merged entries
- [x] 2.4 Call `migrateConfig` in `loadConfig` before validation and save back atomically when it changed something; surface the warning through the existing `warning` return value
- [x] 2.5 Add `validateIgnorePaths` next to `validateScanRoots` (same rule, issue paths prefixed `ignorePaths`)
- [x] 2.6 Tests in `test/config.test.ts`: config without `ignorePaths` loads; legacy duplicate entries (symlink spelling) merge to one enabled "Beta SOC"; a legacy non-canonical path no longer triggers the corrupt-config reset; `PUT`-style validation still rejects a mismatching id and two repos resolving to one directory; relative ignore path rejected

## 3. Discovery: canonical roots, ignore prefixes, remotes

- [x] 3.1 In `src/server/discover.ts`, canonicalise each root before walking and keep reporting errors under the root as the user typed it
- [x] 3.2 Thread canonical `ignorePaths` into `walk`; return early when `dir` equals an ignore path or starts with `ignorePath + sep`
- [x] 3.3 Make `toCandidates` compare canonical paths (known repo paths are canonical after 2.x)
- [x] 3.4 Add `originUrl(cwd)` to `src/server/git.ts` (`git config --get remote.origin.url`) and a pure `normalizeRemote(url)` (scp-style and https forms → `host/org/repo`, strip `.git`, lower-case host)
- [x] 3.5 Add `DiscoveredRepo` (`RepoConfig & { sameRemoteAs?: { name; path; tracked }[] }`) to shared types and change `DiscoverResult.candidates` to it
- [x] 3.6 In `discoverRepos(known, roots, ignorePaths)`, look up remotes for candidates and known repos with bounded concurrency (8), and set `sameRemoteAs` on candidates sharing a remote with any other known repo or candidate; lookup failures mean "no remote"
- [x] 3.7 Tests in `test/discover.test.ts`: overlapping roots return each repo once; symlinked root and (conditional) case-variant root do not duplicate; ignore path skipped; `/w/repos` does not ignore `/w/repos-extra`; ignored root yields no results and no error; tracked repo not offered under a symlinked spelling; `normalizeRemote` table; `sameRemoteAs` for tracked+candidate and candidate+candidate using temp git repos with `git init` + `git remote add`; repo without origin is unflagged

## 4. API

- [x] 4.1 `POST /api/discover`: accept optional `ignorePaths` in the body (validated with `validateIgnorePaths`), falling back to the saved values; pass to `discoverRepos`
- [x] 4.2 Tests in `test/api.test.ts`: `ignorePaths` from the body filters candidates and is not persisted; relative ignore path → 400; `PUT /api/config` stores a trailing-slash root canonically and accepts a body without `ignorePaths`; two roots resolving to one directory produce each candidate once

## 5. Settings UI

- [x] 5.1 Add pure `nameHints(entries)` in `src/shared/nameHints.ts` (group by case-insensitive name; hint = parent path relative to the group's deepest common ancestor) with unit tests, including the `acme` vs `ops/repo-mirror/repos` case and unique names getting no hint
- [x] 5.2 `src/ui/api.ts`: `discover(scanRoots?, ignorePaths?)` sends both in the body
- [x] 5.3 `src/ui/settings.tsx`: "Ignored paths" list with add/remove under Workspace roots, hint text that ignore paths only affect discovery; edits mark the draft dirty and re-run discovery with the draft roots and ignore paths (reuse the sequence guard)
- [x] 5.4 Per-candidate "Ignore" action adding the candidate's path to the draft ignore paths and re-running discovery
- [x] 5.5 Render name hints as a badge in both Tracked and Discovered lists, and the `sameRemoteAs` badge (names in the label, paths in the title) on candidates
- [x] 5.6 `enableCandidate`: strip `sameRemoteAs`, and default the name to `<basename> (<parent dir>)` when the default name is already used in the draft
- [x] 5.7 Confirm no edits were needed in `src/ui/app.tsx`, `src/ui/styles.css` or `scripts/build-ui.ts` (owned by `add-light-theme`)

## 6. Verification

- [x] 6.1 `bun test` and `bunx tsc --noEmit` pass
- [x] 6.2 Rebuild the binary and run it with a scratch `OPENSPEC_DASHBOARD_HOME`: roots `~/Workspace` + `~/workspace/alpha` yield no duplicate candidates; adding `~/Workspace/mirror/repos` to ignore paths removes the three shadow clones; remaining clones show the same-remote badge data in the API response
- [x] 6.3 Copy the real `~/.openspec-dashboard/config.json` into the scratch home and confirm it migrates without a reset and without losing enabled repos or names
- [x] 6.4 Confirm `git status` is unchanged across tracked repos after discovery (remote lookup is read-only)
- [x] 6.5 Update README (ignore paths, canonical paths, same-remote badge)
