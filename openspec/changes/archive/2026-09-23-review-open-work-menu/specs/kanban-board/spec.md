# Spec Delta

## MODIFIED Requirements

### Requirement: Open work list
While agent sessions are enabled the top bar SHALL show an "Open work" control with the number of agent sessions that are currently running, across all repositories; it SHALL be hidden when no session is running. Opening it SHALL list exactly those running sessions — oldest first — each with repository, change, the session's action, agent, branch, its live session badge, the work-status badge of its worktree when there is one, and how long ago it started. Sessions that have ended or failed, worktrees without a session record and worktrees of archived or vanished changes MUST NOT be listed, whatever their work status. Activating an entry SHALL show that session's panel, following the same rule as selecting its tab, and close the list. The list SHALL update as sessions start and end, without a reload.

#### Scenario: Only running sessions are listed
- **WHEN** one session is running for `add-login`, a session for `fix-parser` has ended with 2 unpushed commits in its worktree, and an orphaned worktree of `audit-trail` holds uncommitted files
- **THEN** the control reads `Open work 1` and its list shows only `add-login`

#### Scenario: A session that ends leaves the list
- **WHEN** the list shows a running session and that session's agent exits
- **THEN** the entry disappears from the list and the count drops, and the card still shows the worktree's work-status badge

#### Scenario: Stale worktrees stay out
- **WHEN** a worktree has had unpushed commits for two days, no session is running in it and its session record still exists
- **THEN** it does not appear in the Open work list, and its card's badge is still highlighted as stale

#### Scenario: Archive worktree of an archived change
- **WHEN** the archive worktree of a change that is already archived holds a commit that is not pushed and no session runs in it
- **THEN** it does not appear in the Open work list

#### Scenario: Opening an entry
- **WHEN** the user activates the entry of a running session that is not shown in the dock
- **THEN** its panel is shown as if its tab had been selected, and the list closes

#### Scenario: Nothing open
- **WHEN** worktrees with uncommitted, unpushed, pushed or merged work exist but no session is running
- **THEN** the top bar shows no Open work control
