## MODIFIED Requirements

### Requirement: Settings is one page made of named sections
The Settings page SHALL present all settings on a single page as an ordered list of sections, each with a stable identifier and a label: Workspace roots (`roots`), Tracked repositories (`tracked`), Scanning (`scanning`), Agent sessions (`agents`), Shared OpenSpec config (`shared-config`) and Environment (`environment`). Discovered and integratable repositories are not a section of Settings: they are listed on the projects overview. Environment SHALL be the last section: it reports on the machine rather than configuring anything, and it is where the environment indicator outside Settings links to. All sections that apply SHALL be rendered at the same time; navigating between them MUST NOT unmount a section, discard unsaved edits, or change what the save bar and the "unsaved changes" indicator cover. The navigation and the sections SHALL be produced from the same list, so that every section shown has exactly one navigation entry and every navigation entry has a section. Opening Settings with a `section` parameter naming a section that no longer exists (`discovered`, `integratable`) SHALL behave like any unknown identifier.

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

#### Scenario: No discovered section
- **WHEN** Settings is opened
- **THEN** neither the navigation nor the page has a Discovered or Without OpenSpec section

#### Scenario: An old deep link
- **WHEN** the user opens `/settings?section=discovered`
- **THEN** Settings opens at the top

### Requirement: Navigation entries show counts that matter
The "Tracked repositories" entry SHALL show the number of enabled and the total number of tracked repositories in the current draft. The "Environment" entry SHALL show the number of checks in the latest report whose status is neither `ok` nor `not-needed`, SHALL be visually emphasised when that number is greater than zero, and SHALL show a pending indicator instead of a number while the report is being computed and nothing instead of a number when no report could be loaded. Emphasis MUST NOT rely on colour alone. The counts SHALL always equal the numbers shown in the corresponding section headings.

#### Scenario: New repositories to enable
- **WHEN** discovery finds 3 repositories that are not tracked
- **THEN** no navigation entry counts them; the Workspace roots section states that 3 untracked repositories were found and links to the projects overview

#### Scenario: Nothing to enable
- **WHEN** no untracked repositories are found
- **THEN** the Workspace roots section says that none were found and no navigation entry is emphasised because of discovery

#### Scenario: Counts follow the draft
- **WHEN** the user ticks a disabled tracked repository without saving
- **THEN** the "Tracked repositories" entry's enabled number increases by one and its total is unchanged

#### Scenario: Two environment problems
- **WHEN** the latest report has one `problem`, one `warning` and the rest `ok` or `not-needed`
- **THEN** the "Environment" entry shows `2` and is emphasised, and the Environment section heading says the same number

#### Scenario: A healthy environment
- **WHEN** every check in the latest report is `ok` or `not-needed`
- **THEN** the "Environment" entry shows `0` without emphasis
