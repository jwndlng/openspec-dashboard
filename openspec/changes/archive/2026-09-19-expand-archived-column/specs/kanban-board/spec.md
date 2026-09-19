## RENAMED Requirements

- FROM: `### Requirement: Archived column is collapsed and bounded`
- TO: `### Requirement: Archived column is bounded`

## MODIFIED Requirements

### Requirement: Archived column is bounded
The `Archived` column SHALL be presented like every other column: always open, with the same width, header layout, repository grouping and cards, and with no collapse, expand or close control of its own. It SHALL show at most the 25 most recently archived changes sorted by archive date descending. Its header count SHALL be the total number of archived changes matching the active filters; when more than 25 match, the count SHALL read `25 of <total>`. The "hide archived" filter SHALL remain the way to remove the column from the board. This SHALL apply to the combined board and to repository boards alike.

#### Scenario: Open by default
- **WHEN** the board loads with 96 archived changes and "hide archived" is off
- **THEN** the `Archived` column is shown open like the other columns, with the 25 most recently archived changes as cards and a header count of `25 of 96`

#### Scenario: Fewer archived changes than the bound
- **WHEN** a repository board has 7 archived changes
- **THEN** the `Archived` column shows all 7 cards, newest archive first, and the header count reads `7`

#### Scenario: No collapse control
- **WHEN** the `Archived` column is shown
- **THEN** it has no control to collapse, expand or close it, and clicking its header does nothing

#### Scenario: Hidden by the filter
- **WHEN** the user enables "hide archived"
- **THEN** the `Archived` column is not shown, and it is still not shown after a page reload
