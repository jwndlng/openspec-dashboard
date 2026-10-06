# Spec Delta

## ADDED Requirements

### Requirement: Ending a session removes a removable worktree by default
Wherever the dashboard asks the user to confirm ending or cleaning up a session and offers to remove its worktree, that
offer SHALL be pre-selected whenever it is made — that is, whenever the worktree may be removed under "Worktree clean-up
is offered only when safe" — whatever the worktree's work status, and not only when it is `merged`. The offer SHALL
remain a visible control the user can clear before confirming. When the worktree may not be removed, nothing SHALL be
pre-selected and the reason SHALL be shown as before. Confirming with the offer cleared SHALL keep the worktree;
cancelling SHALL end, remove and pull nothing. Every such dialog SHALL start from this default: a choice the user made
in an earlier dialog SHALL NOT carry over. The removal SHALL still be decided by the server's own checks at the moment
of confirmation, so a worktree that became unsafe to remove after the dialog opened is kept and the reason reported.

#### Scenario: Pushed work, removal pre-selected
- **WHEN** the user ends a session whose worktree is clean and whose commits are all on its upstream, while its work
  status is still `pushed` because the merge has not been fetched yet
- **THEN** the dialog offers to remove the worktree, already selected, and confirming removes the worktree and keeps
  its branch

#### Scenario: Merged work, removal pre-selected
- **WHEN** the user ends a session whose worktree is clean and whose work status is `merged`
- **THEN** the dialog offers to remove the worktree, already selected

#### Scenario: Removal cleared
- **WHEN** the user clears the removal offer and confirms
- **THEN** the session ends and the worktree is kept

#### Scenario: Worktree that cannot be removed
- **WHEN** the user ends a session whose worktree has an uncommitted file
- **THEN** no removal is offered or selected, and the dialog says why the worktree is kept

#### Scenario: Earlier choice not remembered
- **WHEN** the user cleared the removal offer when ending one session and then ends another session whose worktree may
  be removed
- **THEN** the second dialog offers the removal already selected

## MODIFIED Requirements

### Requirement: Ending a session also offers to pull the repository
Wherever the dashboard offers to remove a session's worktree when the session ends, it SHALL — for a repository the
pull action can run in, meaning a tracked git repository that was scanned without error — also offer to pull that
repository, so that the main checkout the dashboard reads archives, specs and progress from catches up with work that
was merged. The offer SHALL be pre-selected whenever it is made, whatever the worktree's work status, and SHALL remain
a visible control the user can clear before confirming; a choice the user made in an earlier dialog SHALL NOT carry
over. It SHALL be shown whether or not the worktree itself can be removed. When the user confirms with the offer
selected, the pull SHALL run after the session has ended and after the worktree was removed, and SHALL be the same
action the repository's own Pull control runs, with the same safety rules and the same outcomes. A pull that is
already running for that repository SHALL NOT be started a second time. Nothing SHALL be pulled when the offer is not
selected, when the user cancels, or for a repository the pull action cannot run in.

#### Scenario: Merged work, pull pre-selected
- **WHEN** the user ends a session whose worktree's work status is `merged`, in a tracked git repository
- **THEN** the dialog offers both the worktree removal and the pull, both already selected

#### Scenario: Pushed work, pull pre-selected
- **WHEN** the user ends a session whose worktree's work status is `pushed`, in a tracked git repository
- **THEN** the dialog offers the pull, already selected

#### Scenario: Confirming pulls after the worktree is gone
- **WHEN** the user confirms with both offers selected
- **THEN** the session ends, the worktree is removed, and only then is the repository fetched and fast-forwarded

#### Scenario: Unshipped work
- **WHEN** the user ends a session whose worktree has commits that exist only on its branch
- **THEN** the worktree removal is not offered, the pull is offered and already selected, and confirming ends the
  session, keeps the worktree and pulls the repository

#### Scenario: Offer declined
- **WHEN** the user clears the pull offer and confirms
- **THEN** the session ends and no remote is contacted

#### Scenario: Cancelled dialog
- **WHEN** the user cancels the dialog while the pull offer is selected
- **THEN** nothing is ended, removed or pulled

#### Scenario: Not a repository the pull action can run in
- **WHEN** the session's repository is not a git repository, or its last scan failed
- **THEN** no pull is offered and ending the session pulls nothing
