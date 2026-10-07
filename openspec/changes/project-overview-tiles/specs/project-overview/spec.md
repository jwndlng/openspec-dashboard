# Delta for project-overview

## MODIFIED Requirements

### Requirement: Tiles have one size and one layout
In the tiles layout every tile SHALL have the same width and the same height, whatever its repository holds, and SHALL place its parts in the same positions, in fixed zones that each hold one kind of content, top to bottom:

1. **Identity**: the repository's monogram in its repository colour, its name with the path hint and the rename action, and the last-updated age. The identity zone SHALL hold no other action.
2. **Status**: one badge area holding, in this order, the scan failure, the off-default-branch notice, the work-in-progress indicator, the shared-config profiles and the labels. When the badges do not fit their area, that area SHALL scroll within the tile, keeping every badge reachable, instead of growing the tile; an empty status area SHALL keep its space.
3. **Figures**: the open total, the to-archive total and the open pull request figure, side by side as three figures of the same style, each with its label below or beside its number.
4. **Checkouts**: the checkout summary, on one line.
5. **Footer**: the tile's actions — **Console**, then **Pull** for a git repository whose last scan succeeded, and **Settings** at the end.

A tile MUST NOT show the number of changes per board stage. A tile whose repository has no open changes SHALL keep the same size and show "no open changes" where the open and to-archive figures would be, keeping its open pull request figure.

**Settings** SHALL be a disclosure that marks whether it is open. Opening it SHALL show the project's own settings and **Disable**, as the "Each managed project carries its own settings on the overview" requirement describes, in a panel laid over the tile without changing the tile's size or moving any other tile. The panel SHALL close when Settings is activated again, when the user presses Escape, when the user clicks outside it, and when another tile's Settings opens; at most one panel SHALL be open at a time. Opening, using or closing the panel MUST NOT open the repository's board. A pending `Scanning…` tile SHALL show no footer actions.

Everything the "Overview offers a table and a tiles layout" requirement lists for a tile SHALL still be shown.

#### Scenario: Uneven repositories
- **WHEN** `alpha-infra` has five worktrees and three config profiles and `quill-docs` has no worktree and no open change
- **THEN** both tiles have the same height, `quill-docs` shows "no open changes" in place of its open and to-archive figures, and `alpha-infra` reads `5 worktrees · 5 branches active` rather than listing them

#### Scenario: Grid reflows
- **WHEN** the window narrows
- **THEN** the tiles reflow to fewer per row, keep equal sizes, and the page does not scroll horizontally

#### Scenario: Same places on every tile
- **WHEN** `alpha-infra` is a git repository with agent sessions enabled and `notes-folder` is a folder without git
- **THEN** on both tiles the name, the badges, the figures, the checkout summary and the footer sit at the same heights, the identity zone holds no button, and only `alpha-infra`'s footer offers Pull

#### Scenario: Pull requests among the figures
- **WHEN** the cached list of `alpha-infra` has 3 open pull requests
- **THEN** its tile shows `3` labelled as open pull requests beside the open and to-archive figures, linking to `/pull-requests?repo=<id of alpha-infra>`

#### Scenario: Opening and closing Settings
- **WHEN** the user activates Settings on the tile of `demo-ops`
- **THEN** its settings panel is shown over the tile, Settings is marked open, no tile changes size and the board is not opened; pressing Escape closes the panel

#### Scenario: One panel at a time
- **WHEN** the settings panel of `demo-ops` is open and the user activates Settings on the tile of `alpha-infra`
- **THEN** the panel of `demo-ops` closes and that of `alpha-infra` opens

#### Scenario: Disabling from the panel
- **WHEN** the user opens Settings on the tile of `demo-agent` and activates Disable
- **THEN** `demo-agent` leaves Managed projects as the "Repositories are enabled, disabled and ignored from the overview" requirement describes, and the board is not opened

### Requirement: Each managed project carries its own settings on the overview
Each managed project on the projects overview, as a table row and as a tile, SHALL offer the settings that belong to that one project, each taking effect when changed: the configuration is persisted without a separate save and without a confirmation, and the overview reflects it at once, without waiting for a scan. The settings are:

- **Agent sessions**: a toggle whose state reads **Enabled** or **Disabled**, exposed to assistive technology as a switch with the project's name in its accessible name. A project without a saved agent-session setting SHALL show **Enabled**. While agent sessions are switched off globally, the toggle SHALL still show the project's own setting but SHALL be inactive, and SHALL say that agent sessions are off with a link to the Agent sessions section of Settings.
- **Agent**: a picker offering "default agent" and every configured agent profile by name, showing the project's current choice. It SHALL be shown only when more than one agent profile is configured and the project's agent sessions are enabled. Choosing "default agent" SHALL clear the project's own choice.
- **Auto-merge docs-only pull requests**: a toggle whose state reads **On** or **Off**, exposed to assistive technology as a switch with the project's name in its accessible name, and explained in a tooltip: when on, Ship and Archive ask the agent to enable auto-merge on a pull request whose changes are all under `openspec/`, and on no other. A project without a saved setting SHALL show **Off**. It SHALL be shown only while the project's agent sessions are enabled and the project is a git repository; while agent sessions are switched off globally it SHALL be shown inactive, like the agent-session toggle.
- **PR titles**: a picker offering **No convention** and **Conventional Commits**, showing the project's current choice, with an accessible name that includes the project's name and a tooltip saying that Ship asks the agent to title its pull requests this way. It SHALL be shown only for a project that is a git repository. Choosing **No convention** SHALL clear the project's convention. The setting is used by Ship, as the `agent-sessions` capability specifies; while agent sessions are switched off globally or for the project, the picker SHALL still show and change the project's own setting.
- **Rename**: an action that turns the project's name into a text field in place, prefilled with the current name. Pressing Enter or moving focus out of the field SHALL save the trimmed name; pressing Escape SHALL leave the name unchanged. A name that is empty after trimming MUST NOT be saved, and the field SHALL say why. An unchanged name SHALL be saved without a request. The new name SHALL be shown on the overview, on the repository's board and in the board's repository groups at once.
- **Labels**: an action that opens the project's labels dialog, as the `project-labels` capability specifies.

