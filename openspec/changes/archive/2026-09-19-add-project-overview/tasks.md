## 1. Scanner: last-updated rule

- [x] 1.1 Add optional `lastUpdatedAt?: string` to `RepoSnapshot` in `src/shared/types.ts` with a doc comment describing the rule
- [x] 1.2 In `src/server/git.ts`, add a pure exported `parseStatusPaths(porcelainZ: string): { path: string; deleted: boolean }[]` for `--porcelain=v1 -z` output (skip the old-name field of rename/copy records) and a `statusPaths(cwd, relPath)` helper running `git status --porcelain=v1 -z --untracked-files=all -- <relPath>` that returns `[]` on failure
- [x] 1.3 Add `dirtyFiles(): Promise<{ path: string; mtimeMs: number }[]>` to the `RepoSource` interface and `LocalRepoSource` in `src/server/source.ts`: resolve status paths to absolute paths, `stat` each, and for deleted or missing paths use the nearest existing ancestor directory; return `[]` for non-git repositories
- [x] 1.4 In `src/server/scanner.ts`, call `dirtyFiles()` once per repo in `scanRepo`, carry the result on `RepoContext`, and add a small helper that returns the latest of several instants as an ISO string (compare with `Date.parse`)
- [x] 1.5 In `scanChange`, set `lastActivityAt` to the latest of the commit date (existing call and archived limit unchanged) and the newest dirty-file mtime under the change directory, keeping the `newestMtime` fallback when both are missing
- [x] 1.6 In `scanRepo`, set `lastUpdatedAt` to the latest of `source.lastActivity(<repo>/openspec)` and the newest dirty-file mtime; for non-git repositories use `newestMtime(<repo>/openspec)`
- [x] 1.7 Carry `prev?.lastUpdatedAt` through the failure path in `Scanner.scanAll`

## 2. Scanner tests

- [x] 2.1 Unit-test `parseStatusPaths`: modified, untracked, deleted, renamed (old name skipped), paths with spaces, empty input
- [x] 2.2 In `test/scanner.test.ts`, build a temp git repo with a committed change and assert: clean tree → `lastActivityAt` and `lastUpdatedAt` equal the commit date even after `utimes` bumps a clean file's mtime
- [x] 2.3 Same repo: modify a committed file without committing → `lastActivityAt` and `lastUpdatedAt` equal its mtime; add an untracked change dir with a file newer than the dir → repo `lastUpdatedAt` equals the file's mtime
- [x] 2.4 Assert a modified `openspec/specs/**` file moves `lastUpdatedAt` but no change's `lastActivityAt`; assert the non-git path uses the newest mtime under `openspec/`
- [x] 2.5 Assert a source whose `dirtyFiles()` rejects or returns `[]` still yields `ok: true` with commit-date values, and that a failed scan retains the previous `lastUpdatedAt`

- [x] 2.6 Assert the never-writes guarantee for `git status`: make the index stat-stale (bump a tracked file's mtime), scan, and check `.git/index` is byte-for-byte unchanged

## 3. Routing and navigation

- [x] 3.1 In `src/ui/app.tsx`, replace the `Route` string union with `{ view: "overview" } | { view: "board" } | { view: "repo"; repoId: string } | { view: "settings" }` and update `routeFromPath` (`/`, `/board`, `/repo/<id>`, `/settings`; unknown paths → overview)
- [x] 3.2 Update the top bar nav to **Projects** (`/`, active on overview and repo views), **All changes** (`/board`) and **Settings**, and render the matching view in `<main>`
- [x] 3.3 Move `routeFromPath` to (or export it from) a module importable without the DOM and unit-test it, including trailing slashes, URL-encoded ids and unknown paths

## 4. Overview page

- [x] 4.1 Create overview URL state next to `src/ui/filters.ts`: `parseOverviewState` / `serializeOverviewState` for `sort` (`updated|name|open|archive`), `dir` and `q`, omitting defaults; unit-test round-trips and invalid values
- [x] 4.2 Add a pure `overviewRows(snapshot, columns)` (stage counts per column excluding `Archived`, `open`, `toArchive`, `archived`, `lastUpdatedAt` with the fallback to the newest change `lastActivityAt`, `ok`/`error`) and a pure `sortRows(rows, sort, dir)` (ties by name, missing dates last); unit-test both
- [x] 4.3 Create `src/ui/overview.tsx`: toolbar with search and a `N tracked · M open · K to archive` badge, and a table in an `overflow-x: auto` wrapper with sortable headers (`aria-sort`, click to sort, click again to reverse), `·` for zero counts, a text warning badge for to-archive, the danger badge with error `title` for failing repos, dimmed "no open changes" rows, and `relTime` for last updated with the ISO date as `title`
- [x] 4.4 Make the repository name a real `<a href="/repo/<id>">` using `navigate` on plain left-click, and make the rest of the row navigate on plain left-click when no text is selected
- [x] 4.5 Reuse the existing "No repositories tracked yet" / "Scanning…" empty state on the overview (extract it from `kanban.tsx` into a shared component)
- [x] 4.6 Add table styles to `src/ui/styles.css` using existing tokens only (no colour literals), and check them in both the dark and light themes

## 5. Repository board

- [x] 5.1 Add an optional `repoId` prop to `Kanban`: narrow repos to that id before building cards, pass a single-repo snapshot to `boardColumns`, hide the repo chip group, and ignore the `repos` URL key
- [x] 5.2 Add a `showRepo` flag to `ChangeCard` so the repository name is omitted on a repository board while the copy action stays
- [x] 5.3 Add the repository header: `Projects / <name>` breadcrumb (link to `/`), monospace path with a "Copy cd" button (export `shellQuote` from `format.ts` and add a `cdCommand(path)` helper with a unit test), branch badge, worktree count with branches in `title`, `updated <relTime> ago`, and warnings/error notices
- [x] 5.4 Render a "repository not found" empty state with a link to the overview when `repoId` is not in the snapshot (but keep showing "Scanning…" while the snapshot is still `null`)

## 5a. Enabled-only and duplicate names

- [x] 5a.1 Add a pure `enabledOnly(snapshot, config)` that filters `snapshot.repos` to ids enabled in the config (pass-through when either is `null`), unit-test it, and have `App` pass the filtered snapshot to every view and to the top-bar error badges
- [x] 5a.2 Add `hint` to `OverviewRow`: for rows whose lower-cased name collides, the shortest unique trailing run of parent-directory segments; unit-test two parents, shared last segment, three-way collision and unique names
- [x] 5a.3 Render the hint next to the repository name in the overview (monospace, subtle), make search match it, and verify in the browser with the real duplicate-named repositories

## 6. Verification and docs

- [x] 6.1 Run `bun test` and `bun run typecheck`
- [x] 6.2 Run `bun run dev` and verify in a browser: default order is newest-updated first, each sort header and reverse works and persists across reload, search filters rows, row click and link open the repo board, deep link to `/repo/<id>?stale=14` works, breadcrumb and browser Back return to the overview, `/board` behaves as the old `/` did
- [x] 6.3 Verify the date rule end to end: edit a file under some tracked repo's `openspec/` without committing, click Refresh, and confirm that repo moves to the top of the overview and the card shows a fresh age; revert the edit
- [x] 6.4 Check overview and repository header in both themes and at a narrow window width (table scrolls horizontally, page body does not)
- [x] 6.5 Update `README.md`: describe Projects → repository board → All changes navigation, the last-updated rule, and note that old `/?repos=…` bookmarks move to `/board?repos=…`
