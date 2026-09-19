## ADDED Requirements

### Requirement: Spec sync state is derived from the repository
For each non-archived change whose tasks are all complete (`tasks.total > 0` and `tasks.done == tasks.total`), the scanner SHALL report `specsSynced`, stating whether the change's delta specs are already reflected in the repository's main specs. For every delta spec file `specs/<capability>/spec.md` in the change, compared with `openspec/specs/<capability>/spec.md`, the delta is synced when: every ADDED requirement exists in the main spec by name; every MODIFIED requirement exists and its full block equals the delta's block ignoring differences in surrounding, trailing and repeated blank whitespace; every REMOVED requirement is absent; and for every RENAMED pair the new name exists and the old name does not. `specsSynced` SHALL be `true` only when every delta file is synced, and SHALL be `true` for a change with no delta spec files or only empty deltas. A missing main spec SHALL count as not synced when the delta adds or modifies requirements. The state MUST be derived only by reading files in the repository: the scanner MUST NOT write a marker, invoke git, or invoke the `openspec` CLI for it. If the delta or main spec cannot be read or parsed, `specsSynced` SHALL be `false` and the problem SHALL be listed in the change's warnings without failing the repository's scan. For changes that are archived or whose tasks are not all complete, `specsSynced` SHALL be omitted.

#### Scenario: Delta not applied yet
- **WHEN** a complete change adds requirement `Two-factor login` to capability `auth` and `openspec/specs/auth/spec.md` has no such requirement
- **THEN** `specsSynced` is `false`

#### Scenario: Delta applied
- **WHEN** the same change's added requirement is present in `openspec/specs/auth/spec.md`, and its modified requirement `Session timeout` has the same text there as in the delta
- **THEN** `specsSynced` is `true`

#### Scenario: Modified requirement still has the old text
- **WHEN** the delta modifies `Session timeout` and the main spec still contains the previous wording
- **THEN** `specsSynced` is `false`

#### Scenario: Removal and rename
- **WHEN** the delta removes `Legacy export` and renames `Login` to `Sign in`, and the main spec has no `Legacy export`, has `Sign in` and has no `Login`
- **THEN** `specsSynced` is `true`

#### Scenario: New capability whose main spec does not exist
- **WHEN** the delta adds requirements to capability `billing` and `openspec/specs/billing/spec.md` does not exist
- **THEN** `specsSynced` is `false`

#### Scenario: No delta specs
- **WHEN** a complete change has no `specs/` directory
- **THEN** `specsSynced` is `true`

#### Scenario: Agrees with the OpenSpec tool
- **WHEN** a change's deltas have been applied to the main specs by `openspec archive`
- **THEN** evaluating those deltas against the resulting main specs yields `specsSynced: true`

#### Scenario: Unparseable delta
- **WHEN** a delta spec file cannot be parsed
- **THEN** `specsSynced` is `false`, the change carries a warning, and the repository is still reported with `ok: true`

#### Scenario: Change still in progress
- **WHEN** a change has `tasks` `done: 3, total: 12`
- **THEN** `specsSynced` is omitted and no spec files are read for it
