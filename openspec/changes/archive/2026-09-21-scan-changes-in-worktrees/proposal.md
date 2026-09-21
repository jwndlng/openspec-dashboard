## Why

The board only reads `openspec/changes/` in a repository's main checkout. Since work moved to "one change = one worktree = one branch", a change is born in a linked worktree and stays there — proposal, design, tasks being ticked — until its pull request is merged *and* the local main branch is pulled. Often the archive follows immediately, so the change goes from invisible straight to `Archived`. The dashboard exists to show work in progress and currently shows none of it: at the time of writing four changes were being worked on in worktrees of this very repository and not one was on the board, while the scanner itself was healthy and polling on schedule. The same applies to the worktrees the dashboard's own agent sessions create.

The board should be **worktree agnostic**: a change is shown because it exists in *some* checkout of a tracked repository, not because it happens to be in the main one.

## What Changes

- **The scanner reads changes from every checkout of a tracked repository** — the main checkout and each linked worktree that `git worktree list` reports, wherever it lives on disk (in-repo `.claude/worktrees/…`, sibling directories, and the session worktrees under the dashboard home alike). From a linked worktree it reads only the *active* change directories (`openspec/changes/*`, not `archive/`); archives and main specs keep coming from the main checkout.
- **One card per change, not one per copy.** The same change name usually exists in several checkouts (a proposal merged to main, the implementation progressing in a worktree, stale copies on older branches). Copies are merged into a single change by name, and the card shows the *leading* copy: the one that is furthest along the lifecycle, ties broken by the most recent activity. The card says where that copy lives (its branch), and lists the other checkouts holding a copy in its tooltip.
- **Archived on main wins.** A change that is archived in the main checkout is `Archived`, full stop — an active-looking copy in a worktree whose branch predates the archive is ignored. Without this rule, scanning worktrees would resurrect finished changes (this repository currently has three such stale copies across four worktrees).
- **Everything about a card follows its leading copy**: artifact status, task progress, `Done` vs `Synced` (delta specs compared with the specs of that same checkout), last activity (the existing commit-or-dirty-file rule, evaluated in that checkout, so uncommitted edits in a worktree count), and warnings.
- **The branch badge becomes exact.** Today `branchMatch` guesses by looking for a branch whose name contains the change name. A change found in a worktree now reports the branch of the checkout it was actually found in; the name-based guess remains only for changes that exist solely in the main checkout.
- **"Copy apply command" points at the right place**: `cd <path of the leading copy's checkout> && claude "/opsx:apply <change>"`, instead of always the main checkout — applying in the main checkout is exactly what the worktree workflow forbids. Session starters keep working for such changes: a session copies the change directory from the checkout it actually lives in, and when the branch a session would use (`feat/<change>`) is already checked out in someone's worktree — where git would refuse to create another — the session adopts that worktree instead of failing, and never offers to remove it.
- **Bounded and isolated.** Worktrees are read with limited concurrency under the existing per-repository timeout, with a cap on worktrees per repository; a worktree that is prunable (directory gone), unreadable or slow is skipped with a repository warning and never fails the scan. Reading stays read-only: directory listings and file reads, plus the git commands the scanner already uses, run with `cwd` set to the worktree. No new git subcommand.
- **Projects overview and counts** follow automatically, because they are derived from the merged change list: stage counts, open totals, "to archive", and the repository's last-updated time, which now also reflects activity in its worktrees.
- **Demo build**: sample data gains changes that live in worktrees, including one that also exists on main at an earlier stage.
- Not in this change: showing a repository's worktrees as such or their uncommitted/unpushed state (that is `overview-tiles-and-worktree-status`), reading branches that are not checked out anywhere, and any action on a worktree.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `change-scanner`: "Branch and worktree matching" is modified (exact branch for changes found in a worktree; detached and prunable worktrees are recorded). Three requirements are added: changes are read from every checkout (with every per-change fact — status, progress, last activity, spec sync — evaluated in the checkout a copy lives in, and archives only from main); copies are merged into one change with the archived-on-main rule and the repository's last-updated time covering worktrees; reading worktrees is bounded and isolated. The existing per-change requirements are left as they are: they describe how a change directory is read, which now simply applies per checkout.
- `kanban-board`: "Copy apply command" targets the leading copy's checkout; a new requirement says a change is shown once and its card states which checkout its data comes from.
- `agent-sessions`: "Every session works in its own git worktree, created by the dashboard" (copy the change from the checkout it lives in; adopt a worktree that already has the session's branch checked out) and "Worktree clean-up is offered only when safe" (never for an adopted worktree).

## Impact

- `src/shared/types.ts`: `ChangeSnapshot` gains optional `checkout` (`path`, `branch`, `isMain`) and `otherCheckouts`; optional so cached snapshots still load.
- `src/server/source.ts` (listing active changes of an arbitrary checkout through the `RepoSource` seam; `CHANGE_NAME` validation applies to worktree copies too), `src/server/scanner.ts` (per-checkout scan, merge by name, archived-wins, leading-copy selection as a pure, unit-tested function, bounds, warnings), `src/server/specSync.ts` (spec root passed in instead of assumed).
- `src/server/sessions/manager.ts`, `src/server/sessions/worktree.ts`, `src/server/sessions/store.ts` (copy source, adoption, `adopted` flag, no clean-up offer for adopted worktrees).
- `src/ui/kanban.tsx`, `src/ui/format.ts` (apply command path, checkout badge and tooltip), the session panel (adopted note), `src/ui/demo/sampleData.ts`.
- `test/`: leading-copy selection table; scanner tests in a temporary repository with real linked worktrees (change only in a worktree, change on main and further along in a worktree, stale copy of a change archived on main, uncommitted edits in a worktree driving last activity, prunable and unreadable worktrees, cap exceeded, worktree outside the repository directory); the no-side-effects test extended to worktrees.
- `README.md` and the `change-scanner` Purpose: changes are read from all checkouts.
- Scan cost grows with the number of worktrees times their active changes; archives are not re-read per worktree.
- Interplay: `overview-tiles-and-worktree-status` (proposal and design exist) extends the same worktree list with per-checkout git status; the two are complementary and whichever lands second rebases its `parseWorktrees` / `Worktree` type edits on the other. `create-change-from-dashboard` creates changes in the main checkout and is unaffected. `add-change-detail-view` reads a change's files and must take the path from the change's `checkout` once this lands.
