# Spec Delta

## MODIFIED Requirements

### Requirement: The detail view follows the regular refresh
The detail view SHALL take the change's header information from the same snapshot the boards use and SHALL re-read the selected file's content whenever that snapshot is renewed, so that ticking a task or editing an artifact on disk becomes visible without a manual reload. That is the poll interval while auto-refresh is off, the auto-refresh interval while one is chosen, and a manual Refresh in either case: the detail view SHALL NOT keep a refresh cadence of its own. The selected artifact, the selected file, the raw toggle and the scroll position MUST NOT be reset by a refresh that does not change the content, however often the refresh happens.

#### Scenario: Task ticked on disk
- **WHEN** a task is ticked in the repository while the tasks artifact is shown
- **THEN** the checklist and the progress update on the next poll without a page reload

#### Scenario: Refresh keeps the view
- **WHEN** a poll returns unchanged content while the user is reading the third spec file
- **THEN** the same file stays selected and the view does not jump

#### Scenario: Artifact added on disk
- **WHEN** an artifact file is created in the repository while the detail view is open
- **THEN** its tab becomes selectable after the next scan

#### Scenario: The detail view follows auto-refresh
- **WHEN** auto-refresh is `2s`, the detail view is open, and a task is ticked in the repository
- **THEN** the checklist updates within about two seconds, without the user clicking Refresh

#### Scenario: A fast cadence does not disturb reading
- **WHEN** auto-refresh is `2s` and the user reads a long spec file that nobody is editing
- **THEN** the selected artifact, the selected file, the raw toggle and the scroll position stay exactly as the user left them across every refresh
