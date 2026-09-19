## MODIFIED Requirements

### Requirement: Discovery finds OpenSpec-enabled repositories under configured roots
The dashboard SHALL discover repositories by walking each given scan root to a bounded depth (default 4) and reporting directories that contain `openspec/config.yaml`. The walk MUST skip `node_modules`, `.git`, `.venv`, `target` and `dist` directories, MUST NOT descend into a directory it reported (nested copies are not projects of their own), and MUST NOT report linked git worktrees (directories whose `.git` is a file). Discovery SHALL run whenever the user adds or removes a workspace root in Settings (against the edited roots, without requiring a save), when Settings is opened with at least one root configured, and when the user requests it explicitly. Discovery MUST be read-only: it MUST NOT modify the persisted configuration.

#### Scenario: Repos are found under multiple roots
- **WHEN** scan roots are `~/work/alpha` and `~/work/acme` and both contain projects with `openspec/config.yaml`
- **THEN** discovery returns each project directory exactly once with its absolute path

#### Scenario: Ignored directories are skipped
- **WHEN** a scan root contains `node_modules/some-pkg/openspec/config.yaml`
- **THEN** that directory is not reported

#### Scenario: Nested copies and worktrees are not reported
- **WHEN** a repository contains `test/fixtures/other/openspec/config.yaml`, and a sibling directory is a linked worktree of that repository
- **THEN** only the repository itself is reported

#### Scenario: Missing scan root
- **WHEN** a given scan root does not exist
- **THEN** discovery reports an error for that root and still returns results from the other roots

#### Scenario: Adding a root triggers discovery immediately
- **WHEN** the user adds `~/work/alpha` as a workspace root in Settings and has not saved
- **THEN** discovery runs against the edited roots without further user action and the repositories found under `~/work/alpha` are shown as candidates

#### Scenario: Removing a root triggers discovery immediately
- **WHEN** the user removes a workspace root in Settings
- **THEN** discovery runs against the remaining roots and candidates that were only found under the removed root are no longer shown

#### Scenario: Removing the last root clears candidates
- **WHEN** the user removes the only workspace root
- **THEN** no discovery request is made and the candidate list is empty

#### Scenario: Opening Settings runs discovery
- **WHEN** the user opens Settings and the config contains at least one workspace root
- **THEN** discovery runs and candidates are shown without clicking anything

#### Scenario: Discovery does not change the config
- **WHEN** discovery finds repositories that are not in the config
- **THEN** `~/.openspec-dashboard/config.json` is unchanged

#### Scenario: Only the latest discovery result is shown
- **WHEN** the user edits the roots twice in quick succession and the first discovery finishes after the second
- **THEN** the candidate list reflects the second edit only

### Requirement: Tracking is opt-in per repository
Discovered repositories that are not already in the config SHALL be offered as candidates and MUST NOT be added to the config by discovery. A repository SHALL be added to the config only when the user enables that individual candidate, at which point it is added with `enabled: true` and the default name. Only repositories with `enabled: true` are scanned and shown on the board. Repositories already present in the config MUST keep their `enabled` state and `name` when discovery runs again and MUST NOT be listed as candidates.

#### Scenario: Newly discovered repo is only a candidate
- **WHEN** discovery finds a repository that is not yet in the config
- **THEN** it is listed as a candidate, is not added to the config, and does not appear on the board

#### Scenario: Enabling a single candidate
- **WHEN** discovery lists candidates `a`, `b` and `c`, the user enables `b` and saves
- **THEN** the config contains `b` with `enabled: true`, does not contain `a` or `c`, and `b` no longer appears in the candidate list

#### Scenario: Re-running discovery preserves user choices
- **WHEN** a repo was previously enabled and renamed to "Beta SOC" and discovery runs again
- **THEN** the repo remains enabled with name "Beta SOC" and is not listed as a candidate

#### Scenario: Disabled repo stays configured
- **WHEN** the user disables a tracked repo and saves
- **THEN** it remains in the config with `enabled: false`, keeps its name, and is not listed as a candidate

#### Scenario: Forgotten repo becomes a candidate again
- **WHEN** the user forgets a tracked repo that still exists under a workspace root, saves, and discovery runs
- **THEN** the repo is absent from the config and listed as a candidate

### Requirement: Settings view exposes discovery and configuration
The Settings view SHALL allow the user to add or remove scan roots, re-run discovery on demand, and set the poll interval. It SHALL show tracked repositories (those in the config) separately from discovered candidates: tracked repositories can be toggled, renamed and forgotten; each candidate shows its path and an individual Enable action. The view SHALL indicate while discovery is in progress and SHALL show per-root discovery errors. Running discovery MUST NOT save the draft configuration. Saving SHALL persist to config and trigger a scan when the set of enabled repositories changed.

#### Scenario: Enabling a repo triggers a scan
- **WHEN** the user enables a candidate and saves
- **THEN** the config is persisted and a scan starts so the repo's changes appear on the board without a manual refresh

#### Scenario: Discovery leaves unsaved edits unsaved
- **WHEN** the user changes the poll interval, then adds a workspace root, and discovery completes
- **THEN** the persisted config still has the old poll interval and old roots, and the unsaved-changes indicator is shown

#### Scenario: Root error is shown
- **WHEN** the user adds a workspace root that does not exist
- **THEN** Settings shows an error for that root next to the roots list and still lists candidates from the other roots

#### Scenario: Manual rediscover
- **WHEN** the user creates a new OpenSpec project under an existing root and clicks Rediscover
- **THEN** the new project appears as a candidate
