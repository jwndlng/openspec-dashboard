# Tasks

## 1. Work status on the server
- [x] 1.1 Types: `WorkState`, `WorkStatus`, `SessionWorktree`, `ship` prompt key, `DEFAULT_SHIP_PROMPT`
- [x] 1.2 `src/server/sessions/workStatus.ts`: `readWorkStatus`, `listWorktrees` (read-only git, no network)
- [x] 1.3 `checkWorktreeRemovable`/`removeWorktree` accept merged work
- [x] 1.4 Manager: cached `worktrees()`, invalidation, `ship()`, `removeWorktreeByName()`
- [x] 1.5 Config: optional `ship` prompt (`{change}` optional, bypass flags rejected)
- [x] 1.6 API: `worktrees` in `GET /api/sessions`, `POST /api/sessions/:id/ship`, `POST /api/worktrees/remove`

## 2. UI
- [x] 2.1 Api interface, http and demo implementations
- [x] 2.2 Pure helpers: `workBadge`, staleness, `openWork`, `worktreeForChange`
- [x] 2.3 Card work badge
- [x] 2.4 Open work control in the top bar
- [x] 2.5 Panel: status line, Ship, removal preselected when merged
- [x] 2.6 Settings: Ship prompt field with the default shown

## 3. Tests
- [x] 3.1 Work status states against real temp repositories (uncommitted, unpushed, pushed, merged by reachability, squash-merged, clean, missing)
- [x] 3.2 Reading statuses leaves the index and worktree untouched
- [x] 3.3 Ship: running (typed), ended with and without resume command, nothing to ship
- [x] 3.4 API: worktrees listed, feature off, path traversal, removal under a running session, removal of a record-less merged worktree
- [x] 3.5 Config and UI helper tests

## 4. Docs and verification
- [x] 4.1 `CLAUDE.md` read-only git list, `README.md` agent sessions
- [x] 4.2 `bun run check`, build the binary, exercise the endpoints against it with the fake agent
