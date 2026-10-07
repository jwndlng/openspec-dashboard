# Spec Delta

## MODIFIED Requirements

### Requirement: Tiles have one size and one layout
In the tiles layout every tile SHALL have the same width and the same height, whatever its repository holds, and SHALL place its parts in the same positions, in fixed zones that each hold one kind of content, top to bottom:

1. **Identity**: the repository's monogram in its repository colour, its name with the path hint and the rename action, and the last-updated age. The identity zone SHALL hold no other action.
2. **Status**: one badge area holding, in this order, the scan failure, the off-default-branch notice, the work-in-progress indicator, the shared-config profiles and the labels. When the badges do not fit their area, that area SHALL scroll within the tile, keeping every badge reachable, instead of growing the tile; an empty status area SHALL keep its space.
3. **Figures**: the open total, the to-archive total and the open pull request figure, side by side as three figures of the same style, each with its label below or beside its number.
4. **Checkouts**: the checkout summary, on one line.
5. **Footer**: the tile's actions — **Console**, then **Pull** for a git repository whose last scan succeeded, and the project's **settings button** at the end.

A tile MUST NOT show the number of changes per board stage. A tile whose repository has no open changes SHALL keep the same size and show "no open changes" where the open and to-archive figures would be, keeping its open pull request figure.

The settings button SHALL open the project's settings dialog, as the "Each managed project carries its own settings on the overview" requirement describes. The tile SHALL hold no settings panel of its own, and opening, using or closing the dialog SHALL NOT change the size of any tile or move it. Activating the settings button MUST NOT open the repository's board. A pending `Scanning…` tile SHALL show no footer actions.

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
- **WHEN** the user activates the settings button at the end of the footer of the `demo-ops` tile, then presses Escape
- **THEN** the settings dialog of `demo-ops` opens, no tile changes size or moves, and the board is not opened; Escape closes the dialog and focus returns to that settings button

#### Scenario: One panel at a time
- **WHEN** the settings dialog of `demo-ops` is open
- **THEN** the page behind it is dimmed and takes no clicks, so no other tile's settings can be opened until it is closed, and at most one settings dialog is ever open

#### Scenario: Disabling from the panel
- **WHEN** the user opens the settings dialog of `demo-agent` from its tile and activates Disable
- **THEN** `demo-agent` leaves Managed projects as the "Repositories are enabled, disabled and ignored from the overview" requirement describes, the dialog closes, and the board is not opened

#### Scenario: No panel on the tile
- **WHEN** the user looks at the tile of `alpha-infra`
- **THEN** its footer shows Console, Pull and the settings button, and no agent-session switch, picker, Labels or Disable is shown on the tile itself

### Requirement: Repositories are enabled, disabled and ignored from the overview
Each unmanaged entry SHALL offer the actions that fit what it is: a disabled repository **Enable**; a candidate **Enable** and **Ignore**; an integratable repository **Integrate** and **Ignore**. Each tracked repository on the overview, as a row and as a tile, SHALL offer **Disable** in its project settings dialog (see "Each managed project carries its own settings on the overview"), set apart after the project's settings. These actions SHALL take effect when activated, persisting the configuration without a separate save and without a confirmation: Enable on a disabled repository sets it enabled, keeping its name; Enable on a discovered repository adds it to the configuration with `enabled: true` and its default name, disambiguated as for any enabled candidate; Disable sets the repository's `enabled: false`, keeping its name; Ignore adds the entry's path to the ignore paths. After Enable or Disable the repository SHALL move between the two sections at once, without waiting for a scan. While an action is in progress its control SHALL show that it is working and SHALL not be activatable again; when it fails the reason SHALL be shown on that entry and the overview SHALL be unchanged. Activating Disable MUST NOT open the repository's board. Once the repository has been disabled, its settings dialog SHALL close; when Disable fails, the dialog SHALL stay open and show the reason.

#### Scenario: Enabling a discovered repository
- **WHEN** the user activates Enable on the discovered repository `beta-soc`
- **THEN** the configuration contains `beta-soc` with `enabled: true` without the user pressing any Save, `beta-soc` is shown under Managed projects as `Scanning…`, and a scan starts

#### Scenario: Re-enabling a disabled repository
- **WHEN** the user activates Enable on the disabled repository renamed "Beta SOC"
- **THEN** it is enabled with the name "Beta SOC" and moves to Managed projects

#### Scenario: Disabling a tracked repository
- **WHEN** the user opens the settings dialog of `demo-agent` from its row and activates Disable
- **THEN** `demo-agent` stays in the configuration with `enabled: false` and its name, leaves Managed projects, is listed under Unmanaged projects labelled `disabled`, the dialog closes, and the repository board is not opened

