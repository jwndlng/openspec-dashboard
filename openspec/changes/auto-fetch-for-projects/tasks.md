# Tasks

## 1. Config and types

- [x] 1.1 Add `AUTO_FETCH_MINUTES = [5, 15, 30, 60] as const`, `AutoFetchMinutes` and `RepoConfig.autoFetchMinutes?` to `src/shared/types.ts`, and `RepoSnapshot.hasRemote?`, `lastFetchedAt?` and `autoFetch?: { at, ok, reason? }`; verify with `bun run check` (typecheck)
- [x] 1.2 Accept `autoFetchMinutes` in `repoSchema` (`src/server/config.ts`) as one of those literals only; verify with a config test that `15` round-trips and `1`/`"15"` are rejected by `PUT /api/config`
- [x] 1.3 Make sure saving Settings keeps each repository's `autoFetchMinutes` as last received (as for `prTitleConvention`); verify with the existing "Saving does not undo the overview" style UI test extended to auto fetch

## 2. Fetch-only path in `pull.ts`

- [x] 2.1 Extract the fetch step of `pull()` into a shared helper and add `fetchRepository(repo)` returning `{ ok, at, reason?, moved }` (refs compared with `for-each-ref refs/remotes/` before and after); verify in `test/pull.test.ts` that it moves the upstream ref but leaves branch, `HEAD`, `.git/index` and working tree byte-for-byte unchanged on a behind checkout with uncommitted edits
- [x] 2.2 Replace the `inFlight` set with a per-repository `{ kind, done }` entry: a pull waits for a running automatic fetch, a second pull still gets `PullBusyError`, and an automatic fetch during a pull is skipped without running git; verify with tests for all three cases
- [x] 2.3 Verify `fetchRepository` skips (no git run) a repository without a remote, and that a failing remote returns `ok: false` with a masked reason within the timeout

## 3. Scheduler

- [x] 3.1 Create `src/server/autoFetch.ts` with `AutoFetcher` (injectable fetch, clock and timer functions): `plan()` arms one unref'd timer per eligible repository one interval out, keeps unchanged ones, clears unwanted ones; on fire re-checks eligibility, runs through a bounded queue, records the outcome, re-arms one interval later; verify in `test/autoFetch.test.ts` with fake timers: off by default, three fetches in 46 minutes at 15, interval change re-arms, switching off cancels, disabled/non-git/no-remote/failed-scan repositories are skipped
- [x] 3.2 Call `onMoved(repoId)` only when refs moved, and record a successful pull as an `ok` outcome too; verify with tests that a no-op fetch triggers no rescan and that a pull clears a recorded failure

## 4. Server wiring

- [x] 4.1 Scanner: read `hasRemote` and `lastFetchedAt` (mtime of `git rev-parse --git-path FETCH_HEAD`) read-only, and attach `autoFetch` from a `ScannerOptions` callback; verify with a scanner test on a fixture repo before and after a fetch, and that the existing "No side effects" scan test still passes
- [x] 4.2 Add `SessionManager.forgetWorktreeCache()` and call it, plus `scanner.trigger()`, from `onMoved` and after a manual pull; verify with a test that a squash-merged session branch reads `merged` after one automatic fetch without waiting for the 15 s cache
- [x] 4.3 Create the `AutoFetcher` in `src/server/index.ts`, plan at start, after every config write and from the scanner's `onSnapshots`; never in the demo; verify by running `bun run dev` with one project set to 5 minutes and watching its upstream ref move
- [x] 4.4 Add `POST /api/repos/<id>/auto-fetch` (`{ minutes: 5|15|30|60|null }`, `400` otherwise, `404` unknown, same-origin guard, re-plans, no scan, no fetch); verify with `test/api*.test.ts` cases for set, clear, invalid, unknown and cross-site
- [x] 4.5 Add a test with a recording remote that a scan, discovery and `GET /api/state` with auto fetch on never contact the remote

## 5. UI

- [x] 5.1 Add `tracking.setAutoFetch` (`src/ui/untracked.tsx`) and the client call in `src/ui/api.ts`; verify with a `Tracking` unit test that the busy state and a refused save restore the previous value
- [x] 5.2 Add `AutoFetchPicker` to `src/ui/projectSettings.tsx` (git only, shown with agent sessions off, tooltip per spec) on the overview row and as a labelled line in the tile's Settings panel after Docs auto-merge; verify with overview UI tests for the scenarios in the project-overview delta
- [x] 5.3 Add `fetchNote()` to `src/ui/pullState.ts` (`fetched 4m ago` / `never fetched` / `auto fetch failed`, tooltip with exact time, interval and masked reason; nothing for no remote or no git) and render it beside Pull on row, tile and board header; verify with pure-helper tests and a render test
- [~] 5.4 Support the setting in `src/ui/demo/demoApi.ts` (stores it, reports a plausible `lastFetchedAt`, never fetches); verify by building the demo and switching the drop-down

## 6. Docs and invariants

- [x] 6.1 Update `CLAUDE.md` invariants 1 and 4 for the automatic fetch (fetch only, opt-in per project, on its interval, through `pull.ts`); verify by reading them against the dashboard-api delta
- [x] 6.2 Mention auto fetch in the help page / What's new if those list per-project settings; verify the help test passes
- [~] 6.3 Run `bun run check` and `bun run build`, start `dist/spec-control`, set a project to 5 minutes and confirm a fetch happens and the note updates; verify `openspec validate auto-fetch-for-projects --strict` passes
