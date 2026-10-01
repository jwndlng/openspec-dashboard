## ADDED Requirements

### Requirement: Each managed project carries its own settings on the overview
Each managed project on the projects overview, as a table row and as a tile, SHALL offer the settings that belong to that one project, each taking effect when changed: the configuration is persisted without a separate save and without a confirmation, and the overview reflects it at once, without waiting for a scan. The settings are:

- **Agent sessions**: a toggle whose state reads **Enabled** or **Disabled**, exposed to assistive technology as a switch with the project's name in its accessible name. A project without a saved agent-session setting SHALL show **Enabled**. While agent sessions are switched off globally, the toggle SHALL still show the project's own setting but SHALL be inactive, and SHALL say that agent sessions are off with a link to the Agent sessions section of Settings.
- **Agent**: a picker offering "default agent" and every configured agent profile by name, showing the project's current choice. It SHALL be shown only when more than one agent profile is configured and the project's agent sessions are enabled. Choosing "default agent" SHALL clear the project's own choice.
- **Rename**: an action that turns the project's name into a text field in place, prefilled with the current name. Pressing Enter or moving focus out of the field SHALL save the trimmed name; pressing Escape SHALL leave the name unchanged. A name that is empty after trimming MUST NOT be saved, and the field SHALL say why. An unchanged name SHALL be saved without a request. The new name SHALL be shown on the overview, on the repository's board and in the board's repository groups at once.
- **Labels**: an action that opens the project's labels dialog, as the `project-labels` capability specifies.

While a setting is being saved its control SHALL show that it is working and SHALL not be activatable again; when saving fails the reason SHALL be shown on that project and the setting SHALL show its previous value. Activating any of these controls, or typing in the rename field, MUST NOT open the repository's board. A pending `Scanning…` entry SHALL offer none of these settings.

#### Scenario: Switching a project off for agent sessions
- **WHEN** agent sessions are on and the user switches the toggle on the row of `alpha-infra` to Disabled
- **THEN** the configuration has agent sessions switched off for `alpha-infra` without any Save, the toggle reads Disabled, the cards of `alpha-infra` show no session starter, and the board is not opened

#### Scenario: Projects are enabled by default
- **WHEN** agent sessions are on and a project was enabled on the overview a moment ago
- **THEN** its toggle reads Enabled and its cards offer session starters

#### Scenario: Sessions are off globally
- **WHEN** agent sessions are switched off in Settings
- **THEN** every project's toggle shows its own setting, is inactive, says that agent sessions are off and links to the Agent sessions section of Settings

#### Scenario: Choosing an agent
- **WHEN** two agent profiles are configured and the user picks `my-agent` on the tile of `demo-ops`
- **THEN** the configuration has `my-agent` for `demo-ops` without any Save, and Implement on a `demo-ops` card starts `my-agent`

#### Scenario: One agent configured
- **WHEN** only one agent profile is configured
- **THEN** no project shows an agent picker

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

### Requirement: Disabled repositories can be forgotten from the overview
Each entry under Unmanaged projects labelled `disabled` SHALL offer **Forget** beside **Enable**. Forget SHALL take effect when activated, without a separate save and without a confirmation, and SHALL remove the repository from the configuration together with its name and its agent-session settings. Its tooltip SHALL say so, and SHALL say that a repository still under a workspace root is offered again as a discovered repository. After Forget the overview SHALL run discovery again. Forget SHALL NOT be offered on discovered or integratable entries, nor on managed projects. While Forget is in progress its control SHALL show that it is working; when it fails the reason SHALL be shown on that entry and the entry SHALL stay.

#### Scenario: Forgetting a disabled repository
- **WHEN** `demo-agent` is disabled, still lies under a workspace root, and the user activates Forget on its entry
- **THEN** `demo-agent` is no longer in the configuration, without any Save, and after discovery it is listed again labelled `OpenSpec` with its default name

#### Scenario: Forgetting a repository outside the roots
- **WHEN** the user forgets a disabled repository that lies under no workspace root
- **THEN** it is gone from Unmanaged projects

#### Scenario: Only disabled entries
- **WHEN** Unmanaged projects lists a disabled, a discovered and an integratable repository
- **THEN** only the disabled one offers Forget
