## MODIFIED Requirements

### Requirement: Every session works in its own git worktree, created by the dashboard
A session MUST NOT run in the repository's main checkout. Before starting the agent, the dashboard SHALL ensure a git worktree for the session under `~/.openspec-dashboard/worktrees/<repository id>/`, outside the repository's working tree, on branch `feat/<change>` — or, for **Archive**, in a worktree and branch of its own (`archive-<change>`, `chore/archive-<change>`). An existing worktree for that name SHALL be reused; an existing branch SHALL be checked out; otherwise the branch SHALL be created from the repository's default branch as currently known locally (`origin/HEAD`, else `HEAD`). As the one exception, when a Draft or Implement session's branch `feat/<change>` is already checked out in another linked worktree of the repository, the session SHALL adopt that worktree — run the agent there instead of creating one — and SHALL record and show that the worktree was adopted. The dashboard MUST NOT contact a remote for this. If the change's directory is missing from the session's worktree, the dashboard SHALL copy it from the checkout the change's data comes from (the main checkout or a linked worktree), including when it exists there only uncommitted. The main checkout's branch, index and working tree MUST NOT be changed. The session record and panel SHALL show the worktree path and branch.

#### Scenario: Two sessions in one repository
- **WHEN** sessions are open for changes `audit-trail` and `upgrade-runtime` of the same repository
- **THEN** they run in two different worktrees on two different branches and the main checkout's branch and `git status` are unchanged

#### Scenario: Uncommitted change directory
- **WHEN** a session is opened for a change whose directory exists only uncommitted in the main checkout
- **THEN** the worktree contains a copy of that directory before the agent starts

#### Scenario: Change lives only in another worktree on another branch
- **WHEN** a session is opened for change `audit-trail`, which exists only in a worktree on branch `wip/compliance`
- **THEN** a session worktree on `feat/audit-trail` is created and contains a copy of the change directory from that worktree before the agent starts

#### Scenario: The change's branch is already checked out
- **WHEN** an Implement session is opened for change `audit-trail` and branch `feat/audit-trail` is checked out in a linked worktree that the user created
- **THEN** the agent runs in that worktree, no new worktree is created, and the panel shows the worktree as adopted

#### Scenario: Archiving does not reuse the implementation worktree
- **WHEN** a change was implemented in a session whose worktree still exists, and the user later starts **Archive** for it
- **THEN** the archive session runs in a separate worktree on a `chore/archive-<change>` branch

#### Scenario: Worktree cannot be created
- **WHEN** git refuses to create the worktree
- **THEN** the request fails with git's reason and no agent is started

### Requirement: Worktree clean-up is offered only when safe
When ending or cleaning up a session the dashboard SHALL offer to remove the session's worktree only if the dashboard created it and it has no uncommitted changes and no commits that exist nowhere else (nothing ahead of its upstream, or, without an upstream, no commit that is unreachable from every other local or remote-tracking branch). Removal SHALL happen only after the user confirms, by a non-forcing `git worktree remove`. Otherwise the worktree MUST be kept and the reason shown. A worktree that a session adopted MUST NOT be offered for removal and MUST NOT be removed by the dashboard.

#### Scenario: Unpushed work
- **WHEN** the user ends a session whose worktree has commits that exist only on its branch
- **THEN** removal is not offered, the worktree is kept, and the panel explains why

#### Scenario: Clean worktree
- **WHEN** the worktree is clean, its commits exist elsewhere, and the user confirms removal
- **THEN** the worktree is removed

#### Scenario: Adopted worktree
- **WHEN** the user ends a session that adopted a worktree the user had created, and that worktree is clean
- **THEN** removal is not offered and the worktree is kept
