## MODIFIED Requirements

### Requirement: Tracking is opt-in per repository

Discovered repositories that are not already in the config SHALL be offered as candidates and MUST NOT be added to the config by discovery. A repository SHALL be added to the config only when the user acts for that one repository: either by enabling that individual candidate (on the projects overview, where it takes effect at once), or by starting an integration for that individual integratable repository after which `openspec/config.yaml` appears in it. In both cases it is added with `enabled: true` and its default name. Only repositories with `enabled: true` are scanned and shown on the board. Repositories already present in the config MUST keep their `enabled` state, `name` and agent-session settings when discovery runs again and MUST NOT be listed as candidates; this comparison MUST use canonical paths, so a repository tracked under one spelling is never offered again under another. A repository SHALL leave the config only when the user forgets it on the projects overview, which is offered for disabled repositories only. Ignore paths affect discovery only: a repository already in the config stays configured even if it lies below an ignore path.

#### Scenario: Newly discovered repo is only a candidate
- **WHEN** discovery finds a repository that is not yet in the config
- **THEN** it is listed as a candidate, is not added to the config, and does not appear on the board

#### Scenario: Enabling a single candidate
- **WHEN** discovery lists candidates `a`, `b` and `c` and the user enables `b` on the projects overview
- **THEN** the config contains `b` with `enabled: true`, does not contain `a` or `c`, and `b` no longer appears in the candidate list

#### Scenario: Re-running discovery preserves user choices
- **WHEN** a repo was previously enabled, renamed to "Beta SOC" and switched off for agent sessions, and discovery runs again
- **THEN** the repo remains enabled with name "Beta SOC" and agent sessions off, and is not listed as a candidate

#### Scenario: Tracked repo is not offered under another spelling
- **WHEN** a repository is tracked and discovery runs with a root that reaches the same directory through a symlink or different casing
- **THEN** the repository is not listed as a candidate

#### Scenario: Disabled repo stays configured
- **WHEN** the user disables a tracked repo on the projects overview
- **THEN** it remains in the config with `enabled: false`, keeps its name, and is not listed as a candidate

#### Scenario: Forgotten repo becomes a candidate again
- **WHEN** the user forgets a disabled repo on the projects overview that still exists under a workspace root, and discovery runs
- **THEN** the repo is absent from the config and listed as a candidate with its default name

#### Scenario: Ignoring a path keeps tracked repos
- **WHEN** a tracked repository lies below a path the user adds to `ignorePaths`
- **THEN** the repository stays in the config and on the board

#### Scenario: A confirmed integration adds the repository
- **WHEN** the user starts an integration for `/w/acme/chat-groups` and `openspec/config.yaml` appears in it
- **THEN** it is added to the config with `enabled: true` and its default name, without the user pressing Enable for it

#### Scenario: An unconfirmed integration adds nothing
- **WHEN** the user starts an integration and no `openspec/config.yaml` appears
- **THEN** the config is unchanged and the repository is still listed as integratable

### Requirement: Settings view exposes discovery and configuration

The Settings view SHALL allow the user to add or remove scan roots, add or remove ignore paths, re-run discovery on demand, and set the poll interval. Next to the workspace roots it SHALL state how many untracked repositories the latest discovery run found — candidates and integratable repositories, each counted — with a link to the projects overview, where they are listed, enabled, integrated and ignored. Settings SHALL NOT list candidates or integratable repositories, and SHALL NOT offer to enable, disable, rename or forget a tracked repository or to change its agent-session settings: all of that is done on the projects overview. The view SHALL state that ignore paths only affect discovery. The view SHALL indicate while discovery is in progress and SHALL show per-root discovery errors. Running discovery MUST NOT save the draft configuration. Saving SHALL persist to config and trigger a scan when the poll interval changed.

#### Scenario: Enabling a repo triggers a scan
- **WHEN** the user enables a disabled repository on the projects overview
- **THEN** the config is persisted without visiting Settings and a scan starts so the repository's changes appear on the board without a manual refresh

#### Scenario: Discovery leaves unsaved edits unsaved
- **WHEN** the user changes the poll interval, then adds a workspace root, and discovery completes
- **THEN** the persisted config still has the old poll interval and old roots, and the unsaved-changes indicator is shown

#### Scenario: Root error is shown
- **WHEN** the user adds a workspace root that does not exist
- **THEN** Settings shows an error for that root next to the roots list and still counts the repositories found under the other roots

#### Scenario: Found repositories point to the overview
- **WHEN** discovery finds 2 candidates and 1 integratable repository
- **THEN** Settings states that 2 repositories using OpenSpec and 1 without it are not tracked, links to the projects overview, and lists none of them

#### Scenario: Manual rediscover
- **WHEN** the user creates a new OpenSpec project under an existing root and clicks Rediscover in Settings
- **THEN** the number of untracked repositories Settings states includes the new project

#### Scenario: Ignoring a candidate
- **WHEN** the user adds a candidate's path to the ignore paths in Settings
- **THEN** the path is added to the draft ignore paths, discovery re-runs, the candidate is no longer counted, and nothing is persisted until the user saves

#### Scenario: Integratable repositories are listed apart from candidates
- **WHEN** discovery reports both candidates and integratable repositories
- **THEN** Settings counts the two apart and lists neither, and the projects overview lists both under Unmanaged projects, each labelled with what it is

#### Scenario: Ignoring an integratable repository
- **WHEN** the user adds an integratable repository's path to the ignore paths in Settings
- **THEN** discovery re-runs, the repository is no longer counted, and nothing is persisted until the user saves

#### Scenario: Same-named repositories are distinguishable
- **WHEN** `acme/chat-groups` and `ops/repo-mirror/repos/chat-groups` are both tracked
- **THEN** on the projects overview one shows the hint `acme` and the other `ops/repo-mirror/repos`, a repository with a unique name shows no hint, and Settings shows neither

#### Scenario: Tracked repositories are not listed
- **WHEN** 17 repositories are tracked and the user opens Settings
- **THEN** the Workspace roots, Scanning and Agent sessions sections list none of them, and the Workspace roots section links to the projects overview
