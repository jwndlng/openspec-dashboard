## MODIFIED Requirements

### Requirement: Board columns are derived from schema and implementation state
The board SHALL place each change in exactly one column using, in order: `Archived` if the change is archived; `Done` if `tasks.total > 0` and `tasks.done == tasks.total`; `Implementing` if `tasks.done > 0`; `Ready` if every artifact is done (ready to apply, nothing ticked yet); otherwise the display name of the first artifact in schema order whose status is not `done`. Column order SHALL be the artifact columns of the majority schema, then `Ready`, `Implementing`, `Done`, `Archived`. Columns MUST NOT be hardcoded to the `spec-driven` schema.

#### Scenario: Change with proposal only
- **WHEN** a change has `proposal: done` and `design: ready`
- **THEN** it appears in the `Design` column

#### Scenario: Ready to apply
- **WHEN** all artifacts are done and `tasks` is `done: 0, total: 12`
- **THEN** it appears in `Ready` showing `0/12`

#### Scenario: First task ticked
- **WHEN** all artifacts are done and `tasks` is `done: 1, total: 12`
- **THEN** it appears in `Implementing` showing `1/12`

#### Scenario: Tasks ticked while an artifact is still open
- **WHEN** `design` is not done and `tasks` is `done: 2, total: 12`
- **THEN** it appears in `Implementing`

#### Scenario: Complete but not archived
- **WHEN** `tasks` is `done: 12, total: 12` and the change is not archived
- **THEN** it appears in the `Done` column

#### Scenario: All artifacts done but tasks file empty
- **WHEN** all artifacts are done and `tasks` is `done: 0, total: 0`
- **THEN** it appears in `Ready` with a "no tasks" warning badge

#### Scenario: Ready column is always present
- **WHEN** no change is ready to apply
- **THEN** the board still shows an empty `Ready` column between the last artifact column and `Implementing`
