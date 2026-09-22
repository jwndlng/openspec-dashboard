# Tasks

## 1. Types and parsers

- [x] 1.1 Extend `src/shared/types.ts`: `Worktree` gets optional `branch`, plus optional `isMain`, `detached`, `locked`, `prunable`, `inspected`, `unpushed` and `status` (`modified`, `untracked`, `conflicts`, `upstream?`, `ahead?`, `behind?`, or the literal `"unknown"`); `RepoSnapshot` gets optional `workInProgress { worktrees, uncommitted, unpushed, stale, unknown }`. Every addition is optional. Fix the compile errors this causes (`findBranchMatch` in `scanner.ts`, the header tooltip in `kanban.tsx`); verify with `bun run typecheck`
- [x] 1.2 Extend `parseWorktrees` in `src/server/git.ts` to return one entry per `worktree` record — first record `isMain`, `detached`, `locked` and `prunable` lines honoured, bare records flagged — and update `test/parsers.test.ts`: the detached record is now kept, plus cases for locked (with and without reason), prunable and bare; verify with `bun test test/parsers.test.ts`
- [x] 1.3 Add the pure `parseStatusV2(text)` to `src/server/git.ts` (D1) with parser tests for: clean with upstream, modified, staged, renamed (`2` entry), unmerged (`u` entry counted in `modified` and `conflicts`), untracked, no upstream (no `branch.ab`), ahead and behind, detached (`(detached)`), unborn branch (`(initial)`); verify with `bun test test/parsers.test.ts`

## 2. Git access on the `RepoSource` seam

- [x] 2.1 Add to `src/server/git.ts`: `checkoutStatus(path)` running `status --porcelain=v2 --branch` in that path, `hasRemoteRefs(cwd)` via `rev-parse --symbolic --remotes`, and `localOnlyCommits(path)` via `log --format=%H -n 100 HEAD --not --remotes` (returns 0 for an unborn branch). All go through the existing `git()` helper so `GIT_OPTIONAL_LOCKS=0` and the command timeout apply; a failure resolves to `undefined`. Verify by grepping that no git subcommand outside `rev-parse`, `log`, `worktree list`, `status` is introduced
- [x] 2.2 Expose them on `RepoSource` in `src/server/source.ts` (`checkoutStatus(path)`, `hasRemoteRefs()`, `localOnlyCommits(path)`) and implement them in every `RepoSource` implementation, including test doubles in `test/helpers.ts`; verify with `bun run typecheck`

## 3. Scanner

- [x] 3.1 Add a pure `summarizeWorkInProgress(worktrees)` (shared, so the demo data can use it — `src/shared/`) implementing D5, and unit-test the spec scenarios "Mixed states", "Dirty main checkout without worktrees", "One checkout with both" and "Uninspected and unknown checkouts"
- [x] 3.2 In `scanRepo` (`src/server/scanner.ts`): inspect the main checkout and up to 12 non-prunable, non-bare linked worktrees with concurrency 3; mark the rest `inspected: false`; derive `unpushed` per D2 (one `hasRemoteRefs` call per repository); a failed status yields `status: "unknown"`; attach `workInProgress`. Non-git repositories report no checkouts and no summary. `findBranchMatch` skips entries without a branch and the existing `openspec/`-scoped status call stays untouched. Verify with the tests of 3.4
- [x] 3.3 Retain the previous `worktrees` and `workInProgress` in the scanner's failure path next to the retained changes; verify with a scanner test that fails the second scan of a repository and still sees its two worktrees with status
- [x] 3.4 Add scanner tests in temporary git repositories with real linked worktrees (synthetic names only), one per spec scenario: main checkout not counted, clean with upstream, uncommitted (edited + staged + renamed + untracked directory → `modified: 3`, `untracked: 1`), ahead and behind against a local bare "remote", never-pushed branch, repository without remote refs (no `unpushed`), detached with a local commit, unborn branch, removed directory → prunable and not inspected, locked, 15 worktrees → 12 inspected, status failure for one worktree via a `RepoSource` double, non-git repository; verify with `bun test test/scanner.test.ts`
- [x] 3.5 Extend the no-side-effects test in `test/activity.test.ts` to a repository with a dirty linked worktree: fingerprint `.git/index`, each worktree's index file under `.git/worktrees/<name>/index` and the working-tree files before and after a scan and assert they are byte-identical; add an assertion that a modified file's name appears nowhere in the serialised snapshot
- [x] 3.6 Add a test that a cached `snapshot.json` without the new fields is served on startup without error (spec scenario "Snapshot from an older version")

