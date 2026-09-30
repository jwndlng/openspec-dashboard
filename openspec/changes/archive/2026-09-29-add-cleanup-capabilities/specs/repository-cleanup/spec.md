# Spec Delta

## Purpose

Lets the user remove a repository's leftover worktrees, stale worktree records and merged local branches from the
dashboard, offering only what provably holds no work that exists nowhere else, and only on the user's confirmation.

## ADDED Requirements

### Requirement: Cleanup lists what can be removed and why the rest is kept
For an enabled git repository whose last scan succeeded, the dashboard SHALL compute a cleanup preview from local git
with read-only commands and without contacting a remote. The base is the repository's default branch as locally known
(`origin/HEAD`, else a local `main` or `master`). The preview SHALL contain three lists, each item either **removable**
or **kept with a reason**:

- **Worktrees**: every linked worktree of the repository (never the main checkout), whether the dashboard created it
  or not, with its path, branch (or that it is detached), work status, last commit time, and whether the dashboard
  created it. A worktree is removable only if it is a directory and a git worktree, it has no uncommitted or untracked
  file, and either its work status is `merged` or it has no commit that exists nowhere else (nothing ahead of its
  upstream, or, without an upstream, no commit unreachable from every other local or remote-tracking branch). A
  worktree MUST be kept when an agent session is running in it, and when it is locked and the dashboard did not create
  it (the lock reason is shown).
- **Stale worktree records**: worktrees git lists as prunable because their directory no longer exists. They are
  always removable.
- **Branches**: every local branch except the default branch. A branch is removable only if the base is known and
  either every commit on the branch is reachable from the base, or every file the branch changed since it forked from
  the base has the same content in the base (which recognises squash and rebase merges). A branch MUST be kept when it
  is the default branch or the branch the main checkout is on, and when it is checked out in a linked worktree that is
  not itself removable. A branch checked out in a removable worktree SHALL be marked as depending on that worktree.

Every kept item's reason SHALL be stated in words (for example: uncommitted files, commits not in the base with their
count, session running, locked, checked out in the main checkout, default branch unknown). The preview MUST NOT write
anything to the repository.

#### Scenario: Squash-merged branch and its worktree
- **WHEN** worktree `feat/audit-trail` is clean and the base contains a single commit with the same file content as the
  branch's three commits, and its remote branch was deleted
- **THEN** the preview lists the worktree as removable and the branch `feat/audit-trail` as removable, depending on
  that worktree

#### Scenario: Unmerged branch
- **WHEN** local branch `fix/parser` has two commits whose changes are not in the base
- **THEN** the preview lists it as kept with the reason that 2 commits are not in the base

#### Scenario: Worktree with untracked files
- **WHEN** a linked worktree the user created contains one untracked file and its branch is merged
- **THEN** the worktree is kept with the reason that it has uncommitted files, and its branch is kept because it is
  checked out there

#### Scenario: Worktree deleted by hand
- **WHEN** the directory of a linked worktree was deleted with `rm -rf`
- **THEN** the preview lists it under stale worktree records as removable

#### Scenario: Default branch and main checkout
- **WHEN** the main checkout is on `feat/redesign`, which is fully merged, and the default branch is `main`
- **THEN** neither `main` nor `feat/redesign` is listed as removable

#### Scenario: Running session
- **WHEN** an agent session is running in a merged, clean session worktree
- **THEN** the worktree is kept with the reason that a session is running in it

#### Scenario: Locked worktree created by the user
- **WHEN** a clean, merged linked worktree outside `~/.openspec-dashboard/worktrees/` is locked with reason
  `in use by editor`
- **THEN** it is kept and the reason names the lock and `in use by editor`

#### Scenario: Unknown default branch
- **WHEN** the repository has no `origin/HEAD` and no local `main` or `master`
- **THEN** every branch is kept with the reason that the default branch is unknown

#### Scenario: Preview writes nothing
- **WHEN** a preview is computed for a repository whose index has stale stat information
- **THEN** no file in the repository, its git directory or any of its worktrees is modified and no remote is contacted

### Requirement: Cleanup is offered from the repository board and runs only on confirmation
The repository board header SHALL offer a **Clean up** action for an enabled git repository whose last scan succeeded.
It SHALL open a dialog showing the preview in three sections — worktrees, stale worktree records, branches — with
removable items pre-selected and selectable, and kept items listed with their reasons and not selectable. Selecting a
branch that depends on a worktree SHALL also select that worktree; deselecting the worktree SHALL deselect the branch.
The dialog SHALL state that "merged" reflects the last fetch and that pulling first brings it up to date, and SHALL
state that removing a worktree also deletes its ignored files (such as dependencies, build output and local
environment files). The confirm control SHALL name what will happen (for example `Remove 2 worktrees, prune 1 record,
delete 3 branches`) and SHALL be disabled when nothing is selected. When the preview has no removable item the dialog
SHALL say that there is nothing to clean up. Nothing SHALL be removed before the user confirms; closing the dialog
SHALL remove nothing. While a cleanup runs, the dialog SHALL show that it is running and SHALL NOT start a second one.

