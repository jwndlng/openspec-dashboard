## MODIFIED Requirements

### Requirement: Board columns are derived from schema and implementation state
The board SHALL place each change in exactly one column, where a column names the last step of the lifecycle that is complete. Using, in order: `Archived` if the change is archived; `Synced` if `tasks.total > 0`, `tasks.done == tasks.total` and the change's delta specs are synced into the main specs (a change without delta specs counts as synced); `Done` if `tasks.total > 0` and `tasks.done == tasks.total`; `Implementing` if `tasks.done > 0`; `Ready` if every artifact is done (ready to apply, nothing ticked yet); `Unknown` if the change's artifacts could not be read; otherwise, taking the schema's artifacts in display order, `New` if the first artifact is not done, else the display name of the last artifact of the longest leading run of done artifacts.

Display order SHALL be the schema's own artifact order, except that for the `spec-driven` schema it SHALL be `proposal`, `design`, `specs`, `tasks` (artifacts not named there follow in schema order). Column order SHALL be `New`, then the artifact columns of the majority schema followed by any additional artifact columns of other schemas, each schema omitting its last artifact in display order (completing it means every artifact is done, which is `Ready`), then `Ready`, `Implementing`, `Done`, `Synced`, `Archived`. Apart from the display-order exception, columns MUST NOT be hardcoded to the `spec-driven` schema.

A change in `Synced` SHALL be treated as complete wherever a change in `Done` is: the completion badge on its card, the highlighted column count, and every "to archive" count.

#### Scenario: Brand-new change
- **WHEN** a change directory exists and its `proposal` artifact is not done
- **THEN** it appears in the `New` column

#### Scenario: Change with proposal only
- **WHEN** a `spec-driven` change has `proposal: done` and `design` and `specs` not done
- **THEN** it appears in the `Proposal` column

#### Scenario: Design written
- **WHEN** a `spec-driven` change has `proposal` and `design` done and `specs` not done
- **THEN** it appears in the `Design` column

#### Scenario: Specs written before design
- **WHEN** a `spec-driven` change has `proposal` and `specs` done and `design` not done
- **THEN** it appears in the `Proposal` column, because `design` precedes `specs` in display order

#### Scenario: Specs written, tasks not yet
- **WHEN** a `spec-driven` change has `proposal`, `design` and `specs` done and `tasks` not done
- **THEN** it appears in the `Specs` column

#### Scenario: Ready to apply
- **WHEN** all artifacts are done and `tasks` is `done: 0, total: 12`
- **THEN** it appears in `Ready` showing `0/12`

#### Scenario: First task ticked
- **WHEN** all artifacts are done and `tasks` is `done: 1, total: 12`
- **THEN** it appears in `Implementing` showing `1/12`

#### Scenario: Tasks ticked while an artifact is still open
- **WHEN** `design` is not done and `tasks` is `done: 2, total: 12`
- **THEN** it appears in `Implementing`

#### Scenario: Complete but not synced
- **WHEN** `tasks` is `done: 12, total: 12`, the change is not archived, and its delta specs are not yet reflected in the main specs
- **THEN** it appears in the `Done` column

#### Scenario: Synced, waiting to be archived
- **WHEN** `tasks` is `done: 12, total: 12`, the change is not archived, and its delta specs are reflected in the main specs
- **THEN** it appears in the `Synced` column with the completion badge and counts towards "to archive"

#### Scenario: Complete change without delta specs
- **WHEN** `tasks` is `done: 5, total: 5` and the change has no delta spec files
- **THEN** it appears in the `Synced` column

#### Scenario: All artifacts done but tasks file empty
- **WHEN** all artifacts are done and `tasks` is `done: 0, total: 0`
- **THEN** it appears in `Ready` with a "no tasks" warning badge

#### Scenario: Column list for the spec-driven schema
- **WHEN** every tracked change uses the `spec-driven` schema
- **THEN** the board shows the columns `New`, `Proposal`, `Design`, `Specs`, `Ready`, `Implementing`, `Done`, `Synced`, `Archived`, with no `Tasks` column

#### Scenario: Another schema keeps its own order
- **WHEN** every tracked change uses a schema whose artifacts are `brief`, `plan`, `checklist` in that order
- **THEN** the board shows `New`, `Brief`, `Plan`, `Ready`, `Implementing`, `Done`, `Synced`, `Archived`

#### Scenario: Lifecycle columns are always present
- **WHEN** no change is new, ready to apply or synced
- **THEN** the board still shows empty `New`, `Ready` and `Synced` columns in their positions

#### Scenario: Unreadable change
- **WHEN** a change's artifacts could not be read
- **THEN** it appears in the `Unknown` column, not in `New`
