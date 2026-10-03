# help-page Specification

## Purpose
Gives users built-in guidance and documentation inside the dashboard — how to get started, what the board and its actions mean, and what the dashboard does and does not change — without leaving the app or using the network.

## Requirements

### Requirement: Help is a view of its own in the main navigation
The dashboard SHALL have a Help view at the route `/help` (`#/help` in the demo build), reached from a **Help** tab
with an icon, placed last in the main navigation and marked current while the view is shown. The view SHALL open with
the same hero as every other view.

#### Scenario: Open Help
- **WHEN** the user activates the **Help** tab
- **THEN** the URL is `/help`, the Help view is shown and the Help tab is marked current

#### Scenario: Reload Help
- **WHEN** the user reloads the page on `/help`
- **THEN** the Help view is shown again

### Requirement: Help covers the dashboard's main topics in sections
The Help view SHALL present its guidance as an ordered list of sections, each with a stable identifier and a heading,
and a list of the sections at its start whose entries are real links to them. It SHALL cover at least: getting
started (adding a workspace root, enabling discovered projects, integrating a repository without OpenSpec, creating a
change), the board (each column and what moves a change into it, filters, the change detail view), agent sessions
(starting, the console, the worktree a session works in, Ship and Resolve conflicts, ending a session — and that the
feature is off by default), keeping repositories current (pull, cleanup, dismissing a change), pull requests and the
GitHub CLI it relies on, what the dashboard writes and where (its own home folder, and the enumerated actions that
touch a repository, each only on the user's action), and troubleshooting through the Environment section of
Settings. Where a section describes a view or a settings section, it SHALL link to it in the app.

#### Scenario: Section list
- **WHEN** the Help view is shown
- **THEN** a list of every section is at its start and activating an entry brings that section to the top

#### Scenario: Link into the app
- **WHEN** the user activates the link to the Environment section in the troubleshooting section
- **THEN** Settings opens at its Environment section

### Requirement: Help sections can be linked
The section shown at the top SHALL be reflected in the URL as the query parameter `section` holding the section
identifier, updated without adding browser history entries. Opening Help with a valid `section` SHALL show that
section at the top; an unknown identifier SHALL be ignored and Help SHALL open at its start. This SHALL work the same
in the demo build.

#### Scenario: Deep link
- **WHEN** the user opens `/help?section=board`
- **THEN** the board section is shown at the top of the visible area

#### Scenario: Unknown section
- **WHEN** the user opens `/help?section=nope`
- **THEN** Help opens at its start without an error

### Requirement: Every board column is explained
The board section SHALL explain every column the board can show, by the column's own name, including `Unknown`. A
column added to the board without an explanation in Help SHALL fail the build's checks.

#### Scenario: All columns
- **WHEN** the board section is shown
- **THEN** it explains Backlog, Drafts, Unknown, Ready, Implementing, Done and Archived

### Requirement: Help is built in and makes no requests
The Help view's text SHALL be part of the UI bundle and SHALL be shown without any API request, network request or
file read, including when the server is unreachable. Help SHALL NOT load images, fonts, scripts or styles from
another host. Links that leave the app — at most to the project's own repository — SHALL be links the user follows,
not requests the page makes. Help text SHALL use only made-up names and paths in examples and SHALL NOT contain a
real user's home directory, host name or e-mail address.

#### Scenario: Server down
- **WHEN** the API is unreachable and the user opens Help
- **THEN** the Help text is shown in full

### Requirement: Help offers the tour
The Help view SHALL offer **Take the tour** near its start, which starts the onboarding tour from its first step.

#### Scenario: Take the tour
- **WHEN** the user activates **Take the tour**
- **THEN** the onboarding tour starts at its first step
