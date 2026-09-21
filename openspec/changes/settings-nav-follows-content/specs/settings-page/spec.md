## MODIFIED Requirements

### Requirement: A section navigation is shown beside the sections
On viewports wider than 720px the Settings page SHALL show a navigation to the left of the sections, listing every section in page order and starting level with the first section. Settings SHALL scroll as one page: the navigation and the sections SHALL share a single scroll area that spans the full width below the top bar, so that scrolling works wherever the pointer is, and the navigation SHALL move with the sections, scrolling out of view as the user scrolls down and back into view as the user scrolls up. Activating an entry SHALL bring the start of that section to the top of the visible area and move keyboard focus to that section, so that the next Tab press reaches the section's first control. Scrolling SHALL be animated only when the user has not requested reduced motion. The save bar SHALL remain visible and unchanged.

#### Scenario: Jump to a section below the fold
- **WHEN** 17 repositories are tracked, the user is at the top of Settings and activates the "Scanning" entry
- **THEN** the Scanning section is scrolled to the top of the visible area, and the navigation has scrolled out of view together with the sections above it

#### Scenario: The navigation moves with the content
- **WHEN** the user scrolls Settings down by the height of the navigation and then back to the top
- **THEN** the navigation leaves the visible area while scrolling down and is back at the top-left, level with the first section, after scrolling up

#### Scenario: Scrolling works anywhere on the page
- **WHEN** the pointer is over the navigation or over the empty margin beside the sections and the user turns the mouse wheel
- **THEN** the Settings page scrolls exactly as it does with the pointer over a section

#### Scenario: Keyboard use
- **WHEN** the user tabs to the "Discovered" entry, presses Enter, and then presses Tab
- **THEN** focus is on the first interactive control inside the Discovered section

#### Scenario: Reduced motion
- **WHEN** the operating system requests reduced motion and the user activates an entry
- **THEN** the section is shown immediately without a scrolling animation

#### Scenario: Save bar stays
- **WHEN** the user scrolls to the end of Settings with unsaved changes
- **THEN** the save bar with "unsaved changes" is still visible at the bottom

### Requirement: The navigation adapts to narrow screens
On viewports of 720px width or less, the navigation SHALL be shown as a single horizontally scrollable row above the sections instead of a left column, and SHALL move with the sections like the wide navigation does, scrolling out of view as the user scrolls down. While the row is visible it SHALL keep the current entry within its visible part by scrolling the row sideways only. Updating the current entry MUST NOT scroll the page, whether or not the navigation is in view. All other navigation behaviour SHALL be the same as on wide viewports.

#### Scenario: Phone-width layout
- **WHEN** Settings is shown in a 400px wide viewport
- **THEN** the sections use the full width, the navigation is a row above them that can be scrolled sideways, and activating an entry still jumps to its section

#### Scenario: The row scrolls away
- **WHEN** the user scrolls down on a narrow viewport until the second section is at the top
- **THEN** the navigation row is no longer visible

#### Scenario: Marker updates never move the page
- **WHEN** the navigation is out of view and the user keeps scrolling down through three sections
- **THEN** the page position changes only by the user's scrolling, the URL's `section` parameter follows the section in view, and the page is never pulled back towards the navigation

#### Scenario: Current entry is visible when the row comes back
- **WHEN** the user has scrolled to the last section on a narrow viewport and scrolls back up until the row is visible
- **THEN** the row shows the entry that is now current without the user having to scroll the row sideways
