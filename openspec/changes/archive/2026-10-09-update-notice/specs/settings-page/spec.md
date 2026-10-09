# Spec Delta

## MODIFIED Requirements

### Requirement: Settings is one page made of named sections
The Settings page SHALL present all settings on a single page as an ordered list of sections, each with a stable identifier and a label: Workspace roots (`roots`), Scanning (`scanning`), Agent sessions (`agents`), Shared OpenSpec config (`shared-config`), Updates (`updates`) and Environment (`environment`). Settings SHALL NOT manage repositories one by one: discovered, integratable, tracked and disabled repositories, their names and their per-repository agent settings are all on the projects overview. The Shared OpenSpec config section still lists tracked repositories, but only to preview and apply profiles to them. Environment SHALL be the last section: it reports on the machine rather than configuring anything, and it is where the environment indicator outside Settings links to. All sections that apply SHALL be rendered at the same time; navigating between them MUST NOT unmount a section, discard unsaved edits, or change what the save bar and the "unsaved changes" indicator cover. The navigation and the sections SHALL be produced from the same list, so that every section shown has exactly one navigation entry and every navigation entry has a section. Opening Settings with a `section` parameter naming a section that no longer exists (`tracked`, `discovered`, `integratable`) SHALL behave like any unknown identifier. Saving Settings MUST NOT change any repository's name, `enabled` state or agent-session settings: it keeps them as the dashboard last received them, including changes made on the overview after Settings was opened with unsaved edits.

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

#### Scenario: Updates comes before Environment
- **WHEN** Settings is opened
- **THEN** Updates is the second-to-last navigation entry and section, directly before Environment

#### Scenario: Deep link to Updates
- **WHEN** the user opens `/settings?section=updates`
- **THEN** Settings opens with the Updates section at the top of the visible area and its entry current
