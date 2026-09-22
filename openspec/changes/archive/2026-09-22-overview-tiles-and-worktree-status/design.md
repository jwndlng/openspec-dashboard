## Context

The scanner (`src/server/scanner.ts`) reads, per repository, the current branch and `git worktree list --porcelain`, parsed by `parseWorktrees` into `{ path, branch }[]`. That list includes the main checkout (git lists it first) and silently omits detached worktrees, so the "N worktrees" badge in the repository header is off by one and blind to detached checkouts. The only `git status` it runs is `--porcelain=v1 -z --untracked-files=all -- openspec` in the main checkout, feeding the last-updated rule. Nothing describes the state of the work itself.

Constraints: git is limited to the read-only subcommands in the `dashboard-api` spec (`rev-parse`, `log`, `worktree list`, `status`), always with `GIT_OPTIONAL_LOCKS=0`; no network at runtime; a repository scan has a timeout and must never fail because one piece of information is unavailable; all git access goes through the `RepoSource` seam so tests can substitute it; the UI also runs against an in-memory demo backend (`src/ui/demo/`), so anything the UI shows must exist in the sample data.

A scratch spike against real linked worktrees fixed the facts this design relies on. `git status --porcelain=v2 --branch` prints `# branch.head <name>` or `(detached)`, `# branch.oid <sha>` or `(initial)` for an unborn branch, and — only when an upstream is configured — `# branch.upstream` and `# branch.ab +A -B`; entries start with `1` (changed), `2` (renamed/copied), `u` (unmerged) or `?` (untracked, directories collapsed). `git worktree list --porcelain` adds `detached`, `locked [reason]` and `prunable <reason>` lines; running anything inside a prunable worktree fails because its directory is gone.

## Goals / Non-Goals

**Goals:**
- For every checkout of a tracked repository: is there uncommitted work, is there unpushed work, is it stale.
- Correct worktree counts.
- Visible at a glance on Projects (both layouts) and in the repository header.
- Read-only, bounded, failure-isolated, no new git subcommand.
- A tiles layout that is the same data and the same interactions as the table.

**Non-Goals:**
- Any action on a checkout (commit, push, prune, open a PR, start an agent).
- Remote lookups: whether a PR exists, whether the remote has moved. No `git fetch`.
- File names, diffs or sizes of changes in the snapshot — counts only.
- Stash entries, submodule state, or sparse/partial-clone specifics.
- Per-change attribution of dirty files (the last-updated rule already covers `openspec/`).
- Replacing the table; it stays the default layout.

## Decisions

### D1: One `status --porcelain=v2 --branch` per checkout
Per checkout (main and each non-prunable linked worktree): `git status --porcelain=v2 --branch` with `cwd` set to that checkout. One call yields branch/detached/unborn, upstream, ahead/behind and the entries. A pure `parseStatusV2(text)` in `git.ts` returns `{ head?: string; detached: boolean; unborn: boolean; upstream?: string; ahead?: number; behind?: number; modified: number; untracked: number; conflicts: number }`, where `modified` counts `1`, `2` and `u` entries (staged or not — the distinction does not matter for "is there uncommitted work"), `conflicts` counts `u` entries, and `untracked` counts `?` entries.

Untracked files keep git's default `--untracked-files=normal`: an untracked directory is one entry. Counting every file in it (`all`) can walk a large tree and says nothing more about *whether* work is uncommitted; the UI words it as "untracked items".

*Alternatives considered:* porcelain v1 plus `rev-parse`/`rev-list` for branch and ahead/behind — more calls, and `rev-list` is not an allowed subcommand. Reusing the existing `openspec/`-scoped v1 call for the main checkout — it needs `--untracked-files=all` and a path limit, the opposite trade-off; the two calls stay separate and the last-updated rule is untouched.

### D2: Unpushed work when there is no upstream
A branch that was never pushed has no upstream, so `branch.ab` is absent — yet local-only commits are the most forgettable work there is. For a checkout without an upstream (including detached HEAD), when the repository has at least one remote-tracking ref, the scanner counts commits reachable from `HEAD` but from no remote-tracking ref: `git log --format=%H -n 100 HEAD --not --remotes`, counting lines (100 means "99+"). `log` is already allowed. Whether remote-tracking refs exist is asked once per repository with `git rev-parse --symbolic --remotes` (also allowed); with none, "unpushed" is meaningless and the field is omitted.

The resulting per-checkout `unpushed` is: `ahead` when an upstream exists; the local-only commit count when it does not but remotes exist; omitted otherwise. `upstream` is kept separately so the UI can say *why* ("2 ahead of origin/feat-x" vs "3 commits, never pushed").

Everything is relative to the last fetch — the dashboard never fetches — and tooltips say so.

### D3: Worktree list carries identity and flags; the main checkout is not a worktree
`parseWorktrees` returns one entry per `worktree` record with `path`, `branch?` (absent when detached), `detached`, `locked` (+ reason), `prunable` (+ reason) and `isMain` (the first record, which git guarantees is the main working tree). `RepoSnapshot.worktrees` keeps holding all of them so the main checkout's status has a home, and every count of "worktrees" in the UI and the roll-up uses `!isMain`. Prunable worktrees are reported as stale and are never inspected. A bare main record (no working tree) is flagged and not inspected.

