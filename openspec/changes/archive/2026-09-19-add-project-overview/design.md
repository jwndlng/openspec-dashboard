## Context

The UI is a Preact SPA with a hand-rolled router in `src/ui/app.tsx` (`routeFromPath` knows `board` and `settings`). `App` fetches the full `Snapshot` from `GET /api/state` and passes it to `Kanban`, which flattens every repo's changes into cards, filters them client-side (filters live in the URL query string, including `?repos=<id>,…`) and lays them out in columns from `boardColumns(snapshot)`. The server returns the SPA HTML for every non-`/api/` path, so new client routes need no server work.

The scanner sets each change's `lastActivityAt` to the committer date of the last commit touching the change directory, falling back to the newest file mtime only when git returns nothing. There is no repository-level date. Tests exercise the scanner through `scanRepo(repo, source)` with `LocalRepoSource` (subclassable) against fixtures and temp directories.

Several other changes are in flight in this repository (`add-ready-column` modifies the column-derivation requirement and `src/shared/columns.ts`; `dedupe-discovery` touches settings and discovery). This design stays out of their way.

## Goals / Non-Goals

**Goals:**
- Repository-first navigation: overview → repository board, with the combined board still one click away.
- "Last updated" that means *any file under `openspec/` changed*, including uncommitted work, without being fooled by checkouts or clones.
- Cards and overview rows agree on recency.
- Reuse the existing Kanban for the drill-down rather than forking it.

**Non-Goals:**
- A change detail page (drilling down below the card level).
- Repo-level metrics beyond counts and dates (velocity, charts, history).
- New API endpoints, server-side sorting/filtering, or config changes.
- Human-readable repo slugs in URLs (ids stay the existing path hashes).
- Changing how columns/stages are derived.

## Decisions

### D1: Routes — overview at `/`, combined board at `/board`, drill-down at `/repo/<id>`
`Route` becomes a small union: `{ view: "overview" } | { view: "board" } | { view: "repo"; repoId } | { view: "settings" }`, parsed by `routeFromPath`. Nav tabs: **Projects**, **All changes**, **Settings**; **Projects** stays highlighted on `/repo/<id>`. Unknown paths and unknown repo ids fall back gracefully (unknown path → overview; unknown id → a "repository not found" empty state with a link back), because a repo can be disabled while its URL is still open.

*Alternatives considered:* (a) keep `/` as the combined board and put the overview at `/projects` — rejected, the point of the change is that the overview is where you start. (b) Drill down via the existing `/board?repos=<id>` filter — least code, but it is a filter state, not a place: no room for a repo header, the repo chips stay visible, and Back/breadcrumb semantics are muddy. (c) Drop the combined board — rejected for now; its cross-repo `Done` column is still the quickest "what should I archive" list. It can be removed later if unused.

Old bookmarks of `/?repos=…` land on the overview, which ignores unknown query keys. Accepted as a one-time break for a single-user local tool; noted in the README.

