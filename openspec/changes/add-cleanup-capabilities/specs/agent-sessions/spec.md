# Spec Delta

## MODIFIED Requirements

### Requirement: Worktree clean-up is offered only when safe
When ending or cleaning up a session, or for a worktree that has no session record, the dashboard SHALL offer to remove the worktree only if the dashboard created it, it has no uncommitted changes, and either its work status is `merged` or it has no commits that exist nowhere else (nothing ahead of its upstream, or, without an upstream, no commit that is unreachable from every other local or remote-tracking branch). Removal SHALL happen only after the user confirms, by a non-forcing `git worktree remove`; removing a session's worktree from the session views never deletes its branch — deleting merged branches is done only by repository cleanup, as specified in the `repository-cleanup` capability. Otherwise the worktree MUST be kept and the reason shown. A worktree MUST NOT be removed while a session is running in it. A worktree that a session adopted MUST NOT be offered for removal by the session views and MUST NOT be removed by them; it MAY be removed by repository cleanup under that capability's rules, like any other linked worktree the user created, when no session is running in it.

#### Scenario: Unpushed work
- **WHEN** the user ends a session whose worktree has commits that exist only on its branch
- **THEN** removal is not offered, the worktree is kept, and the panel explains why

#### Scenario: Clean worktree
- **WHEN** the worktree is clean, its commits exist elsewhere, and the user confirms removal
- **THEN** the worktree is removed

#### Scenario: Squash-merged and the remote branch is gone
- **WHEN** the worktree is clean, its work status is `merged`, its upstream no longer exists, and the user confirms removal
- **THEN** the worktree is removed and its local branch still exists

#### Scenario: Adopted worktree
- **WHEN** the user ends a session that adopted a worktree the user had created, and that worktree is clean
- **THEN** removal is not offered and the worktree is kept

#### Scenario: Adopted worktree in repository cleanup
- **WHEN** the session that adopted a clean, merged worktree has ended and the user opens repository cleanup
- **THEN** the worktree is listed as removable there, and is removed only if the user confirms