#### Scenario: Ignoring a discovered repository
- **WHEN** the user activates Ignore on the discovered repository `/w/mirror/beta-soc`
- **THEN** `/w/mirror/beta-soc` is added to the saved ignore paths, discovery runs again, and the entry is gone

#### Scenario: The update is refused
- **WHEN** the user activates Enable and the server refuses the request
- **THEN** the entry shows the reason and stays where it was

### Requirement: Each managed project carries its own settings on the overview
Each managed project on the projects overview, as a table row and as a tile, SHALL offer the settings that belong to that one project, each taking effect when changed: the configuration is persisted without a separate save and without a confirmation, and the overview reflects it at once, without waiting for a scan. Except for Rename, the settings SHALL be offered in the project's **settings dialog**, described below, and not on the row or the tile. The settings are:

- **Agent sessions**: a toggle whose state reads **Enabled** or **Disabled**, exposed to assistive technology as a switch with the project's name in its accessible name. A project without a saved agent-session setting SHALL show **Enabled**. While agent sessions are switched off globally, the toggle SHALL still show the project's own setting but SHALL be inactive, and SHALL say that agent sessions are off with a link to the Agent sessions section of Settings.
- **Agent**: a picker offering "default agent" and every configured agent profile by name, showing the project's current choice. It SHALL be shown only when more than one agent profile is configured and the project's agent sessions are enabled. Choosing "default agent" SHALL clear the project's own choice.
- **PR titles**: a picker offering **No convention** and **Conventional Commits**, showing the project's current choice, with an accessible name that includes the project's name and a tooltip saying that Ship asks the agent to title its pull requests this way. It SHALL be shown only for a project that is a git repository. Choosing **No convention** SHALL clear the project's convention. The setting is used by Ship, as the `agent-sessions` capability specifies; while agent sessions are switched off globally or for the project, the picker SHALL still show and change the project's own setting.
- **Auto-merge docs-only pull requests**: a toggle whose state reads **On** or **Off**, exposed to assistive technology as a switch with the project's name in its accessible name, and explained in a tooltip: when on, Ship and Archive ask the agent to enable auto-merge on a pull request whose changes are all under `openspec/`, and on no other, and once such a pull request has merged the dashboard ends that session and removes its worktree when that is safe. A project without a saved setting SHALL show **Off**. It SHALL be shown only while the project's agent sessions are enabled and the project is a git repository; while agent sessions are switched off globally it SHALL be shown inactive, like the agent-session toggle.
- **Rename**: an action beside the project's name, on the row and the tile, that turns the project's name into a text field in place, prefilled with the current name. Pressing Enter or moving focus out of the field SHALL save the trimmed name; pressing Escape SHALL leave the name unchanged. A name that is empty after trimming MUST NOT be saved, and the field SHALL say why. An unchanged name SHALL be saved without a request. The new name SHALL be shown on the overview, on the repository's board and in the board's repository groups at once.
- **Labels**: an action that replaces the settings dialog with the project's labels dialog, as the `project-labels` capability specifies.

While a setting is being saved its control SHALL show that it is working and SHALL not be activatable again; when saving fails the reason SHALL be shown on that project, and in its settings dialog while that is open, and the setting SHALL show its previous value. Activating any of these controls, or typing in the rename field, MUST NOT open the repository's board. A pending `Scanning…` entry SHALL offer none of these settings and no settings button.

Each managed row and tile SHALL show a **settings button**: an icon button whose accessible name and tooltip say that it opens the project's settings and include the project's name. On a row it SHALL sit in the row's actions, after **Console** and **Pull**; on a tile, at the end of the footer (see "Tiles have one size and one layout"). The table SHALL have no column for agent sessions or any other setting, and a row SHALL show none of the settings above except Rename, and neither Labels nor Disable.

Activating the settings button SHALL open the project's settings dialog over the dimmed page, titled with the word Settings and the project's name, with an accessible name that includes the project's name. Rows and tiles SHALL open the same dialog. It SHALL hold one labelled line per setting, in this order: **Agent sessions**, **Agent**, **PR titles** and **Docs auto-merge**. Then **Labels**, and then **Disable**, which SHALL be set apart after the settings as the "Repositories are enabled, disabled and ignored from the overview" requirement describes. Each control SHALL keep the behaviour, wording, accessible name, switch role, tooltip and visibility rules described above. A setting that does not apply to the project SHALL leave no line. The Docs auto-merge switch's visible text MAY read just **On** or **Off**, because its line names the setting. A change in the dialog SHALL be reflected in the dialog at once, without closing it. At most one dialog SHALL be open at a time.

The dialog SHALL close when the user presses Escape, activates its close control or clicks the backdrop, and when the project leaves Managed projects. When it closes, keyboard focus SHALL return to the settings button that opened it, if that button is still on the page. Opening, using or closing the dialog MUST NOT open the repository's board or change the route.

