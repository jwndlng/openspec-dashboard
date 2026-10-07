## MODIFIED Requirements

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
- **WHEN** a clean, merged linked worktree outside `~/.spec-control/worktrees/` is locked with reason
  `in use by editor`
- **THEN** it is kept and the reason names the lock and `in use by editor`

#### Scenario: Unknown default branch
- **WHEN** the repository has no `origin/HEAD` and no local `main` or `master`
- **THEN** every branch is kept with the reason that the default branch is unknown

#### Scenario: Preview writes nothing
- **WHEN** a preview is computed for a repository whose index has stale stat information
- **THEN** no file in the repository, its git directory or any of its worktrees is modified and no remote is contacted
