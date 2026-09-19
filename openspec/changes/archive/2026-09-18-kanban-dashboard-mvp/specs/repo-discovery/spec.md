## ADDED Requirements

### Requirement: Dashboard configuration is persisted in the user's home directory
The dashboard SHALL store its configuration in `~/.openspec-dashboard/config.json` containing `scanRoots`, `repos` (each with `id`, `path`, `name`, `enabled`), `pollIntervalSeconds` and `port`. The dashboard MUST create the directory and a default config on first start and MUST write config atomically (temp file + rename).

#### Scenario: First start creates default config
- **WHEN** the dashboard starts and `~/.openspec-dashboard/config.json` does not exist
- **THEN** it creates the directory and a config with empty `scanRoots`, empty `repos`, `pollIntervalSeconds: 60` and `port: 4711`

#### Scenario: Config survives restart
- **WHEN** a user enables a repo and restarts the dashboard
- **THEN** the repo is still listed as enabled after restart

### Requirement: Discovery finds OpenSpec-enabled repositories under configured roots
The dashboard SHALL discover repositories by walking each configured scan root to a bounded depth (default 4) and reporting directories that contain `openspec/config.yaml`. The walk MUST skip `node_modules`, `.git`, `.venv`, `target` and `dist` directories, MUST NOT descend into a directory it reported (nested copies are not projects of their own), and MUST NOT report linked git worktrees (directories whose `.git` is a file). Discovery SHALL run only when triggered by the user.

#### Scenario: Repos are found under multiple roots
- **WHEN** scan roots are `~/Workspace/alpha` and `~/Workspace/acme` and both contain projects with `openspec/config.yaml`
- **THEN** discovery returns each project directory exactly once with its absolute path

#### Scenario: Ignored directories are skipped
- **WHEN** a scan root contains `node_modules/some-pkg/openspec/config.yaml`
- **THEN** that directory is not reported

#### Scenario: Nested copies and worktrees are not reported
- **WHEN** a repository contains `test/fixtures/other/openspec/config.yaml`, and a sibling directory is a linked worktree of that repository
- **THEN** only the repository itself is reported

#### Scenario: Missing scan root
- **WHEN** a configured scan root does not exist
- **THEN** discovery reports an error for that root and still returns results from the other roots

### Requirement: Tracking is opt-in per repository
Discovered repositories SHALL be added to the config as `enabled: false` by default. Only repositories with `enabled: true` are scanned and shown on the board. Repositories already present in the config MUST keep their `enabled` state and `name` when discovery runs again.

#### Scenario: Newly discovered repo is not tracked
- **WHEN** discovery finds a repository that is not yet in the config
- **THEN** it is added with `enabled: false` and does not appear on the board

#### Scenario: Re-running discovery preserves user choices
- **WHEN** a repo was previously enabled and renamed to "Beta SOC" and discovery runs again
- **THEN** the repo remains enabled with name "Beta SOC"

### Requirement: Repository display names are editable
Each repository SHALL have a display `name` defaulting to its directory basename, editable in Settings. The repository `id` MUST be derived from the absolute path so that renaming does not change identity.

#### Scenario: Default name from directory
- **WHEN** `/w/acme/beta-soc` is discovered
- **THEN** its default name is `beta-soc`

#### Scenario: Rename keeps identity
- **WHEN** the user renames a repo in Settings
- **THEN** its `id` is unchanged and the board shows the new name

### Requirement: Settings view exposes discovery and configuration
The Settings view SHALL allow the user to add or remove scan roots, run discovery, toggle tracking per repository, rename repositories, and set the poll interval. Saving SHALL persist to config and trigger a scan when the set of enabled repositories changed.

#### Scenario: Enabling a repo triggers a scan
- **WHEN** the user enables a repo and saves
- **THEN** the config is persisted and a scan starts so the repo's changes appear on the board without a manual refresh
