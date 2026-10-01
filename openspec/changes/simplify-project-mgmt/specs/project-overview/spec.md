## MODIFIED Requirements

### Requirement: Projects overview is the landing page
The dashboard SHALL show a projects overview at `/` listing every repository that is enabled in the configuration and present in the snapshot, one row per repository, followed by the **Untracked & disabled** section. A repository that is disabled or removed in the configuration SHALL disappear from the tracked list, the combined board, the repository boards and the top-bar error indicators as soon as the configuration is saved, without waiting for the next scan, even while the snapshot still contains it. A repository that is enabled in the configuration but not yet in the snapshot SHALL be listed in the tracked list as a pending entry showing its name and the text `Scanning…`, with no counts, until a snapshot containing it arrives. When no repository is enabled, the tracked list SHALL be replaced by an empty state saying that no repositories are tracked yet and pointing to the section below, and the Untracked & disabled section SHALL still be shown. The combined all-repositories board SHALL remain available at `/board`. The top bar SHALL offer navigation to the overview, the combined board and settings, and SHALL mark the overview entry as active on `/` and on any repository board.

#### Scenario: Opening the dashboard
- **WHEN** the user opens `/` with 17 tracked repositories
- **THEN** a list of 17 repository rows is shown instead of the combined board, followed by the Untracked & disabled section

#### Scenario: Repository disabled in Settings
- **WHEN** the user disables `demo-agent` in Settings, saves, and opens the overview before the next scan has finished
- **THEN** `demo-agent` is not in the tracked list, it is listed as disabled in the Untracked & disabled section, and opening its `/repo/<id>` URL shows "repository not found"

#### Scenario: Combined board still reachable
- **WHEN** the user opens `/board?q=terraform`
- **THEN** the combined board is shown with the search filter `terraform` applied

#### Scenario: No repositories tracked
- **WHEN** the snapshot contains no repositories and none are enabled in the config
- **THEN** the overview shows the "No repositories tracked yet" empty state in place of the tracked list and, below it, the Untracked & disabled section

#### Scenario: A repository enabled a moment ago
- **WHEN** the user enables `alpha-infra` and the scan that includes it has not finished
- **THEN** the tracked list shows `alpha-infra` with `Scanning…` and no counts, and once the scan finishes the entry shows its counts like every other row

## ADDED Requirements

### Requirement: The overview lists untracked and disabled repositories
Below the tracked repositories the projects overview SHALL show a section headed **Untracked & disabled** with the number of repositories it lists. It SHALL list, in three groups in this order, each group headed and omitted when empty: **Disabled** — repositories in the configuration with `enabled: false`; **Discovered** — repositories the latest discovery run reported as candidates; **Without OpenSpec** — repositories the latest discovery run reported as integratable, under a heading or hint that states that they do not use OpenSpec yet. Within a group entries SHALL be ordered by name, then path. Each entry SHALL show the repository's name, its path, the same-name path hint when its name collides with any other repository listed anywhere on the overview, and, for a discovered repository that shares its `origin` remote with other known repositories, a badge naming them whose tooltip lists their paths. The section SHALL be laid out the same in the `Table` and `Tiles` layouts. The overview's search SHALL filter the section by the same rule as the tracked list, and the Work in progress filter SHALL hide the whole section. The section MUST NOT show counts, work in progress or pull requests for its entries, and it MUST NOT offer any action on a checkout.

#### Scenario: All three groups
- **WHEN** `demo-agent` is configured and disabled, discovery reports the candidate `beta-soc` and the integratable repository `chat-groups`
- **THEN** the section reads `Untracked & disabled · 3` and lists `demo-agent` under Disabled, `beta-soc` under Discovered and `chat-groups` under Without OpenSpec, in that order

#### Scenario: An empty group is omitted
- **WHEN** no repository is disabled and discovery reports one candidate
- **THEN** the section shows only the Discovered group

#### Scenario: Search covers the section
- **WHEN** the user searches `beta` with `beta-soc` tracked and `beta-tools` discovered
- **THEN** the tracked list shows `beta-soc` and the section shows only `beta-tools`

#### Scenario: Work in progress filter
- **WHEN** the user turns the Work in progress filter on
- **THEN** the Untracked & disabled section is not shown

#### Scenario: Second clone flagged
- **WHEN** `pkg-tools` is tracked and the candidate `ops/repo-mirror/repos/pkg-tools` has the same `origin`
- **THEN** the candidate shows the path hint `ops/repo-mirror/repos` and a badge naming `pkg-tools`, and can still be enabled

