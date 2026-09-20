## ADDED Requirements

### Requirement: Repository groups can be minimized
On a board that shows repository groups, every group SHALL offer a control on its header to minimize and expand it. A minimized group SHALL show only its header — the repository colour and name and the number of cards in the group — and none of its cards; an expanded group SHALL show its cards as before. The control SHALL be operable by pointer and keyboard and SHALL expose its expanded or minimized state to assistive technology. The state SHALL be held per group, that is per repository and column: changing one group MUST NOT change the same repository's group in another column.

Groups in the `Archived` column SHALL be minimized by default; groups in every other column SHALL be expanded by default. A state the user has chosen explicitly SHALL be remembered in the browser and SHALL survive page reloads, scans and filter changes; repositories and columns without an explicit choice SHALL use the default. If the remembered state cannot be read or written, the board SHALL fall back to the defaults and remain fully usable.

Minimizing MUST NOT change which cards match the active filters or any count: the group header count and the column header count SHALL include the cards of minimized groups. While a text search is active, every group shown SHALL be presented expanded regardless of its remembered state, the control SHALL NOT change the remembered state, and clearing the search SHALL restore the previous presentation. Boards that render cards without group headers (single-repository boards) are unaffected.

#### Scenario: Minimize a group
- **WHEN** the `Implementing` column shows group `alpha` with 3 cards and the user activates the control on its header
- **THEN** the group shows only its header with the name `alpha` and the count `3`, none of its cards are shown, and the `Implementing` column count is unchanged

#### Scenario: Expand again
- **WHEN** the user activates the control on the minimized `alpha` group
- **THEN** its 3 cards are shown again in their previous order

#### Scenario: State is per column
- **WHEN** the user minimizes `alpha` in `Implementing` and `alpha` also has a group in `Ready`
- **THEN** the `alpha` group in `Ready` stays expanded

#### Scenario: Archived groups start minimized
- **WHEN** the combined board loads for a user with no remembered choices and the `Archived` column contains groups `alpha` (4) and `beta` (2)
- **THEN** both groups are shown minimized with their counts, and the groups in all other columns are shown expanded

#### Scenario: Choice is remembered
- **WHEN** the user expands `alpha` in `Archived`, minimizes `beta` in `Ready`, and reloads the page
- **THEN** `alpha` in `Archived` is expanded, `beta` in `Ready` is minimized, and all other groups use their defaults

#### Scenario: New repository gets the defaults
- **WHEN** a repository is tracked for the first time after the user has made choices for other repositories
- **THEN** its groups are minimized in `Archived` and expanded elsewhere

#### Scenario: Search shows matches inside minimized groups
- **WHEN** `alpha` in `Archived` is minimized and the user searches for the name of one of its archived changes
- **THEN** the matching card is shown in an expanded `alpha` group, and after the search is cleared `alpha` in `Archived` is minimized again

#### Scenario: Keyboard and assistive technology
- **WHEN** the user focuses a group header control with the keyboard and presses Enter or Space
- **THEN** the group toggles, and the control reports whether the group is expanded

#### Scenario: Storage unavailable
- **WHEN** the browser refuses access to local storage
- **THEN** the board shows the default states, toggling still works for the current page, and no error is shown

## MODIFIED Requirements

### Requirement: Archived column is bounded
The `Archived` column SHALL be presented like every other column: always open, with the same width, header layout, repository grouping and cards, and with no collapse, expand or close control of its own. It SHALL show at most the 25 most recently archived changes sorted by archive date descending. Its header count SHALL be the total number of archived changes matching the active filters; when more than 25 match, the count SHALL read `25 of <total>`. The "hide archived" filter SHALL remain the way to remove the column from the board. This SHALL apply to the combined board and to repository boards alike. Where the column shows repository groups, those groups follow the minimizing rules for repository groups and are minimized by default; the bound of 25 SHALL be applied before grouping, so a group's count is the number of its changes within the bound.

#### Scenario: Open by default
- **WHEN** the combined board loads with 96 archived changes and "hide archived" is off, for a user with no remembered choices
- **THEN** the `Archived` column is shown open like the other columns with a header count of `25 of 96`, and the 25 most recently archived changes are represented by minimized repository groups whose counts add up to 25

#### Scenario: Fewer archived changes than the bound
- **WHEN** a repository board has 7 archived changes
- **THEN** the `Archived` column shows all 7 cards, newest archive first, and the header count reads `7`

#### Scenario: No collapse control
- **WHEN** the `Archived` column is shown
- **THEN** the column itself has no control to collapse, expand or close it, and clicking the column header does nothing

#### Scenario: Hidden by the filter
- **WHEN** the user enables "hide archived"
- **THEN** the `Archived` column is not shown, and it is still not shown after a page reload
