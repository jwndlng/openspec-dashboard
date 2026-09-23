# Proposal

## Why

Every change leaves a branch behind, and most leave a worktree: agent sessions create `feat/<change>` and
`chore/archive-<change>` worktrees under `~/.openspec-dashboard/worktrees/`, and people and agents create their own
(`.claude/worktrees/…`). After the pull request is merged they stay, clutter the checkout chips and the work-in-progress
counts, and have to be cleaned up by hand with git — one `git worktree remove` and one `git branch -D` at a time, each
time working out whether the branch was really merged (squash merges make `git branch -d` refuse). The dashboard
already knows which work is merged; it should offer to remove what is provably no longer needed.

## What Changes

- A **Clean up** action on a git repository's board header opens a dialog that lists, per repository:
  - **Worktrees** — every linked worktree of the repository (the dashboard's session worktrees and ones the user
    created), with its branch and work status. A worktree is offered for removal only when it is clean and its work is
    merged or exists elsewhere — the same checks that already gate removing a session worktree. Locked worktrees the
    dashboard did not create, and worktrees with a running session, are kept.
  - **Stale worktree records** — records whose directory no longer exists, removed with `git worktree prune`.
  - **Branches** — local branches whose work is in the default branch as last fetched: the tip is reachable from it, or
    every file the branch changed has the same content there (squash and rebase merges). The default branch, and any
    branch checked out in a worktree that is not also being removed, are never offered.
  Safe items are pre-selected; everything that is kept is listed with the reason. One confirmation removes the selected
  items; the result lists each item's outcome, and for every deleted branch the commit it pointed to and the command to
  restore it.
- The server re-checks every item when the user confirms and never trusts the preview: an item that changed since the
  preview (new commits, new files, a session started) is kept and reported.
- **BREAKING (invariant)**: the dashboard may now **delete local branches** — a new, sixth enumerated exception to
  "never writes to tracked repositories", limited to `git branch -D` of a branch the cleanup proved merged, on the
  user's confirmation, after re-checking that the branch still points at the commit the user saw. It still never
  deletes remote branches, never contacts a remote for cleanup, and never forces a worktree removal.
- Worktree removal extends from dashboard-created worktrees to every linked worktree of the repository, under the same
  non-forcing `git worktree remove`. An adopted worktree may be removed from the cleanup dialog when no session is
  running in it; the end-session dialog still never offers it.
- New read-only `GET /api/repos/<id>/cleanup` (preview) and mutating `POST /api/repos/<id>/cleanup` (apply), under the
  same-origin guard. Cleanup is independent of the agent-sessions setting.
- The demo simulates cleanup in memory.

## Capabilities

### New Capabilities
- `repository-cleanup`: what counts as a removable worktree, a stale worktree record and a deletable branch; the
  cleanup dialog; confirmation, re-checking and reporting; and what cleanup never does.

### Modified Capabilities
- `dashboard-api`: "The dashboard never writes to tracked repositories" gains the branch-deletion exception and widens
  worktree removal to all linked worktrees; new cleanup endpoints.
- `agent-sessions`: "Worktree clean-up is offered only when safe" — adopted worktrees may be removed by repository
  cleanup (never by the end-session dialog, never while a session runs in them).
- `project-overview`: "Repository board header" offers the Clean up action.
- `demo-site`: cleanup is simulated in the demo.

## Impact

- `src/server/cleanup.ts` (new) — candidate listing (read-only) and applying a confirmed selection; the only place that
  deletes a branch.
- `src/server/sessions/worktree.ts` — `checkWorktreeRemovable`/`removeWorktree` reused for any linked worktree;
  unlocking stays limited to dashboard-created worktrees.
- `src/server/sessions/workStatus.ts` — the "content is in the base" check takes a ref, so it also works for a branch
  without a worktree.
- `src/server/sessions/manager.ts` — exposes which worktrees have a running session, so cleanup can keep them.
- `src/server/api.ts` — the two cleanup routes.
- `src/shared/types.ts` — cleanup preview and result types.
- `src/ui/cleanup.tsx` and `src/ui/cleanupState.ts` (new; the dialog and its DOM-free selection logic), `src/ui/kanban.tsx`
  (header button), `src/ui/api.ts`, `src/ui/styles.css`.
- `src/ui/demo/demoCleanup.ts` (new), `src/ui/demo/demoApi.ts`, `src/ui/demo/sampleData.ts` — simulated cleanup and
  merged and unmerged branches in the sample.
- `test/` — cleanup against temporary git repositories (merged, squash-merged, unmerged, dirty, locked, prunable,
  checked-out, default branch, changed-since-preview), API tests incl. same-origin refusal, demo API test.
- `CLAUDE.md` (invariant 1: the sixth exception, `branch -D`), `README.md` (feature list and the "what it writes"
  list).
- No new dependencies, no network.
