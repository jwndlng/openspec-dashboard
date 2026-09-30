# Spec Delta

## MODIFIED Requirements

### Requirement: The console is a tab of the detail view
Whenever agent sessions apply to the change's repository — agent sessions on and the repository not excluded — the
detail view SHALL offer a **Console** tab beside the artifact tabs, after them, as the last tab of the strip, whether or
not the change has ever had a session. The tab SHALL be selectable whenever it is offered, whatever state the change's
artifacts are in, and MUST NOT carry an artifact state label.

Selecting it SHALL show the selected session's terminal — what the agent printed, as it printed it, with what the
terminal has shown so far before it follows live — together with the session's change, repository, agent, worktree path
and branch, its state, its default responses and its actions: End session or Clean up, Resume when available, Delete
record for an ended session, and "Copy cd" for the worktree. The terminal SHALL be coloured from the dashboard's theme
tokens and SHALL load nothing from the network. It SHALL follow the size of the panel, and SHALL be the part of the
overlay that scrolls, so the page behind it does not move.

With no session to show the tab SHALL say why and leave the user something to do: for a change whose session worktree
has outlived its session record, that there is no terminal to show while its work is still there, with the worktree's
path and a `cd` to copy; for a change that has neither a session nor a session worktree, that no agent has worked on it
yet, together with the starters its stage allows. Neither state SHALL show a terminal, and neither MUST be reported as
an error.

When agent sessions are off for the repository, or the repository is excluded from them, no Console tab SHALL be shown
and the detail view MUST look and behave as it did before.

#### Scenario: A change with a session
- **WHEN** the user opens the detail view of a change whose Implement session is running
- **THEN** the tab strip shows `Proposal`, `Design`, `Specs`, `Tasks` and `Console`, and selecting `Console` shows that
  session's terminal with its earlier output, its worktree path and branch, and its actions

#### Scenario: Console is selectable while artifacts are not
- **WHEN** a change has a running session and no artifact file at all
- **THEN** every artifact tab is unselectable and the `Console` tab is selectable and shows the terminal

#### Scenario: A change no agent has worked on
- **WHEN** the user opens the Console tab of a change in `Ready` that has neither a session nor a session worktree
- **THEN** the tab says that no agent has worked on this change yet, offers **Implement**, shows no terminal and reports
  no error

#### Scenario: Starting from the empty console
- **WHEN** the user activates that **Implement** starter
- **THEN** a session starts for the change and the same Console tab shows its terminal

#### Scenario: A worktree without a session record
- **WHEN** the change's session record is gone and its worktree still holds uncommitted work
- **THEN** the Console tab says there is no terminal to show, names the worktree's path and offers a `cd` to copy

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no detail view shows a `Console` tab

#### Scenario: Long output scrolls in the terminal
- **WHEN** the agent has printed more than fits the panel
- **THEN** the output scrolls inside the terminal and the board behind the overlay does not move

### Requirement: Artifacts are browsable as tabs
The detail view SHALL show one tab per artifact of the change's schema, in the schema's artifact order, labelled with the artifact's display name, and — when agent sessions apply to the change's repository — the Console tab after them. Each artifact tab SHALL show the artifact's state (`done`, `ready` or `blocked`). An artifact tab whose artifact has no file yet SHALL NOT be selectable; selecting it SHALL be impossible and its state SHALL be readable from the tab.

An artifact that resolves to more than one file — the delta specs under `specs/**` — SHALL additionally show a list of its files, by path relative to the change directory, with the first file selected by default. Selecting a file SHALL show that file.

The selected tab and the selected file SHALL be part of the URL, so the view can be linked to and survives a reload. A URL naming an artifact or a file that does not exist SHALL fall back to the first artifact that has content, without an error; a URL naming the Console tab for a change whose repository agent sessions do not apply to SHALL fall back the same way.

#### Scenario: Tabs in schema order
- **WHEN** a `spec-driven` change has `proposal` and `specs` done, `design` ready and `tasks` blocked
- **THEN** the view shows the tabs `Proposal`, `Specs`, `Design`, `Tasks` in the schema's order, with `Design` and `Tasks` not selectable and labelled `ready` and `blocked`

#### Scenario: Console comes last
- **WHEN** that change's repository has agent sessions enabled
- **THEN** `Console` is shown after `Tasks` and carries no artifact state

#### Scenario: Delta specs file list
- **WHEN** the selected artifact is `specs` and the change has `specs/dashboard-api/spec.md` and `specs/kanban-board/spec.md`
- **THEN** both paths are listed, the first is selected, and selecting the second shows its content

#### Scenario: Selection is linkable
- **WHEN** the user selects the `specs` artifact and its file `specs/kanban-board/spec.md` and reloads the page
- **THEN** the same artifact and file are selected again

#### Scenario: Stale link
- **WHEN** a URL names an artifact or a file that the change does not have
- **THEN** the first artifact with content is shown and no error is reported

#### Scenario: Console in the URL with the feature off
- **WHEN** a URL names the Console tab for a change in a repository agent sessions do not apply to
- **THEN** the first artifact with content is shown and no error is reported

## ADDED Requirements

### Requirement: The console tab offers the change's next step
The Console tab SHALL be the place the dashboard offers a change's next step while its session runs. For the selected
session it SHALL offer the starters of the change's current stage whose prompt would go into that very session — Draft
and Implement for a session in the change's own worktree — labelled and described as sending the prompt to the running
session, and MUST NOT ask the user for a further key press. When the prompt was typed but not submitted, the tab SHALL
say so as it does for any other text sent on the user's behalf. Archive SHALL open its own session as before, and no
starter SHALL be offered for a session that a prompt cannot reach.

For a change with no session and no session worktree the tab SHALL offer the starters its stage allows as openings for
a new session, disabled with an explanation when the repository's agent is not found on this machine.

#### Scenario: Draft finished, Implement next
- **WHEN** a Draft session is still running, the change has moved to `Ready`, and its Console tab is open
- **THEN** the tab offers **Implement**, saying it sends the prompt to this session, and activating it types that prompt
  into the terminal without asking the user for another key press

#### Scenario: The prompt was not sent
- **WHEN** the next step is sent to a session whose agent never shows the typed prompt
- **THEN** the Console tab says that the text was typed but not sent, and the session keeps running

#### Scenario: Nothing a prompt can reach
- **WHEN** the selected session is the change's Archive session
- **THEN** the tab offers no next-step starter for it

#### Scenario: The agent is missing
- **WHEN** a change has no session and the repository's agent executable is not found
- **THEN** the Console tab's starters are disabled and say that the agent was not found
