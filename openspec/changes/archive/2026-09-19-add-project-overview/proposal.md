## Why

With 17+ tracked repositories the single combined Kanban has become one huge board: 40+ cards, a wall of repo chips, and no way to see at a glance which repository is active or where work is piling up. The natural way to navigate is repository first, change second. The board also misreports recency: a change's `lastActivityAt` is the last *commit* date, so the change being edited right now can show "3w ago" until it is committed.

## What Changes

- Add a **Projects overview** as the new landing page (`/`): one row per tracked repository showing a per-stage count of its open changes, open total, changes waiting to be archived, scan errors, and when the repository's OpenSpec content was last updated. Sorted by last updated (newest first) by default; sortable by name, open count and to-archive count; text search; sort and search persist in the URL.
- Add a **repository board** (`/repo/<id>`) as the drill-down: the existing Kanban scoped to one repository, with a header showing the repository's path, branch, worktrees, warnings and last-updated time, and columns derived from that repository's own changes.
- Move the combined all-repositories board to `/board` and keep it as a second tab ("All changes"). **BREAKING** for bookmarks: `/` now shows the overview; old filter links such as `/?repos=…` must become `/board?repos=…`.
- Define a repository's **last updated** as: the most recent change to any file under its `openspec/` directory — the latest commit touching `openspec/`, or the mtime of any file there that git reports as modified or untracked, whichever is newer. Mtimes of clean files are ignored so clones, checkouts and rebases do not make everything look fresh.
- Apply the same rule to each change's `lastActivityAt`, so uncommitted edits count there too and cards agree with the overview.
- Cards on a repository board omit the repository name (it is in the header).

## Capabilities

### New Capabilities
- `project-overview`: The repository-first navigation — the overview table (content, sorting, search, empty and error states) and the single-repository board drill-down (routing, header, column derivation, navigation back).

### Modified Capabilities
- `change-scanner`: "Last activity comes from git with a filesystem fallback" changes to include uncommitted modifications; a new requirement adds a repository-level `lastUpdatedAt` covering the whole `openspec/` directory.
- `dashboard-api`: "The dashboard never writes to tracked repositories" adds `status` to the allowed read-only git subcommands and requires optional locks to be disabled so `git status` cannot rewrite `.git/index`. Note: the in-flight `dedupe-discovery` change modifies the same requirement (adds `config --get`); whichever archives second must merge both additions.
- `kanban-board`: "Cards show repository, name, progress, activity and branch" changes so the repository name is omitted on a single-repository board.

## Impact

- `src/shared/types.ts`: `RepoSnapshot.lastUpdatedAt` (optional, so cached snapshots from older versions still load).
- `src/server/git.ts`, `src/server/source.ts`, `src/server/scanner.ts`: one extra `git status --porcelain` and one extra `git log -1` per repository per scan (both read-only); per-change activity merges in dirty-file mtimes.
- `src/ui/app.tsx`: routes `/`, `/board`, `/repo/<id>`, `/settings`; nav gains a tab. The server already serves the SPA for every non-API path, so no server routing change.
- `src/ui/overview.tsx` (new), `src/ui/kanban.tsx` (optional fixed-repo mode), `src/ui/filters.ts` or a sibling for overview URL state, `src/ui/styles.css` (table styles using existing tokens, both themes).
- `test/`: scanner tests for the new activity rule; unit tests for overview row derivation and sorting.
- `README.md`: describe the new navigation.
- No API endpoint, config-file or dependency changes. Does not touch the "Board columns are derived…" requirement, so it does not conflict with the in-flight `add-ready-column` change; the overview's stage counts use whatever columns the board derives.
