## ADDED Requirements

### Requirement: Repository snapshots report the carried shared-config profiles
When at least one shared config profile exists, the scanner SHALL set each successfully scanned repository's `sharedConfig` to `{ unreadable, applied }`, where `applied` lists the profiles its `openspec/config.yaml` carries, each with the state `in-sync`, `outdated` or `orphaned`, derived from the text of that file and the stored profiles. The scanner MUST derive it by reading that one file only, MUST NOT write anything, and a failure to read or parse the file MUST yield `unreadable: true` rather than failing the repository's scan. While no profile exists, the field SHALL be omitted. When a repository's scan fails, its previous value SHALL be retained.

#### Scenario: State in the snapshot
- **WHEN** profile `base` exists and a repository's config carries an identical managed section for it
- **THEN** that repository's snapshot has `sharedConfig.applied: [{ id: "base", state: "in-sync" }]`

#### Scenario: No profiles
- **WHEN** no profile exists
- **THEN** no repository snapshot contains `sharedConfig`

#### Scenario: Broken config file
- **WHEN** a repository's `openspec/config.yaml` is not valid YAML
- **THEN** the repository is reported with `ok: true` and `sharedConfig.unreadable: true`
