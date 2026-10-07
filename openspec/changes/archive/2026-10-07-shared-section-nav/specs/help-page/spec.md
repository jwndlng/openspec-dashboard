# Spec Delta

## MODIFIED Requirements

### Requirement: Help covers the dashboard's main topics in sections
The Help view SHALL present its guidance as an ordered list of sections, each with a stable identifier and a heading,
and a section navigation whose entries are real links to them. It SHALL cover at least: getting
started (adding a workspace root, enabling discovered projects, integrating a repository without OpenSpec, creating a
change), the board (each column and what moves a change into it, filters, the change detail view), agent sessions
(starting, the console, the worktree a session works in, Ship and Resolve conflicts, ending a session — and that the
feature is off by default), keeping repositories current (pull, cleanup, dismissing a change), pull requests and the
GitHub CLI it relies on, what the dashboard writes and where (its own home folder, and the enumerated actions that
touch a repository, each only on the user's action), and troubleshooting through the Environment section of
Settings. Where a section describes a view or a settings section, it SHALL link to it in the app.

#### Scenario: Section list
- **WHEN** the Help view is shown
- **THEN** a navigation lists every section and activating an entry brings that section to the top

#### Scenario: Link into the app
- **WHEN** the user activates the link to the Environment section in the troubleshooting section
- **THEN** Settings opens at its Environment section

## ADDED Requirements

### Requirement: Help navigates its sections like Settings
The Help view SHALL use the same section navigation as the Settings page, with the same behaviour: on viewports wider
than 720px a navigation to the left of the sections, listing every section in page order, starting level with the
first section and moving along beside the section at the top of the visible area as Settings' does (`settings-page`,
"A section navigation is shown beside the sections"), in one scroll area with the sections; on viewports of 720px or
less a single horizontally scrollable row above the sections that scrolls away with them (`settings-page`, "The
navigation adapts to narrow screens"). It SHALL mark the current section as Settings' does (`settings-page`, "The
navigation shows which section is in view"), including the last section at the very end of the page. Its accessible
name SHALL name Help's sections. The Help introduction with **Take the tour** SHALL stay above the navigation and the
sections, across the full width. Its entries SHALL be real links to `/help` with that section, keeping every other
query parameter of the current URL. The Help text and its in-app links SHALL be unchanged.

#### Scenario: Wide layout
- **WHEN** Help is shown in a 1280px wide viewport and the user scrolls to the board section
- **THEN** the navigation is to the left of the sections, beside the board section, with "The board" marked current

#### Scenario: Narrow layout
- **WHEN** Help is shown in a 400px wide viewport
- **THEN** the sections use the full width and the navigation is a row above them that can be scrolled sideways and scrolls away with them

#### Scenario: Jump from the navigation
- **WHEN** the user activates the agent sessions entry and then presses Tab
- **THEN** the agent sessions section is at the top of the visible area, its entry is current, and focus is inside that section

#### Scenario: Deep link with other parameters
- **WHEN** the user opens Help with `section=board` and another query parameter
- **THEN** the board section is at the top of the visible area, and the navigation's links and the URL keep the other parameter

#### Scenario: The end of Help
- **WHEN** the user scrolls to the very end of Help
- **THEN** the last section's entry is current and the navigation does not move down to it
