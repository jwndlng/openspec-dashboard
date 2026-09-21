## ADDED Requirements

### Requirement: Settings is one page made of named sections
The Settings page SHALL present all settings on a single page as an ordered list of sections, each with a stable identifier and a label: Workspace roots (`roots`), Tracked repositories (`tracked`), Discovered (`discovered`), Scanning (`scanning`), Agent sessions (`agents`) and Shared OpenSpec config (`shared-config`). All sections that apply SHALL be rendered at the same time; navigating between them MUST NOT unmount a section, discard unsaved edits, or change what the save bar and the "unsaved changes" indicator cover. The navigation and the sections SHALL be produced from the same list, so that every section shown has exactly one navigation entry and every navigation entry has a section.

#### Scenario: Unsaved edits survive navigation
- **WHEN** the user changes the poll interval without saving and then uses the navigation to go to Workspace roots and back to Scanning
- **THEN** the edited value is still in the field and the save bar still shows "unsaved changes"

#### Scenario: A section that is not available has no entry
- **WHEN** the configuration has not loaded yet, so the Shared OpenSpec config section is not rendered
- **THEN** the navigation has no Shared OpenSpec config entry, and it gains one when the section appears

#### Scenario: Find in page covers everything
- **WHEN** the user searches the page for a repository name with the browser's find function while at the top of Settings
- **THEN** matches in any section are found, because all sections are present in the page

### Requirement: A section navigation is shown beside the sections
On viewports wider than 720px the Settings page SHALL show a navigation to the left of the sections, listing every section in page order. The navigation SHALL remain visible while the sections are scrolled. Activating an entry SHALL bring the start of that section to the top of the visible area and move keyboard focus to that section, so that the next Tab press reaches the section's first control. Scrolling SHALL be animated only when the user has not requested reduced motion. The save bar SHALL remain visible and unchanged.

#### Scenario: Jump to a section below the fold
- **WHEN** 17 repositories are tracked, the user is at the top of Settings and activates the "Scanning" entry
- **THEN** the Scanning section is scrolled to the top of the visible area and the navigation is still visible

#### Scenario: Keyboard use
- **WHEN** the user tabs to the "Discovered" entry, presses Enter, and then presses Tab
- **THEN** focus is on the first interactive control inside the Discovered section

#### Scenario: Reduced motion
- **WHEN** the operating system requests reduced motion and the user activates an entry
- **THEN** the section is shown immediately without a scrolling animation

### Requirement: The navigation shows which section is in view
The navigation SHALL mark exactly one entry as current: the section occupying the top of the visible area, or the last section when the page is scrolled to its end. The current entry SHALL be distinguishable by more than colour and SHALL be exposed to assistive technology as the current item. When the user activates an entry, that entry SHALL become current immediately and remain so until the resulting scroll has finished.

#### Scenario: Highlight follows scrolling
- **WHEN** the user scrolls from the top of Settings until the Tracked repositories section reaches the top of the visible area
- **THEN** the current entry changes from "Workspace roots" to "Tracked repositories"

#### Scenario: Short last sections can become current
- **WHEN** the user scrolls to the very end of Settings
- **THEN** the last section's entry is current, even if that section is too short to reach the top of the visible area

#### Scenario: No flicker on jump
- **WHEN** the user is at the top and activates the last entry
- **THEN** the last entry is current throughout the scroll, without intermediate entries becoming current

### Requirement: Navigation entries show counts that matter
The "Tracked repositories" entry SHALL show the number of enabled and the total number of tracked repositories in the current draft. The "Discovered" entry SHALL show the number of discovered repositories that are not tracked, SHALL be visually emphasised when that number is greater than zero, and SHALL show a pending indicator instead of a number while discovery is running. Emphasis MUST NOT rely on colour alone. The counts SHALL always equal the numbers shown in the corresponding section headings.

#### Scenario: New repositories to enable
- **WHEN** discovery finds 3 repositories that are not tracked
- **THEN** the "Discovered" entry shows `3` and is emphasised, and the Discovered section heading also says 3 not tracked

#### Scenario: Counts follow the draft
- **WHEN** the user enables one of those repositories without saving
- **THEN** the "Discovered" entry shows `2` and the "Tracked repositories" entry's total increases by one

#### Scenario: Nothing to enable
- **WHEN** no untracked repositories are found
- **THEN** the "Discovered" entry shows `0` without emphasis

### Requirement: Sections can be linked to
The current section SHALL be reflected in the URL as the query parameter `section` holding the section identifier, updated without adding browser history entries and without discarding other query parameters. Opening Settings with a valid `section` parameter SHALL show that section at the top of the visible area once it is available; an unknown identifier SHALL be ignored and Settings SHALL open at the top. This SHALL work the same in the locally served dashboard and in the demo build, whose route is carried in the URL fragment. Navigation entries SHALL be real links that can be opened in a new tab.

#### Scenario: Deep link on the dashboard
- **WHEN** the user opens `/settings?section=discovered`
- **THEN** Settings opens with the Discovered section at the top of the visible area and its entry current

#### Scenario: Deep link in the demo
- **WHEN** the user opens the demo at `index.html?section=agents#/settings`
- **THEN** Settings opens at the Agent sessions section

#### Scenario: Back button is not polluted
- **WHEN** the user opens Settings from the board, scrolls through four sections, and presses the browser's back button once
- **THEN** the board is shown

#### Scenario: Unknown section
- **WHEN** the user opens `/settings?section=nope`
- **THEN** Settings opens at the top with "Workspace roots" current

### Requirement: The navigation adapts to narrow screens
On viewports of 720px width or less, the navigation SHALL be shown as a single horizontally scrollable row above the sections instead of a left column, SHALL remain visible while the sections scroll, and SHALL keep the current entry scrolled into view within that row. All other navigation behaviour SHALL be the same as on wide viewports.

#### Scenario: Phone-width layout
- **WHEN** Settings is shown in a 400px wide viewport
- **THEN** the sections use the full width, the navigation is a row above them that can be scrolled sideways, and activating an entry still jumps to its section

#### Scenario: Current entry stays visible in the row
- **WHEN** the user scrolls down to the last section on a narrow viewport
- **THEN** the navigation row scrolls so that the last entry, marked current, is visible
