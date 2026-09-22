## Why

The dashboard shows where every change stands, but not where the *work* stands. With agents and people working in parallel, a repository routinely has several git worktrees, each possibly holding uncommitted or unpushed work — and none of that is visible: the snapshot knows a worktree only as a path and a branch, the only `git status` the scanner runs is limited to `openspec/` in the main checkout, and the "N worktrees" badge counts the main checkout as a worktree and silently drops detached ones. Forgotten work in a worktree is exactly the kind of thing a cross-repository overview should surface. The Projects table is also at its limit: there is no room left in a row to show it, which is what a tiles layout is for.

This change is observability only. It adds no actions: nothing is committed, pushed or cleaned up from the dashboard.

## What Changes

- **Working-tree status for every checkout of a tracked repository** — the main checkout and each linked worktree. Per checkout the scanner reports: the branch (or that HEAD is detached), how many files are uncommitted split into *modified* (tracked files that differ from `HEAD`, staged or not) and *untracked*, the upstream branch if any with how many commits the checkout is *ahead* and *behind*, and whether the worktree is *locked* or *prunable* (its directory is gone). It comes from one `git status --porcelain=v2 --branch` per checkout — `status` is already an allowed read-only subcommand and runs with optional locks disabled, so no index is refreshed — plus the `locked` / `prunable` lines of the `git worktree list --porcelain` call the scanner already makes. For a branch that was never pushed (no upstream, so git reports no ahead count) the scanner counts the commits that are on no remote-tracking ref with `git log … --not --remotes`, so local-only work is not invisible. No new git subcommand (`status`, `log` and `rev-parse` are all already allowed), no network, no fetch: everything is relative to the last fetch and is labelled as such.
- **Worktrees are counted correctly.** The main checkout is no longer counted as a worktree, detached worktrees are no longer dropped, and prunable ones are shown as stale instead of being treated as dirty or as an error.
- **Bounded cost.** Checkouts are inspected with limited concurrency under the existing per-repository timeout; above a cap of worktrees per repository the rest are listed without status and marked as not inspected. A status that fails or times out yields "unknown" for that checkout and never fails the repository's scan. Untracked files are counted with directories collapsed (git's default), so a checkout with a large untracked tree stays cheap.
- **Repository roll-up.** Each repository gets a summary: number of linked worktrees, number of checkouts with uncommitted changes, number with unpushed commits, number stale. Filenames are never part of the snapshot — only counts.
- **Projects overview shows it.** Each repository shows a compact "work in progress" indicator — e.g. `2 worktrees · 1 uncommitted · 1 unpushed` — with text, not colour alone, and nothing at all for a clean repository without worktrees. The overview can be sorted by it and filtered to "has uncommitted or unpushed work".
- **Tiles view for the Projects overview**, next to the existing table: a toggle (`Table` / `Tiles`) persisted in the URL like sort and search. A tile shows what a row shows — name (with the path hint for same-named repositories), stage counts, open and to-archive totals, last updated, scan failure, carried shared-config profiles — plus the room the table lacks: one chip per checkout with its branch and its uncommitted / ahead / behind / stale state. Sorting, search, the new filter and drill-down work identically in both layouts; the table stays the default.
- **Repository board header** replaces the bare "N worktrees" badge with the same per-checkout chips, including the main checkout's own state.
- **Demo build**: the in-memory sample data gains worktrees with a mix of clean, uncommitted, unpushed and stale states so the demo site shows the feature.
- Explicitly **not** in this change: any action on a worktree (filing a pull request, committing, pruning), GitHub/remote lookups such as "does a PR exist", and running `git fetch`. Starting an agent to file a PR belongs with the in-flight `run-agent-actions-from-ui` change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `change-scanner`: "Branch and worktree matching" is extended — worktrees are reported including detached, locked and prunable ones and excluding the main checkout from the count — and a new requirement adds the per-checkout working-tree status, its bounds and failure isolation, and the repository roll-up.
- `project-overview`: adds the tiles layout and its URL-persisted toggle, the work-in-progress indicator, its sort key and filter; "Repository board header" changes from a worktree count to per-checkout status chips.

## Impact

- `src/shared/types.ts`: `Worktree` gains `detached`, `locked`, `prunable`, `isMain` and an optional `status` (`modified`, `untracked`, `upstream`, `ahead`, `behind`, or `unknown`); `RepoSnapshot` gains a `workInProgress` roll-up. All additions are optional so snapshots cached by older versions still load.
- `src/server/git.ts` (pure parser for `status --porcelain=v2 --branch`; `parseWorktrees` extended), `src/server/source.ts` (`checkoutStatus(path)` on the `RepoSource` seam), `src/server/scanner.ts` (bounded per-checkout inspection, roll-up, previous values retained when a scan fails). The existing `openspec/`-scoped status call for the last-updated rule is unchanged.
- `dashboard-api` spec: **no change** — `status` and `worktree list` are already the allowed read-only subcommands, optional locks stay disabled, and nothing is written anywhere.
- `src/ui/overview.tsx` (layout toggle, tiles, indicator, filter), `src/ui/overviewState.ts` (URL state, sort key, filter, roll-up helpers), `src/ui/kanban.tsx` (header chips), `src/ui/styles.css`, `src/ui/demo/sampleData.ts`.
- `test/`: parser tests (clean, modified, staged, untracked, renamed, no upstream, ahead/behind, detached, unborn branch), scanner tests in temporary git repositories with real linked worktrees (dirty, ahead, detached, removed directory → prunable, cap exceeded, status failure), the no-side-effects test extended to worktrees (`.git/index` and each worktree's index byte-identical after a scan), overview state tests, demo data test.
- `README.md`: what the indicators mean, and that ahead/behind reflects the last fetch.
- Scan cost grows by one `git status` per checkout. Branch-to-change matching (`branchMatch`) is unaffected.
- In-flight changes: `run-agent-actions-from-ui` creates a worktree per agent session — those worktrees will show up here automatically, which is the intended interplay; it also edits `src/ui/kanban.tsx` and `src/shared/types.ts`, so expect textual merges. `add-change-detail-view` and `dedupe-discovery` touch other parts of the UI and scanner.
