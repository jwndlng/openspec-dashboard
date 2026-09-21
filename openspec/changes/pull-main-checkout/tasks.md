## 1. Default branch in the snapshot

- [x] 1.1 Add optional `defaultBranch?: string` and `onDefaultBranch?: boolean` to `RepoSnapshot` in `src/shared/types.ts` (doc comments: omitted when the default branch cannot be determined, and in snapshots cached by older versions)
- [x] 1.2 In `src/server/git.ts`, add `defaultBranch(cwd)`: `symbolic-ref --quiet --short refs/remotes/origin/HEAD` with the remote prefix removed, else `main` / `master` if that local branch exists (`show-ref --verify --quiet`); read-only, returns undefined on any failure
- [x] 1.3 Add `defaultBranch()` to the `RepoSource` seam and `LocalRepoSource`; in `scanRepo` set both fields (`onDefaultBranch` false when detached, both omitted when unknown) and carry the previous values through the failure path in `scanAll`
- [x] 1.4 Scanner tests in temporary repositories with a local bare remote: on default; on a feature branch; default named `trunk`; no `origin/HEAD` with `master`; detached; neither `main` nor `master`; a failing lookup does not fail the scan

## 2. The pull action (`src/server/pull.ts`)

- [x] 2.1 Types in `src/shared/types.ts`: `PullResult { repoId; fetched: boolean; update: "fast-forwarded" | "up-to-date" | "skipped" | "refused" | "failed"; commits?: number; reason?: string; branch?: string; upstream?: string; defaultBranch?: string; hooksSkipped?: boolean }`
- [x] 2.2 A git runner for this module only: no shell, argument array, server environment plus `GIT_TERMINAL_PROMPT=0`, `GIT_SSH_COMMAND="ssh -o BatchMode=yes"` unless the variable is already set, stdin ignored, stdout/stderr captured, kill after a timeout (60 s for fetch)
- [x] 2.3 `inspect(repoPath)`: current branch (or detached), upstream, remote name and ahead/behind via `for-each-ref --format='%(upstream:short)|%(upstream:remotename)|%(upstream:track)'`, default branch, whether any remote exists — read-only commands only
- [x] 2.4 `pullRepository(repo)`: no remote → `skipped`, no fetch; otherwise `git -c gc.auto=0 -c maintenance.auto=false fetch --no-recurse-submodules --quiet <remote>`; fetch failure → `failed` with the last error line; re-inspect; skip when not on the default branch / detached / no upstream; refuse when diverged; when behind run `git -c core.hooksPath=/dev/null merge --ff-only --quiet <upstream>` and report git's refusal unchanged; count commits from the ahead/behind read before the merge; set `hooksSkipped` when a fast-forward happened and an executable `post-merge` hook exists
- [x] 2.5 `maskCredentials(text)` for anything returned to the browser (`scheme://user:secret@` → `scheme://***@`), and return only the final reason line(s) of git's output
- [x] 2.6 Per-repository in-memory lock (`already pulling`), and `pullAll(repos)` with concurrency 3 and independent results

## 3. Pull tests (`test/pull.test.ts`, temporary repositories with a local bare remote, no network)

- [x] 3.1 Behind and clean → fast-forwarded with the right commit count; up to date; unrelated uncommitted edit survives; overlapping edit → refused, edit, index and HEAD unchanged; diverged → refused, local commit intact
- [x] 3.2 On a feature branch and detached → fetched, `skipped`, remote-tracking ref advanced, working tree, index and branch unchanged; no upstream → fetched from `origin`, `skipped`; no remote → `skipped` and no fetch ran
- [x] 3.3 Unreachable remote → `failed` with a reason and nothing changed; a fetch that hangs (remote helper that sleeps) → killed at a shortened timeout, `failed: timed out`
- [x] 3.4 Hooks: an executable `post-merge` hook that writes a marker file does not run, and the result has `hooksSkipped`; linked worktrees: files, index and branch of two worktrees are byte-identical before and after
- [x] 3.5 `maskCredentials` cases; concurrent second pull is refused while the first runs; `pullAll` with one unreachable remote returns independent results
- [x] 3.6 The negative guarantee: with a remote that records access (a bare repository behind a wrapper script or an access-time check), a full scan, a poll cycle, work-status reads and the page-load API calls leave it untouched

## 4. API

- [x] 4.1 `POST /api/repos/<id>/pull` and `POST /api/pull` in `src/server/api.ts`: eligible = enabled, last scan ok, git repository; path from the config only; `409` while a pull runs; trigger a rescan afterwards; both behind `crossSiteRefusal`
- [x] 4.2 API tests: success; unknown, disabled and non-git ids refused without running git; `409`; pull-all with a failure; foreign origin → `403` and nothing fetched; state reflects the pull after the rescan

## 5. UI

- [ ] 5.1 `src/ui/api.ts`: `pullRepo(id)` and `pullAll()` on the `Api` interface, HTTP implementation and forwarder
- [ ] 5.2 Pure helpers with unit tests: outcome label and tone from a `PullResult` (`up to date`, `+N commits`, `fetched only`, `refused`, `failed`, plus the hooks note), and the notice text from `currentBranch` / `defaultBranch` (including detached)
- [ ] 5.3 Repository board header: Pull button (running state, outcome badge with reason as tooltip) and the not-on-default-branch notice line
- [ ] 5.4 Projects overview: compact Pull button per git row that does not navigate, outcome badge, notice badge in the row, "Pull all" in the toolbar with a result list; reload the state after a pull
- [ ] 5.5 Styles with existing tokens only; both themes; narrow window
- [ ] 5.6 Demo: implement both operations in `src/ui/demo/demoApi.ts` (delay, canned outcomes from the sample: fast-forward on the default branch, fetched-only otherwise, nothing for the repository whose scan failed), set `defaultBranch` / `onDefaultBranch` in `sampleData.ts`, and extend the demo tests (notice visible in the sample, outcomes, no persistence, no network)

## 6. Invariants, docs, verification

- [ ] 6.1 Reword `CLAUDE.md` invariant 1 (third enumerated exception: fetch + fast-forward-only of the main checkout, on explicit request, hooks disabled, `src/server/pull.ts` the only place) and invariant 4 (the UI never reaches other hosts; the server contacts a git remote only through the pull action)
- [ ] 6.2 Update `README.md`: what Pull does and never does, the refusal cases, credentials and hooks, that nothing is fetched unless asked, and what the branch notice means
- [ ] 6.3 `bun run check`, `bun run build`, `bun run build:demo`
- [ ] 6.4 Verify with the compiled binary against a throwaway dashboard home and temporary repositories with a local bare remote, in a browser: fast-forward, fetched-only with the notice, refused with reason, failed, Pull all, state refresh — do not pull any real repository during verification
- [ ] 6.5 Before merging and again before archiving, rebase the `dashboard-api` never-writes delta on main's then-current text (`dedupe-discovery` and `create-change-from-dashboard` modify the same requirement), and implement in the demo any `Api` operation that landed meanwhile