## 4. Overview state

- [x] 4.1 In `src/ui/overviewState.ts`: `OverviewRow` carries `workInProgress` and the repository's `worktrees`; add `attentionCount(row)` (uncommitted + unpushed + stale, 0 without a summary) and the pure `wipIndicator(summary)` returning the text parts and whether it is a warning (D6, including singular `1 worktree` and "nothing for a clean repository")
- [x] 4.2 Add sort key `wip` (descending by default, ties by name), the `wip=1` filter combined with search in `filterRows`, and `view=tiles` to parse/serialise with defaults omitted and unknown values falling back to the table
- [x] 4.3 Cover 4.1–4.2 in `test/overview.test.ts`: every scenario of "Overview shows work in progress per repository", the `wip` sort order, the filter (including clean worktrees not matching), `/?wip=1&q=alpha` round trip, `view=tiles` round trip, `view=galaxy` → table; verify with `bun test test/overview.test.ts`

## 5. UI

- [x] 5.1 Add a shared `CheckoutChip` component (D7): branch through the existing middle-truncating `BranchBadge` or `detached`, main-checkout label, text markers `●N` / `↑N` / `↓N` / `stale` / `locked` / `?`, each with a `title`; unpushed and behind titles mention the last fetch, and the unpushed title distinguishes "ahead of `<upstream>`" from "not on any remote". No marker relies on colour alone, and the chip offers no action
- [x] 5.2 `src/ui/kanban.tsx`: replace the "N worktrees" badge in the repository header with one chip per checkout; fall back to the current branch when the snapshot has no checkout information; verify in `bun run dev` against a repository with a dirty worktree
- [x] 5.3 `src/ui/overview.tsx`: add the work-in-progress indicator to the table rows with a sortable "Work in progress" header, and the filter toggle next to the search field; verify that sort and filter update the URL and survive a reload
- [x] 5.4 `src/ui/overview.tsx`: add the `Table` / `Tiles` toggle and `ProjectsTiles` over the same filtered and sorted rows — `<article>` tiles with the name as a real link, whole-tile plain-click navigation like a row, path hint and full-path tooltip, scan-failed badge, last updated, stage strip with muted zero segments, open and to-archive totals, shared-config profiles, indicator, checkout chips — plus the sort control (key and direction) shown in the tiles layout; the empty and "no repository matches" states are shared
- [x] 5.5 `src/ui/styles.css`: tile grid (`repeat(auto-fill, minmax(300px, 1fr))`), stage strip, chips, toggle and indicator styles using existing theme tokens in both themes; verify there is no horizontal scrolling at a narrow window width and that `test/theme.test.ts` and `test/repoContrast.test.ts` still pass

## 6. Demo data

- [x] 6.1 `src/ui/demo/sampleData.ts`: generate checkouts from one helper — main checkout plus linked worktrees covering clean, uncommitted, unpushed with and without upstream, behind, detached, stale, locked and unknown — and compute each roll-up with `summarizeWorkInProgress`; made-up names and paths only
- [x] 6.2 Extend `test/demoData.test.ts`: every sample repository's `workInProgress` equals the roll-up computed from its worktrees, every state above occurs at least once, and the existing path check still covers the worktree paths; verify with `bun test test/demoData.test.ts test/demoApi.test.ts test/demoBundle.test.ts`

## 7. Documentation and verification

- [x] 7.1 `README.md`: document the work-in-progress indicator and chip markers, that ahead/behind and unpushed reflect the last fetch because the dashboard never fetches, that only counts are recorded, and the tiles layout
- [x] 7.2 Measure a scan of a synthetic repository with 12+ linked worktrees before and after the change and record the numbers in the pull request description; confirm the per-repository timeout is not approached
- [x] 7.3 Run `bun run check` (lint, typecheck, tests) and fix everything it reports
- [x] 7.4 Run `bun run build` and start `dist/openspec-dashboard` against a temporary repository with a dirty and a stale worktree: confirm the indicator, both layouts, the filter and the header chips work in the compiled binary, and that `git status` in that repository is unchanged afterwards
- [x] 7.5 Run `openspec validate overview-tiles-and-worktree-status --strict` and confirm the change is valid
