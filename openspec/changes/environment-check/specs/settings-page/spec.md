# Spec Delta

## MODIFIED Requirements

### Requirement: Settings is one page made of named sections
The Settings page SHALL present all settings on a single page as an ordered list of sections, each with a stable identifier and a label: Workspace roots (`roots`), Tracked repositories (`tracked`), Discovered (`discovered`), Scanning (`scanning`), Agent sessions (`agents`), Shared OpenSpec config (`shared-config`) and Environment (`environment`). Environment SHALL be the last section: it reports on the machine rather than configuring anything, and it is where the environment indicator outside Settings links to. All sections that apply SHALL be rendered at the same time; navigating between them MUST NOT unmount a section, discard unsaved edits, or change what the save bar and the "unsaved changes" indicator cover. The navigation and the sections SHALL be produced from the same list, so that every section shown has exactly one navigation entry and every navigation entry has a section.

#### Scenario: Unsaved edits survive navigation
- **WHEN** the user changes the poll interval without saving and then uses the navigation to go to Workspace roots and back to Scanning
- **THEN** the edited value is still in the field and the save bar still shows "unsaved changes"

#### Scenario: A section that is not available has no entry
- **WHEN** the configuration has not loaded yet, so the Shared OpenSpec config section is not rendered
- **THEN** the navigation has no Shared OpenSpec config entry, and it gains one when the section appears

#### Scenario: Find in page covers everything
- **WHEN** the user searches the page for a repository name with the browser's find function while at the top of Settings
- **THEN** matches in any section are found, because all sections are present in the page

#### Scenario: Environment comes last
- **WHEN** Settings is opened
- **THEN** the last navigation entry and the last section are Environment, and the first section is still Workspace roots

#### Scenario: Environment does not join the draft
- **WHEN** the user opens the Environment section and asks for a fresh report without editing anything else
- **THEN** the save bar shows no unsaved changes

### Requirement: Navigation entries show counts that matter
The "Tracked repositories" entry SHALL show the number of enabled and the total number of tracked repositories in the current draft. The "Discovered" entry SHALL show the number of discovered repositories that are not tracked, SHALL be visually emphasised when that number is greater than zero, and SHALL show a pending indicator instead of a number while discovery is running. The "Environment" entry SHALL show the number of checks in the latest report whose status is neither `ok` nor `not-needed`, SHALL be visually emphasised when that number is greater than zero, and SHALL show a pending indicator instead of a number while the report is being computed and nothing instead of a number when no report could be loaded. Emphasis MUST NOT rely on colour alone. The counts SHALL always equal the numbers shown in the corresponding section headings.

#### Scenario: New repositories to enable
- **WHEN** discovery finds 3 repositories that are not tracked
- **THEN** the "Discovered" entry shows `3` and is emphasised, and the Discovered section heading also says 3 not tracked

#### Scenario: Counts follow the draft
- **WHEN** the user enables one of those repositories without saving
- **THEN** the "Discovered" entry shows `2` and the "Tracked repositories" entry's total increases by one

#### Scenario: Nothing to enable
- **WHEN** no untracked repositories are found
- **THEN** the "Discovered" entry shows `0` without emphasis

#### Scenario: Two environment problems
- **WHEN** the latest report has one `problem`, one `warning` and the rest `ok` or `not-needed`
- **THEN** the "Environment" entry shows `2` and is emphasised, and the Environment section heading says the same number

#### Scenario: A healthy environment
- **WHEN** every check in the latest report is `ok` or `not-needed`
- **THEN** the "Environment" entry shows `0` without emphasis