`branchMatch` keeps working: it reads `branch`, which detached entries simply lack.

### D4: Bounded, isolated inspection
`RepoSource` gains `checkoutStatus(path): Promise<CheckoutStatus | undefined>`; `undefined` means unknown. In `scanRepo`, checkouts are inspected with a small concurrency (3) and at most 12 linked worktrees per repository (main checkout always); the rest get `status` omitted and `inspected: false`. Each call uses the existing per-command timeout; a failure or timeout yields unknown for that checkout only. The whole thing sits inside the existing per-repository timeout, and the scanner's failure path retains the previous worktree list and roll-up like it retains changes.

Only paths reported by `git worktree list` for a tracked repository are ever used as `cwd`; none comes from a request or from user input.

### D5: Roll-up on the snapshot, not recomputed everywhere
`RepoSnapshot.workInProgress = { worktrees, uncommitted, unpushed, stale, unknown }`: the number of linked worktrees, and the numbers of checkouts (main included) with `modified + untracked > 0`, with `unpushed > 0`, that are prunable, and that could not be inspected. Computing it once server-side keeps the overview, the header, sorting and the demo data consistent. It is omitted for non-git repositories. No file names, paths of changed files or diffs enter the snapshot.

### D6: Overview indicator, sort and filter
`OverviewRow` gains the roll-up. The indicator text is built by one pure function from the roll-up, listing only non-zero parts — `2 worktrees · 1 uncommitted · 1 unpushed · 1 stale` — and nothing for a clean repository without worktrees; it uses the warning badge when anything is uncommitted, unpushed or stale, and plain subtle text when there are only clean worktrees. New sort key `wip` (checkouts needing attention: uncommitted + unpushed + stale, descending, ties by name) and a URL-persisted toggle `wip=1` that keeps only repositories where that number is non-zero. Both live in `overviewState.ts` next to the existing sort and search and are covered by its tests.

### D7: Tiles are a second renderer over the same rows
`?view=tiles` (omitted for the default `table`). `overview.tsx` keeps one pipeline — rows → filter → sort — and hands the result to either `ProjectsTable` or `ProjectsTiles`. A tile is an `<article>` in a CSS grid (`repeat(auto-fill, minmax(300px, 1fr))`) with the repository name as the real link, the same whole-tile plain-click navigation as a row, and: path hint, scan-failed badge, last updated, a compact stage strip (one segment per board column with its count, zero segments muted), open and to-archive totals, carried shared-config profiles, and one chip per checkout. Sorting in tiles view uses a small select (the table's clickable headers do not exist there); search, the filter and the URL state are shared.

A checkout chip is one shared component used by tiles and by the repository header: `⎇ branch` (or `detached @ sha7`), then text markers `●N` uncommitted, `↑N` unpushed, `↓N` behind, `stale`, `locked`, `?` unknown — each with a `title` spelling it out, none relying on colour alone. The main checkout's chip is labelled as such. Long branch names reuse the existing middle-truncating `BranchBadge`.

### D8: Demo data
`sampleData.ts` gives several sample repositories worktrees covering every state (clean, uncommitted, unpushed with and without upstream, behind, detached, stale, locked, unknown) and the matching roll-ups, generated from one helper so they cannot disagree. The demo data test asserts that every roll-up equals what the roll-up function computes from its worktrees.

## Risks / Trade-offs

- [Scan time grows with the number of worktrees] → One status per checkout, concurrency 3, cap 12, per-command and per-repository timeouts; `normal` untracked mode avoids deep walks. Measured in a task on a repository with many worktrees before merging.
- [`git status` could touch a worktree's index] → `GIT_OPTIONAL_LOCKS=0` is set for every git call; the no-side-effects test is extended to fingerprint each linked worktree's index file and working tree before and after a scan.
- [Ahead/behind is stale without a fetch] → Stated in tooltips and README; fetching would be a network call and a write to `.git`, both against the invariants.
- ["Never pushed" is wrong for a repository whose remote uses non-default refspecs, or for intentionally local branches] → It is labelled as what it is ("N commits not on any remote"), never as an error, and is omitted entirely when there are no remote-tracking refs.
- [A worktree on a network or removed volume makes status hang] → Per-command timeout, result "unknown", scan continues.
- [Counts change between the scan and the moment the user looks] → Same as everything else on the dashboard; "updated … ago" and Refresh apply.
- [Two layouts double the UI surface] → One data pipeline, one chip component, shared URL state; only the container markup and CSS differ. Tests target the shared pure functions.
- [`run-agent-actions-from-ui` also edits `types.ts` and `kanban.tsx`] → All type additions here are optional fields; the header edit replaces one badge. Whichever lands second resolves a small textual merge.

## Migration Plan

Additive and read-only. Snapshots cached by an older version lack the new fields; the UI treats them as absent (no indicator, header falls back to a plain count) until the first scan, seconds after start. Rollback is reverting the commit.

## Open Questions

- Should the combined board get the `wip` filter too (e.g. to show only changes whose matching branch has uncommitted work)? Deferred: it needs a per-change link to a checkout, which this change deliberately does not build.
