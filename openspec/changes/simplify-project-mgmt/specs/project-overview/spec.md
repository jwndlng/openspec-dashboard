## MODIFIED Requirements

### Requirement: Projects overview is the landing page
The dashboard SHALL show a projects overview at `/` made of two sections, each under a headline with its count: **Managed projects**, listing every repository that is enabled in the configuration and present in the snapshot, one row per repository, followed by **Unmanaged projects**. A repository that is disabled or removed in the configuration SHALL disappear from Managed projects, the combined board, the repository boards and the top-bar error indicators as soon as the configuration is saved, without waiting for the next scan, even while the snapshot still contains it. A repository that is enabled in the configuration but not yet in the snapshot SHALL be listed under Managed projects as a pending entry showing its name and the text `Scanning…`, with no counts, until a snapshot containing it arrives. When no repository is enabled, the Managed projects headline SHALL be followed by an empty state saying that no repositories are tracked yet and pointing to the section below, and the Unmanaged projects section SHALL still be shown. The combined all-repositories board SHALL remain available at `/board`. The top bar SHALL offer navigation to the overview, the combined board and settings, and SHALL mark the overview entry as active on `/` and on any repository board.

#### Scenario: Opening the dashboard
- **WHEN** the user opens `/` with 17 tracked repositories
- **THEN** the headline `Managed projects · 17` and 17 repository rows are shown instead of the combined board, followed by the Unmanaged projects section

#### Scenario: Repository disabled in Settings
- **WHEN** the user disables `demo-agent` in Settings, saves, and opens the overview before the next scan has finished
- **THEN** `demo-agent` is not under Managed projects, it is listed under Unmanaged projects labelled as disabled, and opening its `/repo/<id>` URL shows "repository not found"

#### Scenario: Combined board still reachable
- **WHEN** the user opens `/board?q=terraform`
- **THEN** the combined board is shown with the search filter `terraform` applied

#### Scenario: No repositories tracked
- **WHEN** the snapshot contains no repositories and none are enabled in the config
- **THEN** the overview shows the "No repositories tracked yet" empty state under the Managed projects headline and, below it, the Unmanaged projects section

#### Scenario: A repository enabled a moment ago
- **WHEN** the user enables `alpha-infra` and the scan that includes it has not finished
- **THEN** Managed projects shows `alpha-infra` with `Scanning…` and no counts, and once the scan finishes the entry shows its counts like every other row

## ADDED Requirements

### Requirement: The overview lists unmanaged projects in one list
Below the managed projects the projects overview SHALL show a section under the headline **Unmanaged projects** with the number of projects it lists. It SHALL list, in one list ordered by name, then path, whatever kind each entry is: repositories in the configuration with `enabled: false`, repositories the latest discovery run reported as candidates, and repositories the latest discovery run reported as integratable. Each entry SHALL show the repository's name, a label saying in words what it is — `disabled`, `OpenSpec` (a candidate) or `no OpenSpec` (integratable) — with a tooltip explaining it, its path, the same-name path hint when its name collides with any other repository listed anywhere on the overview, and, for a candidate that shares its `origin` remote with other known repositories, a badge naming them whose tooltip lists their paths. The section SHALL NOT be split into groups or sub-headings. It SHALL be laid out the same in the `Table` and `Tiles` layouts. The overview's search SHALL filter the section by the same rule as the managed projects, and the Work in progress filter SHALL hide the whole section. The section MUST NOT show counts, work in progress or pull requests for its entries, and it MUST NOT offer any action on a checkout.

#### Scenario: One list
- **WHEN** `demo-agent` is configured and disabled, discovery reports the candidate `beta-soc` and the integratable repository `chat-groups`
- **THEN** the headline reads `Unmanaged projects · 3` and one list shows `beta-soc` labelled `OpenSpec`, `chat-groups` labelled `no OpenSpec` and `demo-agent` labelled `disabled`, in that order, with no sub-headings

#### Scenario: Search covers the section
- **WHEN** the user searches `beta` with `beta-soc` managed and `beta-tools` discovered
- **THEN** the managed projects show `beta-soc` and the unmanaged projects show only `beta-tools`

#### Scenario: Work in progress filter
- **WHEN** the user turns the Work in progress filter on
- **THEN** the Unmanaged projects section is not shown

#### Scenario: Second clone flagged
- **WHEN** `pkg-tools` is managed and the candidate `ops/repo-mirror/repos/pkg-tools` has the same `origin`
- **THEN** the candidate shows the path hint `ops/repo-mirror/repos` and a badge naming `pkg-tools`, and can still be enabled

