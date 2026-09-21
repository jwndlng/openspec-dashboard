# Design

## Context

`scanRepo` scans the main checkout's active and archived changes, `scanWorktrees` adds active copies from linked worktrees, and `mergeChanges(copies, archivedOnMain)` picks a leading copy per name. `scan-changes-in-worktrees` chose to read archives from main only, reasoning that an archive on a branch "has not happened". In practice it has: agent sessions archive on `chore/archive-<change>` in a worktree, the PR merges remotely, and the main checkout — often on another branch and rarely pulled, since the dashboard never fetches — keeps a stale active copy for weeks.

## Goals / Non-Goals

**Goals:** the furthest stage found in any checkout wins, archives included; the card says why it differs from the main checkout.
**Non-Goals:** fetching; looking into branches that are not checked out anywhere (`git ls-tree` over refs — more git, unbounded); reading main specs from worktrees.

## Decisions

### D1 — Read archive *names* everywhere, scan only pending ones
Every branch carries main's archives along, so a worktree typically lists dozens of archives the main checkout already has. `listChanges()` already returns them from one `readdir`; they are filtered against the main checkout's archives by name and date (`main date >= worktree date`) before anything is scanned. What is left — normally zero or one entry — goes through `scanChange` with the worktree's context, like any copy.

### D2 — Merge rule
`mergeChanges(copies, archivedOnMain, pending)`: for a name with a pending archive, active copies with `created` later than the archive date form their own active change (name reuse, mirroring the existing guard); all others become `otherCheckouts` of the archived change. Several pending archives of one name: latest date, then path. No new field in `ChangeSnapshot`: "archived, and `checkout` is a linked worktree" *is* the pending state, and old cached snapshots simply lack it.

### D3 — UI
`pendingArchiveHint(change)` in `format.ts` (pure, tested) builds badge text and tooltip; `kanban.tsx` renders it for archived cards with a non-main checkout. Tone `warn`: nothing is wrong with the change, the checkout is behind.

## Risks / Trade-offs

- An abandoned archive branch left in a worktree shows its change as archived although it never merged → the badge says exactly that ("on branch X, not in the main checkout"), and removing the worktree removes it. Better than the opposite error, which hides finished work.
- Archived column limits apply as before (the newest N by date).