While a setting is being saved its control SHALL show that it is working and SHALL not be activatable again; when saving fails the reason SHALL be shown on that project and the setting SHALL show its previous value. Activating any of these controls, or typing in the rename field, MUST NOT open the repository's board. A pending `Scanning…` entry SHALL offer none of these settings.

A row offers these settings inline. A tile SHALL offer them, together with **Disable**, in its **Settings** panel (see "Tiles have one size and one layout"): one labelled line per setting, in the order above, each control behaving exactly as on a row, with **Disable** set apart after them. A setting that is not shown on a row for the project SHALL not be shown in the panel either.

#### Scenario: Switching a project off for agent sessions
- **WHEN** agent sessions are on and the user switches the toggle on the row of `alpha-infra` to Disabled
- **THEN** the configuration has agent sessions switched off for `alpha-infra` without any Save, the toggle reads Disabled, the cards of `alpha-infra` show no session starter, and the board is not opened

#### Scenario: Projects are enabled by default
- **WHEN** agent sessions are on and a project was enabled on the overview a moment ago
- **THEN** its toggle reads Enabled and its cards offer session starters

#### Scenario: Sessions are off globally
- **WHEN** agent sessions are switched off in Settings
- **THEN** every project's toggle shows its own setting, is inactive, says that agent sessions are off and links to the Agent sessions section of Settings

#### Scenario: Allowing docs-only pull requests to merge
- **WHEN** agent sessions are on and the user switches **Auto-merge docs-only pull requests** on the tile of `demo-ops` to On
- **THEN** the configuration has `autoMergeDocs: true` for `demo-ops` without any Save, the toggle reads On, its other agent settings are unchanged, and the board is not opened

#### Scenario: The tooltip names Ship and Archive
- **WHEN** the user hovers over **Auto-merge docs-only pull requests** on the tile of `demo-ops`
- **THEN** the tooltip says that Ship and Archive ask the agent to enable auto-merge only on a pull request whose changes are all under `openspec/`

#### Scenario: Auto-merge is off by default
- **WHEN** agent sessions are on and a project has no saved auto-merge setting
- **THEN** its auto-merge toggle reads Off

#### Scenario: No auto-merge toggle without agent sessions or git
- **WHEN** a project's agent sessions are switched to Disabled, or the project is a folder without git
- **THEN** it shows no auto-merge toggle

#### Scenario: Choosing an agent
- **WHEN** two agent profiles are configured and the user picks `my-agent` on the tile of `demo-ops`
- **THEN** the configuration has `my-agent` for `demo-ops` without any Save, and Implement on a `demo-ops` card starts `my-agent`

#### Scenario: One agent configured
- **WHEN** only one agent profile is configured
- **THEN** no project shows an agent picker

#### Scenario: Choosing Conventional Commits for pull request titles
- **WHEN** the user picks **Conventional Commits** under PR titles on the tile of `demo-ops`
- **THEN** the configuration has `prTitleConvention: conventional-commits` for `demo-ops` without any Save, the picker shows Conventional Commits, no scan is started, and the board is not opened

#### Scenario: Clearing the convention
- **WHEN** the user picks **No convention** for a project that has Conventional Commits
- **THEN** the project's entry no longer carries `prTitleConvention`

#### Scenario: A folder without git
- **WHEN** a managed project is a folder that is not a git repository
- **THEN** its row and tile show no PR titles picker

#### Scenario: Renaming a project
- **WHEN** the user activates Rename on the row of `beta-soc`, types `Beta SOC` and presses Enter
- **THEN** the configuration has the name `Beta SOC` without any Save, the row and the repository's board show `Beta SOC`, and no scan was needed for it

#### Scenario: Cancelling a rename
- **WHEN** the user activates Rename, types `x` and presses Escape
- **THEN** the name is unchanged and no request is made

#### Scenario: An empty name
- **WHEN** the user clears the rename field and presses Enter
- **THEN** nothing is saved, the field stays open and says that a name is required

#### Scenario: The update is refused
- **WHEN** the user switches a project's agent sessions to Disabled and the server refuses the request
- **THEN** the project shows the reason and the toggle reads Enabled again

#### Scenario: Settings on a tile
- **WHEN** agent sessions are on, two agent profiles are configured, and the user opens **Settings** on the tile of `demo-ops`, a git repository
- **THEN** the panel lists Agent sessions, Agent, PR titles, Docs auto-merge and Labels as labelled lines, followed by Disable, and the board is not opened