#### Scenario: Opening the dialog
- **WHEN** the user activates **Clean up** for a repository with one merged worktree and two merged branches
- **THEN** the dialog lists them pre-selected, nothing has been removed, and the confirm control reads
  `Remove 1 worktree, delete 2 branches`

#### Scenario: Cancelling
- **WHEN** the user closes the dialog without confirming
- **THEN** no worktree, record or branch is removed

#### Scenario: Nothing to do
- **WHEN** every worktree and branch of the repository is kept
- **THEN** the dialog says there is nothing to clean up and lists the kept items with their reasons

#### Scenario: Dependent selection
- **WHEN** the user deselects a worktree whose branch is selected
- **THEN** that branch is deselected as well

#### Scenario: Non-git repository
- **WHEN** a tracked repository is not a git repository
- **THEN** no **Clean up** action is offered for it

### Requirement: Confirmed cleanup re-checks every item and removes only what is still safe
When the user confirms, the dashboard SHALL re-check every selected item against the current state, independently of
the preview, and SHALL remove only items that are still removable; an item that is no longer removable, no longer
exists, or was not in the repository's own list SHALL be kept and reported with the reason. A branch SHALL be deleted
only if it still points at the commit shown in the preview. Items SHALL be processed in this order: worktrees, then
stale records, then branches, so that a branch whose worktree was removed in the same run can then be deleted, and a
branch whose worktree was kept is kept. A worktree SHALL be removed with a non-forcing `git worktree remove`, preceded
by `git worktree unlock` only for a worktree the dashboard created; stale records SHALL be removed with
`git worktree prune`; a branch SHALL be deleted with `git branch -D` only after the checks above. A failure of one item
SHALL NOT stop the others. The result SHALL list each item's outcome — removed, pruned, deleted, or kept with the
reason — and for every deleted branch the commit it pointed to and a command that restores it
(`git branch <name> <commit>`). The repository SHALL be rescanned afterwards and the view SHALL update without a page
reload.

#### Scenario: Merged worktree and branch
- **WHEN** the user confirms the removal of a clean, merged worktree on `feat/audit-trail` and of that branch
- **THEN** the worktree directory is gone, `git branch --list feat/audit-trail` is empty, and the result shows the
  branch's former commit and `git branch feat/audit-trail <commit>`

#### Scenario: Changed since the preview
- **WHEN** a file is created in a selected worktree after the preview was shown, and the user then confirms
- **THEN** that worktree and its branch are kept and reported with the reason that the worktree has uncommitted files,
  and the other selected items are removed

#### Scenario: Branch moved since the preview
- **WHEN** a selected branch receives a new commit after the preview was shown
- **THEN** the branch is kept and reported as changed since the preview

#### Scenario: Session started meanwhile
- **WHEN** an agent session is started in a selected worktree before the user confirms
- **THEN** the worktree is kept and reported with the reason that a session is running in it

#### Scenario: Restoring a deleted branch
- **WHEN** the user runs the restore command shown for a deleted branch
- **THEN** the branch exists again at the same commit

### Requirement: Cleanup never touches more than it lists
Cleanup MUST NOT contact a remote, delete or change a remote-tracking branch, delete a remote branch, force a worktree
removal, delete the default branch or the branch the main checkout is on, change the main checkout's branch, index or
working tree, commit, reset, stash, or run repository hooks. It MUST NOT remove anything the user did not select in
the dialog, and MUST NOT run on a timer, during a scan, on page load or as a side effect of another action. Cleanup
SHALL be available whether or not agent sessions are enabled.

#### Scenario: Remote untouched
- **WHEN** a cleanup deletes two branches in a repository whose remote is a local recording repository
- **THEN** the remote receives no request and every `refs/remotes/` ref of the repository is unchanged

#### Scenario: Main checkout untouched
- **WHEN** a cleanup removes worktrees and branches
- **THEN** the main checkout's branch, `git status` and `.git/index` are unchanged

#### Scenario: Agent sessions disabled
- **WHEN** agent sessions are disabled and the user confirms a cleanup of a merged worktree the user created
- **THEN** the worktree is removed and no agent process is started
