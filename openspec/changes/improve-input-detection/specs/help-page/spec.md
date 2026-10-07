## MODIFIED Requirements

### Requirement: Help covers the dashboard's main topics in sections
The Help view SHALL present its guidance as an ordered list of sections, each with a stable identifier and a heading,
and a list of the sections at its start whose entries are real links to them. It SHALL cover at least: getting
started (adding a workspace root, enabling discovered projects, integrating a repository without OpenSpec, creating a
change), the board (each column and what moves a change into it, filters, the change detail view), agent sessions
(starting, the console, the worktree a session works in, Ship and Resolve conflicts, ending a session — and that the
feature is off by default — what a session's status badge can and cannot know, and how an agent can report that it is
waiting or working through `SPEC_CONTROL_STATE_FILE`), keeping repositories current (pull, cleanup, dismissing a
change), pull requests and the GitHub CLI it relies on, what the dashboard writes and where (its own home folder, and
the enumerated actions that touch a repository, each only on the user's action), and troubleshooting through the
Environment section of Settings. Where a section describes a view or a settings section, it SHALL link to it in the
app.

#### Scenario: Section list
- **WHEN** the Help view is shown
- **THEN** a list of every section is at its start and activating an entry brings that section to the top

#### Scenario: Link into the app
- **WHEN** the user activates the link to the Environment section in the troubleshooting section
- **THEN** Settings opens at its Environment section

#### Scenario: Reporting state is explained
- **WHEN** the user reads the agent-sessions section of Help
- **THEN** it says that the badge is a guess from the terminal's silence unless the agent reports its state, names the
  `SPEC_CONTROL_STATE_FILE` variable and the two words `waiting` and `working`, and shows a one-line shell command an
  agent's own hook can run to write one of them
