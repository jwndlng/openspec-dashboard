## ADDED Requirements

### Requirement: Cards show the work status of their change's worktree
When agent sessions apply to a card's repository and a session worktree exists for its change, the card SHALL show a work-status badge as text plus colour — the number of uncommitted files, the number of commits not pushed, `pushed`, or `merged` — also when no session is running, next to the running session's badge if there is one. Nothing is shown for `clean` or `missing`. Open work whose last activity is older than 24 hours (`uncommitted`, `unpushed`) or 7 days (`pushed`), with no session running, SHALL be highlighted as stale with its age. The badge of `merged` SHALL state that this is as of the last fetch and that the worktree can be removed. Activating the badge opens the session panel of the worktree's most recent session.

#### Scenario: Ended session with uncommitted work
- **WHEN** a change's session has ended cleanly and its worktree holds 3 uncommitted files
- **THEN** the card shows "3 uncommitted" and activating it opens that session's panel

#### Scenario: Stale
- **WHEN** a worktree has had unpushed commits for two days and no session is running
- **THEN** the badge is highlighted and says so

### Requirement: Open work list
While agent sessions are enabled the top bar SHALL show an "Open work" control with the number of worktrees whose status is `uncommitted`, `unpushed` or `pushed`; it is hidden when there is no such worktree and none that is `merged`. Opening it SHALL list those worktrees and the `merged` ones across all repositories — including worktrees of archived or vanished changes and worktrees without a session record — with repository, change, branch, status and age, stale entries first. An entry with a session SHALL open its panel; an entry without one SHALL offer copying a `cd` command and, after confirmation, removal when that is safe.

#### Scenario: Archive worktree of an archived change
- **WHEN** the archive worktree of a change that is already archived holds a commit that is not pushed
- **THEN** it appears in the Open work list although no card offers it

#### Scenario: Nothing open
- **WHEN** no session worktree exists
- **THEN** the top bar shows no Open work control

### Requirement: The session panel shows work status and offers Ship
The session panel SHALL show the work status of the session's worktree and a Ship button while that status is `uncommitted`, `unpushed` or `pushed`, naming what it will do. For `merged` the panel SHALL suggest removing the worktree, and the clean-up dialog SHALL preselect removal.

#### Scenario: Ship from the panel
- **WHEN** the user presses Ship on an ended session with uncommitted work
- **THEN** the agent starts in the terminal with the Ship prompt

#### Scenario: Merged
- **WHEN** the panel is opened for a session whose worktree is `merged`
- **THEN** Ship is not offered and removal of the worktree is suggested
