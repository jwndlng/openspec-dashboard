## 1. Path selection

- [x] 1.1 Add `changeWorktreePath(change, worktrees)` — the non-main `checkout.path`, else the most recently active session worktree of that repository and change, else undefined
- [x] 1.2 Unit tests: linked worktree wins, session worktree fallback, latest of several, main checkout only → none, other changes' worktrees ignored

## 2. Detail header

- [x] 2.1 Add a `WorktreePath` button-badge (folder glyph, head-clipped path, full path tooltip, accessible name `Copy worktree path <path>`) that copies the exact path and confirms `Copied` only on success
- [x] 2.2 Render it in `ChangeFacts` after the branch badge; styles in `src/ui/styles.css`
- [x] 2.3 Tests: the header offers the component for a change in the snapshot and not for one gone from it; the path label keeps the worktree's name as its tail

## 3. Verify

- [x] 3.1 `bun run check` passes
- [x] 3.2 In the running dashboard, open a change with a worktree, click the badge and paste the path into a terminal (`cd <paste>` lands in the worktree)
