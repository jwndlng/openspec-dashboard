## MODIFIED Requirements

### Requirement: Settings is one page made of named sections
The Settings page SHALL present all settings on a single page as an ordered list of sections, each with a stable identifier and a label: Workspace roots (`roots`), Scanning (`scanning`), Agent sessions (`agents`), Shared OpenSpec config (`shared-config`) and Environment (`environment`). Settings SHALL NOT manage repositories one by one: discovered, integratable, tracked and disabled repositories, their names and their per-repository agent settings are all on the projects overview. The Shared OpenSpec config section still lists tracked repositories, but only to preview and apply profiles to them. Environment SHALL be the last section: it reports on the machine rather than configuring anything, and it is where the environment indicator outside Settings links to. All sections that apply SHALL be rendered at the same time; navigating between them MUST NOT unmount a section, discard unsaved edits, or change what the save bar and the "unsaved changes" indicator cover. The navigation and the sections SHALL be produced from the same list, so that every section shown has exactly one navigation entry and every navigation entry has a section. Opening Settings with a `section` parameter naming a section that no longer exists (`tracked`, `discovered`, `integratable`) SHALL behave like any unknown identifier. Saving Settings MUST NOT change any repository's name, `enabled` state or agent-session settings: it keeps them as the dashboard last received them, including changes made on the overview after Settings was opened with unsaved edits.

#### Scenario: Unsaved edits survive navigation
- **WHEN** the user changes the poll interval without saving and then uses the navigation to go to Workspace roots and back to Scanning
- **THEN** the edited value is still in the field and the save bar still shows "unsaved changes"

#### Scenario: A section that is not available has no entry
- **WHEN** the configuration has not loaded yet, so the Shared OpenSpec config section is not rendered
- **THEN** the navigation has no Shared OpenSpec config entry, and it gains one when the section appears

#### Scenario: Find in page covers everything
- **WHEN** the user searches the page for a workspace root with the browser's find function while at the top of Settings
- **THEN** matches in any section are found, because all sections are present in the page

#### Scenario: Environment comes last
- **WHEN** Settings is opened
- **THEN** the last navigation entry and the last section are Environment, and the first section is still Workspace roots

#### Scenario: Environment does not join the draft
- **WHEN** the user opens the Environment section and asks for a fresh report without editing anything else
- **THEN** the save bar shows no unsaved changes

#### Scenario: No discovered section
- **WHEN** Settings is opened
- **THEN** neither the navigation nor the page has a Tracked repositories, Discovered or Without OpenSpec section

#### Scenario: An old deep link
- **WHEN** the user opens `/settings?section=tracked`
- **THEN** Settings opens at the top

#### Scenario: Saving does not undo the overview
- **WHEN** the user edits the poll interval in Settings without saving, goes to the overview, renames `beta-soc`, returns to Settings and saves
- **THEN** the saved config has the new poll interval and `beta-soc` keeps its new name

### Requirement: The navigation shows which section is in view
The navigation SHALL mark exactly one entry as current: the section occupying the top of the visible area, or the last section when the page is scrolled to its end. The current entry SHALL be distinguishable by more than colour and SHALL be exposed to assistive technology as the current item. When the user activates an entry, that entry SHALL become current immediately and remain so until the resulting scroll has finished.

#### Scenario: Highlight follows scrolling
- **WHEN** the user scrolls from the top of Settings until the Scanning section reaches the top of the visible area
- **THEN** the current entry changes from "Workspace roots" to "Scanning"

#### Scenario: Short last sections can become current
- **WHEN** the user scrolls to the very end of Settings
- **THEN** the last section's entry is current, even if that section is too short to reach the top of the visible area

#### Scenario: No flicker on jump
- **WHEN** the user is at the top and activates the last entry
- **THEN** the last entry is current throughout the scroll, without intermediate entries becoming current

### Requirement: Navigation entries show counts that matter
The "Environment" entry SHALL show the number of checks in the latest report whose status is neither `ok` nor `not-needed`, SHALL be visually emphasised when that number is greater than zero, and SHALL show a pending indicator instead of a number while the report is being computed and nothing instead of a number when no report could be loaded. No other entry SHALL show a count. Emphasis MUST NOT rely on colour alone. The count SHALL always equal the number shown in the Environment section heading.

#### Scenario: New repositories to enable
- **WHEN** discovery finds 3 repositories that are not tracked
- **THEN** no navigation entry counts them; the Workspace roots section states that 3 untracked repositories were found and links to the projects overview

#### Scenario: Nothing to enable
- **WHEN** no untracked repositories are found
- **THEN** the Workspace roots section says that none were found and no navigation entry is emphasised because of discovery

#### Scenario: Counts follow the draft
- **WHEN** the user switches agent sessions on and changes the poll interval without saving
- **THEN** no navigation entry gains a count, and the "Environment" entry's count is unchanged

#### Scenario: Two environment problems
- **WHEN** the latest report has one `problem`, one `warning` and the rest `ok` or `not-needed`
- **THEN** the "Environment" entry shows `2` and is emphasised, and the Environment section heading says the same number

#### Scenario: A healthy environment
- **WHEN** every check in the latest report is `ok` or `not-needed`
- **THEN** the "Environment" entry shows `0` without emphasis
