# settings-page Specification

## Purpose
Defines the structure of the Settings page: the list of sections, the section navigation (jumping, current-section highlight, counts, keyboard and screen-reader behaviour), section deep links, the single-page/single-draft rule and the narrow-screen layout. What the individual panels do is defined by `repo-discovery`, `shared-config` and `agent-sessions`.

## Requirements

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
On viewports wider than 720px the Settings page SHALL show a navigation to the left of the sections, listing every section in page order and starting level with the first section. Settings SHALL scroll as one page: the navigation and the sections SHALL share a single scroll area that spans the full width below the top bar, so that scrolling works wherever the pointer is. The navigation SHALL move along with the content beside the current section: while the current section's start is in view the navigation SHALL be level with it; once that start has scrolled above the view, the navigation SHALL stay in view level with the top of the visible area until it reaches the end of that section, with which it then moves; it SHALL never extend below the last section. When the current section changes the navigation SHALL glide to its new place; while scrolling within one section it SHALL keep pace with the content without lagging behind. It SHALL NOT be pinned to the top of the page independently of the sections. Activating an entry SHALL bring the start of that section to the top of the visible area and move keyboard focus to that section, so that the next Tab press reaches the section's first control. When the page is scrolled back to its very top, the navigation SHALL be visible again, level with the first section. Scrolling SHALL be animated only when the user has not requested reduced motion. The save bar SHALL remain visible and unchanged.

#### Scenario: Jump to a section below the fold
- **WHEN** 17 repositories are tracked, the user is at the top of Settings and activates the "Scanning" entry
- **THEN** the Scanning section is scrolled to the top of the visible area and the navigation is level with it

#### Scenario: The navigation moves along to the next section
- **WHEN** the user scrolls Settings down by hand until "Discovered" becomes the current section
- **THEN** the navigation has glided to be level with the start of the Discovered section

#### Scenario: A section taller than the window
- **WHEN** the current section is taller than the visible area and the user scrolls further down inside it
- **THEN** the navigation stays in view at the top of the visible area, and when the end of that section reaches it, it moves up together with that end

#### Scenario: The last section
- **WHEN** the user scrolls to the end of Settings and the last section is shorter than the navigation
- **THEN** the navigation ends with the page and does not extend below the last section

#### Scenario: Back at the top
- **WHEN** the user has jumped to "Agent sessions" and scrolls back to the very top of Settings
- **THEN** the navigation is level with the first section

#### Scenario: Deep link
- **WHEN** the user opens Settings with `section=agents`
- **THEN** the Agent sessions section is at the top of the visible area and the navigation is level with it

#### Scenario: Scrolling works anywhere on the page
- **WHEN** the pointer is over the navigation or over the empty margin beside the sections and the user turns the mouse wheel
- **THEN** the Settings page scrolls exactly as it does with the pointer over a section

#### Scenario: Keyboard use
- **WHEN** the user tabs to the "Discovered" entry, presses Enter, and then presses Tab
- **THEN** focus is on the first interactive control inside the Discovered section

#### Scenario: Reduced motion
- **WHEN** the operating system requests reduced motion and the user activates an entry
- **THEN** the section is shown immediately without a scrolling animation and the navigation is placed beside it without gliding

#### Scenario: Save bar stays
- **WHEN** the user scrolls to the end of Settings with unsaved changes
- **THEN** the save bar with "unsaved changes" is still visible at the bottom

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
On viewports of 720px width or less, the navigation SHALL be shown as a single horizontally scrollable row above the sections instead of a left column, and SHALL scroll away with the sections; unlike the wide navigation it SHALL NOT be moved along, pinned or sticky, and it MUST NOT cover any section. The keyboard focus order SHALL remain navigation first, then the sections in page order. The row SHALL keep the current entry within its visible part by scrolling the row sideways only, and every visible entry SHALL be activatable however far the row has been scrolled sideways. Updating the current entry MUST NOT scroll the page. All other navigation behaviour SHALL be the same as on wide viewports.

#### Scenario: Phone-width layout
- **WHEN** Settings is shown in a 400px wide viewport
- **THEN** the sections use the full width, the navigation is a row above them that can be scrolled sideways, and activating an entry still jumps to its section

#### Scenario: Jump on a narrow viewport
- **WHEN** the user activates "Scanning" in a 400px wide viewport
- **THEN** the Scanning section is at the top of the visible area and no section content is hidden behind the row

#### Scenario: The row scrolls away
- **WHEN** the user scrolls down on a narrow viewport until the third section is at the top
- **THEN** the navigation row has scrolled out of view above it

#### Scenario: Marker updates never move the page
- **WHEN** the user keeps scrolling down through three sections
- **THEN** the page position changes only by the user's scrolling, the URL's `section` parameter follows the section in view, and the page is never pulled back

#### Scenario: Current entry stays visible in the row
- **WHEN** the user has scrolled to the last section on a narrow viewport and scrolls back up until the row is in view
- **THEN** the row shows the entry that is current without the user having to scroll the row sideways, and clicking any visible entry jumps to its section
