# Spec Delta

## ADDED Requirements

### Requirement: A merged auto-merge pull request ends its session
When the dashboard appends the Ship or Archive auto-merge instruction to a prompt for a change session — starting the session, sending the action into its running session, or Ship — it SHALL record on that session the time it did so (the latest such time when it happens more than once). A session without that record SHALL never be ended or have its worktree removed by this requirement.

Whenever a pull-request query for a repository completes — whatever started it: the user's Refresh, opening a view that shows pull requests, or the board's pull-request watch — the dashboard SHALL look in that query's result for each session of that repository that carries the record, is not in place and did not adopt its worktree, and whose worktree still exists or whose agent still runs. When the result holds a pull request in the merged state whose head branch is that session's branch and whose merge time is later than the recorded time, and the repository has auto-merge of docs-only pull requests switched on at that moment, the dashboard SHALL, without asking, end the session's agent as ending the session does, and then remove its worktree under exactly the rules of "Worktree clean-up is offered only when safe": by a non-forcing `git worktree remove`, only when it holds no uncommitted change and either its work status is `merged` or no commit exists only on its branch. When those checks refuse, the agent SHALL still be ended, the worktree SHALL be kept, and the session SHALL keep the reason. It SHALL decide this only from the pull-request query's result and read-only git; it MUST NOT start a pull-request query, a `gh` process or a timer for it, MUST NOT fetch, and MUST NOT delete the session's branch or any other ref — the branch is left for repository cleanup. A session that this ended SHALL keep, and its panel and card SHALL show, that it was ended because pull request `#<number>` merged, and whether its worktree was removed or why it was kept. A merged pull request found again in a later query SHALL change nothing more. In the demo nothing SHALL be ended or removed.

#### Scenario: Archive pull request merges while the board is watching
- **WHEN** a repository has docs auto-merge on, the archive session of `rotate-keys` was started with the archive auto-merge instruction, its agent pushed branch `archive-rotate-keys` and opened `#88` with auto-merge enabled, and a later pull-request watch refresh shows `#88` merged
- **THEN** the session's agent is ended, its clean, pushed worktree is removed, branch `archive-rotate-keys` still exists locally, and the panel says the session ended because `#88` merged and its worktree was removed

#### Scenario: Nothing was asked
- **WHEN** a pull-request refresh shows the pull request of an Implement session's branch merged, and that session's prompts never carried the auto-merge instruction
- **THEN** the session keeps running and its worktree is kept

#### Scenario: Auto-merge switched off since
- **WHEN** the user switched docs auto-merge off for the repository after the Ship that carried the instruction, and a refresh then shows that pull request merged
- **THEN** the session keeps running and its worktree is kept

#### Scenario: An earlier pull request of the same branch
- **WHEN** a session was asked to enable auto-merge at 10:00 and the refresh shows a pull request of its branch that merged at 09:30
- **THEN** nothing is ended or removed

#### Scenario: Uncommitted work keeps the worktree
- **WHEN** the auto-merge pull request of a session has merged and its worktree has an uncommitted file
- **THEN** the agent is ended, the worktree is kept, and the panel says the worktree was kept because it has uncommitted changes

#### Scenario: Already ended by the user
- **WHEN** the user ended a session but kept its worktree, and a later refresh shows its auto-merge pull request merged
- **THEN** the worktree is removed when the checks allow it, and no agent is started or ended

#### Scenario: No query, no action
- **WHEN** the auto-merge pull request of a running session merges on GitHub while no view that queries pull requests is open
- **THEN** the session keeps running and no `gh` or git process is started for it until a pull-request query runs

#### Scenario: Seen again
- **WHEN** a later refresh shows the same merged pull request for a session this already ended
- **THEN** nothing else is ended, removed or recorded

## MODIFIED Requirements

### Requirement: Worktree clean-up is offered only when safe
When ending or cleaning up a session, or for a worktree that has no session record, the dashboard SHALL offer to remove the worktree only if the dashboard created it, it has no uncommitted changes, and either its work status is `merged` or it has no commits that exist nowhere else (nothing ahead of its upstream, or, without an upstream, no commit that is unreachable from every other local or remote-tracking branch). Removal SHALL happen only after the user confirms, by a non-forcing `git worktree remove` — the one exception is the automatic removal when a session's auto-merge pull request has merged, under the same checks, as specified in "A merged auto-merge pull request ends its session"; removing a session's worktree from the session views never deletes its branch — deleting merged branches is done only by repository cleanup, as specified in the `repository-cleanup` capability. Otherwise the worktree MUST be kept and the reason shown. A worktree MUST NOT be removed while a session is running in it. A worktree that a session adopted MUST NOT be offered for removal by the session views and MUST NOT be removed by them; it MAY be removed by repository cleanup under that capability's rules, like any other linked worktree the user created, when no session is running in it. An in-place session has no worktree: removal MUST NOT be offered for it, and ending it SHALL end the agent and nothing else.

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

#### Scenario: Ending an in-place session
- **WHEN** the user ends a session that ran in a folder that is not a git repository
- **THEN** the dialog offers neither a worktree removal nor a pull, and confirming ends the agent and leaves the folder untouched
