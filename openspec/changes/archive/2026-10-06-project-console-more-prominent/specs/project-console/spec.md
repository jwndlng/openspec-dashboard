## MODIFIED Requirements

### Requirement: Each managed project offers a project console
While the global agent sessions setting is enabled, each managed project SHALL offer a project console control on its
projects overview row, on its tile and in its repository board header. The control SHALL be a button that shows a
terminal icon together with the visible text **Console**. Its accessible name and tooltip SHALL say that it opens that
project's console and name the project, and the accessible name SHALL contain the visible text. It MUST NOT rely on the
icon alone for its name. In the repository board header the control SHALL be placed among the board's actions, first,
ahead of the pull, cleanup and new-change actions, and MUST NOT be styled as a ghost button. That action area SHALL be
shown whenever the control is offered, also when no other action is. On the overview row and tile the control SHALL be
outlined and set apart from the project's agent settings, so that it is not read as one of them. Activating it SHALL
open the project console overlay for that project. On the overview, activating it MUST NOT open the repository's board.
While agent sessions are disabled globally, the control MUST NOT be shown. When the project's own agent sessions setting
is disabled, or the project's agent executable was not found on this machine, the control SHALL be inactive and its
tooltip and accessible name SHALL give the reason. A pending `Scanning…` entry SHALL offer no control. The control MUST
NOT depend on the project's last scan having succeeded.

#### Scenario: Offered on the overview and the board
- **WHEN** agent sessions are on and `alpha-infra` is a managed project with agent sessions enabled
- **THEN** its overview row, its tile and its board header each show a control reading **Console**, named for
  `alpha-infra`'s console

#### Scenario: Placed with the board's actions
- **WHEN** the user opens the board of the git repository `alpha-infra`, whose last scan succeeded
- **THEN** the header's action area shows **Console** first, then Pull, Clean up and New change, and the path row shows
  no console control

#### Scenario: Board of a project whose scan failed
- **WHEN** `demo-ops`'s last scan failed and the user opens its board
- **THEN** the header's action area is shown with the **Console** control, although no other action is offered

#### Scenario: Activating it on the overview
- **WHEN** the user activates the console control on the row of `alpha-infra`
- **THEN** the project console overlay for `alpha-infra` opens, the route is unchanged and the board is not opened

#### Scenario: Agent sessions off
- **WHEN** agent sessions are disabled in Settings
- **THEN** no project shows a console control, the board header shows no action area for it, and no project console
  can be started

#### Scenario: Project excluded from agent sessions
- **WHEN** agent sessions are on and `beta-soc`'s own agent sessions toggle reads Disabled
- **THEN** `beta-soc`'s console control still reads **Console** but is inactive, and its tooltip says that agent
  sessions are off for this project

#### Scenario: Scan failed
- **WHEN** `demo-ops`'s last scan failed but its folder exists
- **THEN** its console control is active and opens a console in that folder

### Requirement: The project console control shows the console's state
While a project's console runs, its control SHALL show which of the two running states the session is in. These are
producing output, or possibly needing the user together with the length of the silence. They SHALL be decided exactly
as for every other session badge. The control SHALL show the state as visible text next to its **Console** label, in
the same words as the session badge (`working`, or `may need you` with the duration), and SHALL give it in the tooltip
and accessible name. It MUST NOT give the state by colour or motion alone. While none of the project's console sessions
runs, the control SHALL show no state, only its label.

#### Scenario: Console working
- **WHEN** `demo-ops`'s console is producing output
- **THEN** its control reads **Console** followed by `working`

#### Scenario: Console waiting
- **WHEN** `demo-ops`'s console has printed nothing for longer than the silence threshold
- **THEN** the control shows `may need you` with the silence duration next to its label, and its tooltip and accessible
  name say that `demo-ops`'s console may need the user and for how long it has been silent

#### Scenario: No console running
- **WHEN** no console session of `demo-ops` is running
- **THEN** its control reads **Console** only and shows no running indicator