### Requirement: Discovery runs from the overview
The overview SHALL run discovery against the saved workspace roots and ignore paths when it is opened and the configuration has at least one workspace root, after every Enable or Ignore it performs, and when the user activates **Rediscover** in the Untracked & disabled section. While a run is in progress the section SHALL say so and keep showing the previous result, if any; only the latest run's result SHALL be applied. Per-root errors SHALL be shown in the section with a link to the Workspace roots section of Settings. With no workspace root configured, the section SHALL show the disabled repositories, if any, and a hint with a link to the Workspace roots section of Settings in place of the two discovered groups, and SHALL make no discovery request. Discovery MUST NOT run on a timer, during a scan or from any other view as a side effect of the overview.

#### Scenario: Opening the overview
- **WHEN** the user opens `/` and the config has one workspace root holding an untracked OpenSpec repository
- **THEN** discovery runs without any further action and the repository appears under Discovered

#### Scenario: No roots yet
- **WHEN** the config has no workspace roots
- **THEN** no discovery request is made and the section links to the Workspace roots settings

#### Scenario: A root that is gone
- **WHEN** a saved workspace root no longer exists
- **THEN** the section names that root with its error and a link to the Workspace roots settings, and lists what the other roots hold

#### Scenario: Rediscover
- **WHEN** the user creates a new OpenSpec project under a workspace root and activates Rediscover
- **THEN** the new project appears under Discovered

### Requirement: Repositories are enabled, disabled and ignored from the overview
Each entry under Disabled and Discovered SHALL offer **Enable**. Each entry under Discovered and Without OpenSpec SHALL offer **Ignore**. Each tracked repository on the overview, as a row and as a tile, SHALL offer **Disable**. These actions SHALL take effect when activated, persisting the configuration without a separate save and without a confirmation: Enable on a disabled repository sets it enabled, keeping its name; Enable on a discovered repository adds it to the configuration with `enabled: true` and its default name, disambiguated as for any enabled candidate; Disable sets the repository's `enabled: false`, keeping its name; Ignore adds the entry's path to the ignore paths. After Enable or Disable the repository SHALL move between the tracked list and the section at once, without waiting for a scan. While an action is in progress its control SHALL show that it is working and SHALL not be activatable again; when it fails the reason SHALL be shown on that entry and the overview SHALL be unchanged. Activating a row's or tile's Disable MUST NOT open the repository's board.

#### Scenario: Enabling a discovered repository
- **WHEN** the user activates Enable on the discovered repository `beta-soc`
- **THEN** the configuration contains `beta-soc` with `enabled: true` without the user pressing any Save, `beta-soc` is shown in the tracked list as `Scanning…`, and a scan starts

#### Scenario: Re-enabling a disabled repository
- **WHEN** the user activates Enable on the disabled repository renamed "Beta SOC"
- **THEN** it is enabled with the name "Beta SOC" and moves to the tracked list

#### Scenario: Disabling a tracked repository
- **WHEN** the user activates Disable on the row of `demo-agent`
- **THEN** `demo-agent` stays in the configuration with `enabled: false` and its name, leaves the tracked list, is listed under Disabled, and the repository board is not opened

#### Scenario: Ignoring a discovered repository
- **WHEN** the user activates Ignore on the discovered repository `/w/mirror/beta-soc`
- **THEN** `/w/mirror/beta-soc` is added to the saved ignore paths, discovery runs again, and the entry is gone

#### Scenario: The update is refused
- **WHEN** the user activates Enable and the server refuses the request
- **THEN** the entry shows the reason and stays where it was

### Requirement: Repositories without OpenSpec are integrated from the overview
Each entry under Without OpenSpec SHALL offer **Integrate**, with the behaviour, the in-place warning and the unavailable reasons the `repo-integration` capability defines. While an integration session for the entry's folder runs, the entry SHALL offer **Setting up…** instead, which shows that session. When integration is unavailable, the section SHALL state the reason once, and the entries SHALL still be listed. When the agent cannot be started, the reason SHALL be shown on that entry. Once the repository is added to the configuration it SHALL leave the section and appear in the tracked list.

#### Scenario: Integrating from the overview
- **WHEN** agent sessions are on and the user activates Integrate on `chat-groups`
- **THEN** the integration session's terminal is shown, and while it runs the entry offers Setting up…

#### Scenario: Integration confirmed
- **WHEN** the integration of `chat-groups` ends with `openspec/config.yaml` in its folder
- **THEN** `chat-groups` is no longer under Without OpenSpec and is shown in the tracked list

#### Scenario: Agent sessions off
- **WHEN** agent sessions are disabled
- **THEN** the Without OpenSpec entries are listed, Integrate is inactive on each, and the section says that agent sessions are off
