## MODIFIED Requirements

### Requirement: The sample showcases the dashboard and stays fresh
The sample SHALL contain at least five repositories and enough changes that every board column has at least one card, including a change with a branch match, a change with the "no tasks" warning, a change with a load warning, a repository whose scan failed, and more than 25 archived changes. Column and stage of each sample change SHALL be derived by the same rules the scanner uses. The sample SHALL also show, on first load and without any action by the visitor: agent sessions in every state the UI distinguishes (running with recent output, running but quiet, ended, failed to start); session worktrees in every work status (`uncommitted`, `unpushed`, `pushed`, `merged`, `clean`), including one that is stale and one whose session record is gone; and shared-config profiles carried by several repositories, at least one of them `outdated`. Sessions, their worktrees and their branches SHALL refer to changes, paths and branches that exist in the sample. All dates in the sample, including session start, last output and work-status ages, SHALL be expressed relative to the moment the demo loads, so relative ages do not grow as the published demo gets older.

#### Scenario: Every column is populated
- **WHEN** the combined board of the demo is shown with no filters
- **THEN** every column has at least one card and `Archived` shows `25 of <total>`

#### Scenario: Ages do not drift
- **WHEN** the demo is opened six months after it was built
- **THEN** a change defined as "3 days old" still shows `3d ago`

#### Scenario: Work in progress is visible at first sight
- **WHEN** the demo is opened and nothing has been clicked
- **THEN** at least one card shows a running session, the detail views of changes with session worktrees show work-status badges for uncommitted, unpushed, pushed and merged work, the top bar shows "Open work" with a count, and Projects shows repositories carrying shared-config profiles with one marked outdated

#### Scenario: Session data matches the board
- **WHEN** the test suite inspects the seeded sessions
- **THEN** every session's repository, change, branch and worktree path exist in the sample snapshot

#### Scenario: Session times do not drift
- **WHEN** the demo is opened six months after it was built
- **THEN** the session defined as "quiet for 12 minutes" still reads as quiet for 12 minutes and the stale worktree is still two days stale
