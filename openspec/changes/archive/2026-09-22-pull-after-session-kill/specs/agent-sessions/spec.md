# Spec Delta

## ADDED Requirements

### Requirement: Ending a session also offers to pull the repository
Wherever the dashboard offers to remove a session's worktree when the session ends, it SHALL — for a repository the
pull action can run in, meaning a tracked git repository that was scanned without error — also offer to pull that
repository, so that the main checkout the dashboard reads archives, specs and progress from catches up with work that
was merged. The offer SHALL be pre-selected exactly when the worktree's work status is `merged`, and SHALL be
unselected otherwise; it SHALL be shown whether or not the worktree itself can be removed. When the user confirms with
the offer selected, the pull SHALL run after the session has ended and after the worktree was removed, and SHALL be
the same action the repository's own Pull control runs, with the same safety rules and the same outcomes. A pull that
is already running for that repository SHALL NOT be started a second time. Nothing SHALL be pulled when the offer is
not selected, when the user cancels, or for a repository the pull action cannot run in.

#### Scenario: Merged work, pull pre-selected
- **WHEN** the user ends a session whose worktree's work status is `merged`, in a tracked git repository
- **THEN** the dialog offers both the worktree removal and the pull, both already selected

#### Scenario: Confirming pulls after the worktree is gone
- **WHEN** the user confirms with both offers selected
- **THEN** the session ends, the worktree is removed, and only then is the repository fetched and fast-forwarded

#### Scenario: Unshipped work
- **WHEN** the user ends a session whose worktree has commits that exist only on its branch
- **THEN** the pull is offered but not selected, and ending the session pulls nothing

#### Scenario: Offer declined
- **WHEN** the user clears the pull offer and confirms
- **THEN** the session ends and no remote is contacted

#### Scenario: Cancelled dialog
- **WHEN** the user cancels the dialog while the pull offer is selected
- **THEN** nothing is ended, removed or pulled

#### Scenario: Not a repository the pull action can run in
- **WHEN** the session's repository is not a git repository, or its last scan failed
- **THEN** no pull is offered and ending the session pulls nothing

### Requirement: A pull the user needs to know about is stated before the dialog closes
When a pull started from the end-session dialog leaves the main checkout behind — it only fetched, was refused, or
failed — the dialog SHALL stay open, SHALL name that outcome with git's reason available, and SHALL say that the
session has already ended, so that the user learns the view may still be outdated. A pull that fast-forwarded the
checkout, found it already up to date, or found the repository has no remote to pull from SHALL close the
dialog. While the pull runs the dialog SHALL show that it is
running and SHALL NOT accept a second confirmation. The outcome SHALL also be reported next to the repository's own
Pull control, as any other pull's is.

#### Scenario: Refused pull
- **WHEN** the pull is refused because local and remote history have diverged
- **THEN** the dialog stays open, says the pull was refused and why, and says the session has ended

#### Scenario: Failed pull
- **WHEN** the remote cannot be reached
- **THEN** the dialog stays open with git's reason, and the session and the worktree removal are unaffected

#### Scenario: Successful pull
- **WHEN** the pull fast-forwards the main checkout by two commits
- **THEN** the dialog closes, the board shows the repository's new state without a page reload, and `+2 commits` is
  reported next to the repository's Pull control

#### Scenario: While it runs
- **WHEN** the pull started from the dialog has not finished
- **THEN** the dialog shows that it is running and confirming again starts nothing
