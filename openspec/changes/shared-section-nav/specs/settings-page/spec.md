# Spec Delta

## MODIFIED Requirements

### Requirement: A section navigation is shown beside the sections
On viewports wider than 720px the Settings page SHALL show a navigation to the left of the sections, listing every section in page order and starting level with the first section. Settings SHALL scroll as one page: the navigation and the sections SHALL share a single scroll area that spans the full width below the top bar, so that scrolling works wherever the pointer is. The navigation SHALL move along with the content beside the section it is placed by: the section occupying the top of the visible area, or, after the user activated an entry, that entry's section until the user scrolls again. While that section's start is in view the navigation SHALL be level with it; once that start has scrolled above the view, the navigation SHALL stay in view level with the top of the visible area until it reaches the end of that section, with which it then moves; it SHALL never extend below the last section. Reaching the end of the page, where the last section becomes the current entry without having reached the top of the visible area, SHALL NOT by itself move the navigation, and scrolling back from the end by a few pixels SHALL NOT move it either. When the section the navigation is placed by changes, the navigation SHALL glide to its new place; while scrolling within one section it SHALL keep pace with the content without lagging behind, and scrolling during a glide SHALL neither restart nor slow the glide. It SHALL NOT be pinned to the top of the page independently of the sections. Activating an entry SHALL bring the start of that section to the top of the visible area and move keyboard focus to that section, so that the next Tab press reaches the section's first control. When the page is scrolled back to its very top, the navigation SHALL be visible again, level with the first section. Scrolling and gliding SHALL be animated only when the user has not requested reduced motion. The save bar SHALL remain visible and unchanged.

#### Scenario: Jump to a section below the fold
- **WHEN** 17 repositories are tracked, the user is at the top of Settings and activates the "Scanning" entry
- **THEN** the Scanning section is scrolled to the top of the visible area and the navigation is level with it

#### Scenario: The navigation moves along to the next section
- **WHEN** the user scrolls Settings down by hand until "Agent sessions" becomes the current section
- **THEN** the navigation has glided to be level with the start of the Agent sessions section

#### Scenario: A section taller than the window
- **WHEN** the current section is taller than the visible area and the user scrolls further down inside it
- **THEN** the navigation stays in view at the top of the visible area, and when the end of that section reaches it, it moves up together with that end

#### Scenario: The last section
- **WHEN** the user scrolls to the end of Settings and the last section is shorter than the navigation
- **THEN** the navigation ends with the page and does not extend below the last section

#### Scenario: Reaching the end does not move the navigation
- **WHEN** the user scrolls Settings down by hand to its very end, where the short Environment section becomes the current entry while Shared OpenSpec config still occupies the top of the visible area
- **THEN** the Environment entry is marked current, and the navigation stays where it was beside the top of the visible area instead of moving down to the Environment section

#### Scenario: Leaving the end does not move the navigation
- **WHEN** the user is at the very end of Settings and scrolls up by a few pixels
- **THEN** the navigation keeps pace with the content and does not jump or glide

#### Scenario: Scrolling during a glide
- **WHEN** the navigation has started to glide to the next section and the user keeps scrolling
- **THEN** the glide finishes in its usual time at the navigation's place for the current scroll position, without starting over

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
- **WHEN** the user tabs to the "Scanning" entry, presses Enter, and then presses Tab
- **THEN** focus is on the first interactive control inside the Scanning section

#### Scenario: Reduced motion
- **WHEN** the operating system requests reduced motion and the user activates an entry
- **THEN** the section is shown immediately without a scrolling animation and the navigation is placed beside it without gliding

#### Scenario: Save bar stays
- **WHEN** the user scrolls to the end of Settings with unsaved changes
- **THEN** the save bar with "unsaved changes" is still visible at the bottom