#### Scenario: Switching a project off for agent sessions
- **WHEN** agent sessions are on and the user switches the Agent sessions toggle in the settings dialog of `alpha-infra` to Disabled
- **THEN** the configuration has agent sessions switched off for `alpha-infra` without any Save, the toggle reads Disabled, the cards of `alpha-infra` show no session starter, and the board is not opened

#### Scenario: Projects are enabled by default
- **WHEN** agent sessions are on and a project was enabled on the overview a moment ago
- **THEN** its toggle reads Enabled and its cards offer session starters

#### Scenario: Sessions are off globally
- **WHEN** agent sessions are switched off in Settings
- **THEN** in every project's settings dialog the toggle shows the project's own setting, is inactive, says that agent sessions are off and links to the Agent sessions section of Settings

#### Scenario: Allowing docs-only pull requests to merge
- **WHEN** agent sessions are on and the user switches **Docs auto-merge** in the settings dialog of `demo-ops`, opened from its tile, to On
- **THEN** the configuration has `autoMergeDocs: true` for `demo-ops` without any Save, the toggle reads On, its other agent settings are unchanged, and the board is not opened

#### Scenario: The tooltip names Ship and Archive
- **WHEN** the user hovers over the **Docs auto-merge** switch in the settings dialog of `demo-ops`
- **THEN** the tooltip says that Ship and Archive ask the agent to enable auto-merge only on a pull request whose changes are all under `openspec/`, and that once it has merged the session is ended and its worktree removed when that is safe

#### Scenario: Auto-merge is off by default
- **WHEN** agent sessions are on and a project has no saved auto-merge setting
- **THEN** its auto-merge toggle reads Off

#### Scenario: No auto-merge toggle without agent sessions or git
- **WHEN** a project's agent sessions are switched to Disabled, or the project is a folder without git
- **THEN** its settings dialog shows no Docs auto-merge line

#### Scenario: Choosing an agent
- **WHEN** two agent profiles are configured and the user picks `my-agent` in the settings dialog of `demo-ops`
- **THEN** the configuration has `my-agent` for `demo-ops` without any Save, and Implement on a `demo-ops` card starts `my-agent`

#### Scenario: One agent configured
- **WHEN** only one agent profile is configured
- **THEN** no project's settings dialog shows an Agent line

#### Scenario: Choosing Conventional Commits for pull request titles
- **WHEN** the user picks **Conventional Commits** under PR titles in the settings dialog of `demo-ops`
- **THEN** the configuration has `prTitleConvention: conventional-commits` for `demo-ops` without any Save, the picker shows Conventional Commits, no scan is started, and the board is not opened

#### Scenario: Clearing the convention
- **WHEN** the user picks **No convention** for a project that has Conventional Commits
- **THEN** the project's entry no longer carries `prTitleConvention`

#### Scenario: A folder without git
- **WHEN** a managed project is a folder that is not a git repository
- **THEN** its settings dialog shows no PR titles line

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
- **THEN** the settings dialog and the project show the reason, and the toggle reads Enabled again

#### Scenario: Settings on a tile
- **WHEN** agent sessions are on, two agent profiles are configured, and the user activates the settings button on the tile of `demo-ops`, a git repository
- **THEN** the settings dialog of `demo-ops` lists Agent sessions, Agent, PR titles, Docs auto-merge and Labels as labelled lines, followed by Disable set apart, and the board is not opened

#### Scenario: The same dialog from a row
- **WHEN** the user activates the settings button on the row of `demo-ops`
- **THEN** the same settings dialog of `demo-ops` opens, with the same lines as from its tile, and the route is unchanged

#### Scenario: A row without inline settings
- **WHEN** agent sessions are on and the overview shows the table
- **THEN** the table has no Agent sessions column, and the row of `alpha-infra` shows its name with Rename, its figures, and Console, Pull and the settings button as its actions, with no switch, picker, Labels or Disable

#### Scenario: The settings button names the project
- **WHEN** a screen reader user reaches the settings button on the row of `alpha-infra`
- **THEN** its accessible name includes `alpha-infra`, and the dialog it opens has an accessible name that includes `alpha-infra`

#### Scenario: Escape returns focus
- **WHEN** the user opens the settings dialog of `alpha-infra` from its row with the keyboard, switches Docs auto-merge, and presses Escape
- **THEN** the dialog closes, the change stays saved, focus is on the settings button of `alpha-infra`, and the board is not opened

#### Scenario: Off globally inside the dialog
- **WHEN** agent sessions are switched off in Settings and the user opens the settings dialog of `alpha-infra`
- **THEN** the Agent sessions line shows the project's own setting as an inactive link to the Agent sessions section of Settings, and following it leaves the overview for Settings

#### Scenario: Nothing to set while scanning
- **WHEN** `beta-soc` was enabled a moment ago and is shown as `Scanning…`
- **THEN** its row and tile show no settings button
