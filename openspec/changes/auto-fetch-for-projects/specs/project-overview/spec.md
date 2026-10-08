# Spec Delta

## MODIFIED Requirements

### Requirement: Each managed project carries its own settings on the overview
Each managed project on the projects overview, as a table row and as a tile, SHALL offer the settings that belong to that one project, each taking effect when changed: the configuration is persisted without a separate save and without a confirmation, and the overview reflects it at once, without waiting for a scan. The settings are:

- **Agent sessions**: a toggle whose state reads **Enabled** or **Disabled**, exposed to assistive technology as a switch with the project's name in its accessible name. A project without a saved agent-session setting SHALL show **Enabled**. While agent sessions are switched off globally, the toggle SHALL still show the project's own setting but SHALL be inactive, and SHALL say that agent sessions are off with a link to the Agent sessions section of Settings.
- **Agent**: a picker offering "default agent" and every configured agent profile by name, showing the project's current choice. It SHALL be shown only when more than one agent profile is configured and the project's agent sessions are enabled. Choosing "default agent" SHALL clear the project's own choice.
- **Auto-merge docs-only pull requests**: a toggle whose state reads **On** or **Off**, exposed to assistive technology as a switch with the project's name in its accessible name, and explained in a tooltip: when on, Ship and Archive ask the agent to enable auto-merge on a pull request whose changes are all under `openspec/`, and on no other, and once such a pull request has merged the dashboard ends that session and removes its worktree when that is safe. A project without a saved setting SHALL show **Off**. It SHALL be shown only while the project's agent sessions are enabled and the project is a git repository; while agent sessions are switched off globally it SHALL be shown inactive, like the agent-session toggle.
- **PR titles**: a picker offering **No convention** and **Conventional Commits**, showing the project's current choice, with an accessible name that includes the project's name and a tooltip saying that Ship asks the agent to title its pull requests this way. It SHALL be shown only for a project that is a git repository. Choosing **No convention** SHALL clear the project's convention. The setting is used by Ship, as the `agent-sessions` capability specifies; while agent sessions are switched off globally or for the project, the picker SHALL still show and change the project's own setting.
- **Auto fetch**: a drop-down offering **Off**, **Every 5 minutes**, **Every 15 minutes**, **Every 30 minutes** and **Every hour**, showing the project's current choice, with an accessible name that includes the project's name and a tooltip saying that the dashboard then fetches the project's remote on that interval so merged branches and conflicts stay current, that it only fetches and never updates the checkout — that stays the Pull action — and that it uses git's own credentials without prompting. A project without a saved setting SHALL show **Off**; choosing **Off** SHALL clear the project's setting. It SHALL be shown only for a project that is a git repository, and SHALL be shown whether agent sessions are on or off: it describes the project, not its sessions. What the setting does is specified in the `repository-pull` capability.
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
- **THEN** the tooltip says that Ship and Archive ask the agent to enable auto-merge only on a pull request whose changes are all under `openspec/`, and that once it has merged the session is ended and its worktree removed when that is safe

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
- **THEN** the panel lists Agent sessions, Agent, PR titles, Docs auto-merge, Auto fetch and Labels as labelled lines, followed by Disable, and the board is not opened

#### Scenario: Switching auto fetch on
- **WHEN** the user picks **Every 15 minutes** under Auto fetch on the row of `demo-ops`
- **THEN** the configuration has `autoFetchMinutes: 15` for `demo-ops` without any Save, the drop-down shows Every 15 minutes, its other settings are unchanged, no scan is started by the setting itself, and the board is not opened

#### Scenario: Switching auto fetch off
- **WHEN** the user picks **Off** under Auto fetch for a project that fetches every 15 minutes
- **THEN** the project's entry no longer carries `autoFetchMinutes`

#### Scenario: Auto fetch is off by default
- **WHEN** a project has no saved auto-fetch setting
- **THEN** its Auto fetch drop-down shows Off

#### Scenario: Auto fetch with agent sessions off
- **WHEN** agent sessions are switched off in Settings
- **THEN** every git project still shows its Auto fetch drop-down, and it can be changed

#### Scenario: No auto fetch without git
- **WHEN** a managed project is a folder that is not a git repository
- **THEN** its row and tile show no Auto fetch drop-down

## ADDED Requirements

### Requirement: A project shows when it was last fetched
For a managed git repository the projects overview row and tile, and the repository board header, SHALL show beside the Pull control how long ago the repository was last fetched, as a relative age (for example `fetched 4m ago`), with the exact time in a tooltip. The time SHALL be read from the repository itself, so a fetch the user ran outside the dashboard counts as well, and SHALL be read without writing anything. A repository that was never fetched SHALL show `never fetched`; a repository without a remote, and a folder without git, SHALL show nothing. When the project has auto fetch on, the note SHALL also say so and at which interval. When the most recent automatic fetch of the project failed, the note SHALL say that auto fetch failed, in a warning tone that is not conveyed by colour alone, with the reason, credentials masked, in its tooltip; the next successful fetch, automatic or by Pull, SHALL clear it. The note SHALL update from the rescan that follows a fetch, without a page reload.

#### Scenario: Recently fetched
- **WHEN** `demo-ops` has auto fetch every 15 minutes and its last fetch was 4 minutes ago
- **THEN** its row shows `fetched 4m ago` beside Pull, and the tooltip gives the exact time and says it is fetched every 15 minutes

#### Scenario: Fetched outside the dashboard
- **WHEN** the user runs `git fetch` in a terminal for `alpha-infra`, which has auto fetch off, and the overview rescans
- **THEN** its row shows that it was fetched moments ago

#### Scenario: Automatic fetch failed
- **WHEN** the last automatic fetch of `demo-ops` failed because the remote could not be reached
- **THEN** its row shows that auto fetch failed, with the reason in the tooltip, and after a successful Pull the warning is gone

#### Scenario: No remote
- **WHEN** a git repository has no remote configured
- **THEN** its row shows no fetch note
