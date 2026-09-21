# Tasks

## 1. Scanner
- [x] 1.1 `scanWorktree` lists archives and returns pending ones (filtered against main by name and date) as scanned copies
- [x] 1.2 `mergeChanges`: pending archive leads, active copies become other checkouts, later-created copies stay a separate active change
- [x] 1.3 Tests: pending archive with active main copy, archives main already has are not scanned, name reuse, pending archive without any active copy, two pending archives

- [x] 1.4 Subdirectory projects: read the same subdirectory in each worktree, with a test

## 2. UI
- [x] 2.1 `pendingArchiveHint` with tests
- [x] 2.2 Badge on archived cards whose checkout is a worktree

## 3. Docs and verification
- [x] 3.1 README where it describes which checkout archives come from
- [x] 3.2 `bun run check`, `bun run build`; compiled binary against a temp repository with an archive only in a worktree