### Requirement: Discovery runs from the overview
The overview SHALL run discovery against the saved workspace roots and ignore paths when it is opened and the configuration has at least one workspace root, after every Enable or Ignore it performs, and when the user activates **Rediscover** beside the Unmanaged projects headline. While a run is in progress the section SHALL say so and keep showing the previous result, if any; only the latest run's result SHALL be applied. Per-root errors SHALL be shown in the section with a link to the Workspace roots section of Settings. With no workspace root configured, the section SHALL list the disabled repositories, if any, and a hint with a link to the Workspace roots section of Settings, and SHALL make no discovery request. Discovery MUST NOT run on a timer, during a scan or from any other view as a side effect of the overview.

#### Scenario: Opening the overview
- **WHEN** the user opens `/` and the config has one workspace root holding an untracked OpenSpec repository
- **THEN** discovery runs without any further action and the repository appears under Unmanaged projects, labelled `OpenSpec`

#### Scenario: No roots yet
- **WHEN** the config has no workspace roots
- **THEN** no discovery request is made and the section links to the Workspace roots settings

#### Scenario: A root that is gone
- **WHEN** a saved workspace root no longer exists
- **THEN** the section names that root with its error and a link to the Workspace roots settings, and lists what the other roots hold

#### Scenario: Rediscover
- **WHEN** the user creates a new OpenSpec project under a workspace root and activates Rediscover
- **THEN** the new project appears under Unmanaged projects

### Requirement: Repositories are enabled, disabled and ignored from the overview
Each unmanaged entry SHALL offer the actions that fit what it is: a disabled repository **Enable**; a candidate **Enable** and **Ignore**; an integratable repository **Integrate** and **Ignore**. Each tracked repository on the overview, as a row and as a tile, SHALL offer **Disable**. These actions SHALL take effect when activated, persisting the configuration without a separate save and without a confirmation: Enable on a disabled repository sets it enabled, keeping its name; Enable on a discovered repository adds it to the configuration with `enabled: true` and its default name, disambiguated as for any enabled candidate; Disable sets the repository's `enabled: false`, keeping its name; Ignore adds the entry's path to the ignore paths. After Enable or Disable the repository SHALL move between the two sections at once, without waiting for a scan. While an action is in progress its control SHALL show that it is working and SHALL not be activatable again; when it fails the reason SHALL be shown on that entry and the overview SHALL be unchanged. Activating a row's or tile's Disable MUST NOT open the repository's board.

#### Scenario: Enabling a discovered repository
- **WHEN** the user activates Enable on the discovered repository `beta-soc`
- **THEN** the configuration contains `beta-soc` with `enabled: true` without the user pressing any Save, `beta-soc` is shown under Managed projects as `Scanning…`, and a scan starts

#### Scenario: Re-enabling a disabled repository
- **WHEN** the user activates Enable on the disabled repository renamed "Beta SOC"
- **THEN** it is enabled with the name "Beta SOC" and moves to Managed projects

#### Scenario: Disabling a tracked repository
- **WHEN** the user activates Disable on the row of `demo-agent`
- **THEN** `demo-agent` stays in the configuration with `enabled: false` and its name, leaves Managed projects, is listed under Unmanaged projects labelled `disabled`, and the repository board is not opened

#### Scenario: Ignoring a discovered repository
- **WHEN** the user activates Ignore on the discovered repository `/w/mirror/beta-soc`
- **THEN** `/w/mirror/beta-soc` is added to the saved ignore paths, discovery runs again, and the entry is gone

#### Scenario: The update is refused
- **WHEN** the user activates Enable and the server refuses the request
- **THEN** the entry shows the reason and stays where it was

### Requirement: Repositories without OpenSpec are integrated from the overview
Each unmanaged entry labelled `no OpenSpec` SHALL offer **Integrate**, with the behaviour, the in-place warning and the unavailable reasons the `repo-integration` capability defines. While an integration session for the entry's folder runs, the entry SHALL offer **Setting up…** instead, which shows that session. When integration is unavailable, the section SHALL state the reason once, and the entries SHALL still be listed. When the agent cannot be started, the reason SHALL be shown on that entry. Once the repository is added to the configuration it SHALL leave Unmanaged projects and appear under Managed projects.

#### Scenario: Integrating from the overview
- **WHEN** agent sessions are on and the user activates Integrate on `chat-groups`
- **THEN** the integration session's terminal is shown, and while it runs the entry offers Setting up…

#### Scenario: Integration confirmed
- **WHEN** the integration of `chat-groups` ends with `openspec/config.yaml` in its folder
- **THEN** `chat-groups` is no longer under Unmanaged projects and is shown under Managed projects

#### Scenario: Agent sessions off
- **WHEN** agent sessions are disabled
- **THEN** the `no OpenSpec` entries are listed, Integrate is inactive on each, and the section says that agent sessions are off