### D2: `Kanban` gains an optional fixed repository instead of a second board component
`Kanban` takes an optional `repoId` prop. When set it: narrows `repos` to that repository before building cards, passes a snapshot containing only that repository to `boardColumns` (so columns follow that repo's schemas with no change to `columns.ts`), hides the repo chip group, ignores any `repos` key in the URL, renders a repository header above the filter row, and tells `ChangeCard` to omit the repo name. Search, stale and hide-archived filters keep working and keep persisting in the URL. Everything else (archived column behaviour, copy apply command, counts badge) is shared.

*Alternative considered:* a separate `RepoBoard` component composing extracted pieces. More churn in a file other in-flight changes also edit; the prop is a handful of conditionals.

### D3: Repository header
A compact block above the filter row: breadcrumb `Projects / <name>` (the first part links to `/`), the path in monospace with a "Copy cd" button (`cd <path>`, reusing `shellQuote` and the `CopyButton` pattern), current branch badge, worktree count with branches in the `title`, `updated <relTime> ago`, and any repo `warnings` / `error` as notices. No new data is needed; all of it is on `RepoSnapshot`.

### D4: Overview is a table, derived client-side by a pure function
`src/ui/overview.tsx` renders a `<table>` inside an `overflow-x: auto` wrapper (dense, scannable, consistent with the operator-focused design; cards would waste space at 17+ repos). A pure function, e.g. `overviewRows(snapshot, columns, now)`, produces one row per repository:

- `stageCounts`: count of non-archived changes per board column, using the same global `boardColumns(snapshot)` list minus `Archived`, so every row shares one set of stage columns and the header is stable.
- `open`: number of non-archived changes. `toArchive`: changes with `stage === "done"`. `archived`: count, shown in the row `title` only.
- `lastUpdatedAt`: `repo.lastUpdatedAt`, falling back to the newest `lastActivityAt` among its changes when the field is missing (cached snapshot from an older version, or the retained data of a failed scan).
- `ok` / `error`.

Zero counts render as `·` (not `0`) to keep the grid quiet. The `toArchive` cell uses the warning badge with text, never colour alone. A failing repo shows the `⚠` danger badge with the error as `title` but keeps its retained counts. The whole row is a link target (the name is a real `<a href="/repo/<id>">` for keyboard and middle-click; row click calls `navigate`).

Sorting and search are client-side. URL state mirrors the board's convention via a small parser/serializer next to `filters.ts`: `?sort=updated|name|open|archive` (default `updated`, omitted from the URL when default), `&dir=asc` only when not the key's natural direction (dates and counts default descending, name ascending), `&q=`. Ties and missing dates break by name; rows with no date sort last regardless of direction. Clicking a column header sorts by it, clicking again flips direction; headers expose `aria-sort`.

Repos with no open changes need no special handling under the new date rule: they carry a real (old) date and sink. They render slightly dimmed (`--fg-subtle`) with "no open changes" in place of the stage cells.

*Alternative considered:* server-computed rollups on `RepoSnapshot`. Rejected — the snapshot is already fully loaded client-side, the numbers are trivial to derive, and they would duplicate state that can go stale relative to `changes[]`.

### D4a: The UI shows only enabled repositories, and tells same-named ones apart
The scanner only scans enabled repositories, so the snapshot normally contains nothing else. But `PUT /api/config` triggers the rescan without awaiting it and the UI re-fetches state immediately after saving, so a just-disabled repository lingers until the next poll (up to `pollIntervalSeconds`), and longer if a scan was already in flight. `App` therefore derives the snapshot it hands to every view by filtering `snapshot.repos` to the ids enabled in the loaded config (pass-through while the config has not loaded). One filter in one place covers the overview, both boards, the repo-not-found state and the top-bar error badges. Newly enabled repositories still appear when their first scan lands.

*Alternative considered:* make `PUT /api/config` await the scan, or prune the snapshot server-side. Rejected for now: it changes the API contract of an endpoint another in-flight change (`dedupe-discovery`) is modifying, and a save would block for the duration of a scan.

Display names are not unique: the same repository is often checked out under two parents, and names are user-editable. Ids (path hashes) already keep routing, keys and counts apart; only the label is ambiguous. `overviewRows` adds a `hint` to rows whose lower-cased name collides: the shortest trailing run of parent-directory segments that is unique within the colliding group (`acme` vs `repos`; `x/repos` vs `y/repos`). Unique names get no hint, keeping the table quiet. Merging same-named repositories is explicitly not done — they are different working trees with different uncommitted state, which is exactly what the last-updated rule surfaces.

### D5: Last-updated rule — commit date ∪ mtimes of dirty files only
For a git repository, per scan:

1. `git status --porcelain=v1 -z --untracked-files=all -- openspec` once per repo. Parse the NUL-separated records (for rename/copy records the second path is the old name and is skipped; deleted paths are resolved to their nearest existing ancestor directory, whose mtime reflects the deletion). `stat` each resulting path → a list of `{ path, mtimeMs }` ("dirty files").
2. `repo.lastUpdatedAt = max(git log -1 --format=%cI -- openspec, newest dirty mtime)`.
3. For each change, `lastActivityAt = max(commit date of the change dir (existing call, still limited to active + 25 most recent archived), newest mtime among dirty files under that change dir)`. The dirty-file lookup is an in-memory filter, so it applies to all archived changes for free.

For non-git repositories: `lastUpdatedAt = newestMtime(openspec/)`, and changes keep the existing `newestMtime(changeDir)` fallback.

Dates are compared as instants (`Date.parse`), since `%cI` carries a local offset and mtimes are rendered as UTC; the winning value is emitted as an ISO 8601 string.

*Why not `max(commit date, newest mtime of everything)`:* `git clone`, `checkout`, `rebase` and `stash pop` rewrite mtimes of clean files, so every repo would read "just now" after switching branches. Files git considers modified or untracked are exactly the ones whose mtime is meaningful. *Why not commit date only (status quo):* work in progress is invisible, which inverts a "recently updated" sort. *Why `--untracked-files=all`:* the default collapses a brand-new change directory to a single directory entry, whose mtime does not move when files inside it are edited.

`git status` is a new subcommand for this codebase, so the read-only allow-list in the `dashboard-api` spec is extended. By default `git status` opportunistically rewrites `.git/index` to refresh stat data, which would violate the never-writes guarantee; `git.ts` already sets `GIT_OPTIONAL_LOCKS=0` on every invocation, which suppresses that, and the spec now makes it mandatory. A test asserts the index bytes are unchanged after a scan.

Ignored files do not appear in `git status` and therefore do not count; that is intended.

The `RepoSource` seam gains `dirtyFiles(): Promise<{ path: string; mtimeMs: number }[]>` (absolute paths, empty for non-git); `lastActivity(absPath)` is reused unchanged for the `openspec/` directory. Porcelain parsing is a pure exported function in `git.ts` (like `parseWorktrees`) so it can be unit-tested without a repository. The path argument is the constant `openspec`, so the "no untrusted path segment reaches git" requirement is unaffected.

### D6: `RepoSnapshot.lastUpdatedAt` is optional
Snapshots cached by an older binary lack the field, and the scanner's failure path rebuilds a repo entry from the previous snapshot. Making it optional (and carrying `prev?.lastUpdatedAt` through the failure path) avoids a cache migration; the UI fallback in D4 covers the gap until the first scan completes.

## Risks / Trade-offs

- [`git status` is slow on a huge repo with a cold index] → It is path-limited to `openspec/`, runs with `GIT_OPTIONAL_LOCKS=0` like the other calls, and is covered by the existing per-repo timeout; on failure `dirtyFiles()` returns empty and the rule degrades to commit dates (today's behaviour).
- [A dirty file's mtime can still be misleading, e.g. a stash pop re-touching an old edit] → Accepted; it is bounded to files that really differ from HEAD, and errs toward "recent", which is the safe direction for an attention list.
- [Other in-flight changes edit `kanban.tsx`, `app.tsx` and `types.ts`] → Changes here are additive (a prop, new routes, an optional field); `columns.ts` is not touched; stage counts are keyed by whatever `boardColumns` returns, so a new `Ready` column appears in the overview automatically.
- [Row-click navigation can hijack text selection or modifier-clicks] → Only plain left-clicks without a selection navigate; the repo name remains a real link.
- [Breaking `/` bookmarks with filters] → Documented; the combined board is one tab away and accepts the same query string at `/board`.

## Migration Plan

Additive on the server (one optional field); the first scan after upgrade populates it. Rollback is reverting the commit; an older binary ignores the extra field in a cached snapshot.

## Open Questions

- Should the combined "All changes" board eventually be removed? Deferred; revisit after using the overview for a while.
