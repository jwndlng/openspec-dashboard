## MODIFIED Requirements

### Requirement: Integrating a repository is simulated in the demo

The demo's sample SHALL include at least one integratable repository — a fictional git repository without OpenSpec —
and at least one discovered repository, both listed on the projects overview under Unmanaged projects with
the same **Integrate**, **Enable** and Ignore actions the dashboard shows there. Enable, Disable and Ignore SHALL
change the demo's in-memory configuration at once, as they do in the dashboard. Activating **Integrate** SHALL create
an integration session in memory whose terminal plays a short hand-written, vendor-neutral transcript under the same
rules as every demo transcript: labelled as a recording, continuing on a line of input, and ending as an exited agent.
When that transcript ends, the demo SHALL do what the marker appearing does in the dashboard: the repository becomes a
tracked, enabled repository with its default name, it leaves Unmanaged projects, and it appears under
Managed projects and on the board with a small sample of changes. None of this SHALL persist across a reload. The demo
MUST NOT start a process, open a network connection or write anywhere for any of this.

#### Scenario: The integratable repository is listed
- **WHEN** the visitor opens the projects overview in the demo
- **THEN** under Unmanaged projects an integratable repository labelled `no OpenSpec` is offered **Integrate** and Ignore, and a discovered repository labelled `OpenSpec` **Enable** and Ignore

#### Scenario: Integrating in the demo
- **WHEN** the visitor activates **Integrate** for it
- **THEN** a session panel opens whose terminal starts with the line saying it is a demo recording, and the repository is not yet under Managed projects

#### Scenario: The integration finishes
- **WHEN** the integration transcript reaches its end
- **THEN** the session is shown as ended, the repository is gone from Unmanaged projects, and it appears under Managed projects and on the board

#### Scenario: Enabling in the demo
- **WHEN** the visitor activates **Enable** on the discovered repository
- **THEN** it moves to Managed projects without any Save

#### Scenario: Sessions switched off
- **WHEN** the visitor switches agent sessions off in the demo's Settings
- **THEN** the integratable repository is still listed on the overview and **Integrate** is inactive with the reason given

#### Scenario: Nothing leaves the page
- **WHEN** the demo's integration is started, played and ended
- **THEN** no process is started and no network request is made

#### Scenario: Not persisted
- **WHEN** the visitor integrates the repository or enables the discovered one in the demo and reloads the page
- **THEN** both are listed under Unmanaged projects again
