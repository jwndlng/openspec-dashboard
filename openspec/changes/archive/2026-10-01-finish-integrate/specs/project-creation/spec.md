# Spec Delta

## MODIFIED Requirements

### Requirement: New project is offered from the projects overview

The projects overview SHALL offer a **New project** action in its header band and, while no repository is tracked, in
its "No repositories tracked yet" empty state next to the link to Settings. Activating it SHALL open a dialog in which the user picks
one of the configured workspace roots (scan roots) and types a folder name; the dialog SHALL show the full path that
will be created and SHALL preselect the root when exactly one is configured. Confirming the dialog SHALL create the
project as specified below. The action SHALL be unavailable, with the reason stated in its tooltip and accessible name,
when no workspace root is configured, when agent sessions are off, when no default agent is configured, or when the
default agent's executable was not found on this machine. A default agent without an `integrate` prompt of its own MUST
NOT make it unavailable: the integration session then uses the agent-neutral default Integrate prompt.

#### Scenario: One root configured
- **WHEN** the only workspace root is `/w/acme` and the user opens **New project** and types `gamma-tools`
- **THEN** the dialog has `/w/acme` selected and shows `/w/acme/gamma-tools` as the folder that will be created

#### Scenario: Several roots
- **WHEN** the workspace roots are `/w/acme` and `/w/alpha`
- **THEN** the dialog asks the user to pick one of the two and creates nothing until one is picked

#### Scenario: Nothing tracked yet
- **WHEN** no repository is tracked, a workspace root is configured and agent sessions are on
- **THEN** the empty state offers **New project**, active, next to its link to Settings

#### Scenario: No workspace root
- **WHEN** no workspace root is configured
- **THEN** **New project** is inactive and its reason says to add a workspace root in Settings

#### Scenario: Agent sessions are off
- **WHEN** agent sessions are disabled
- **THEN** **New project** is inactive and its reason says that agent sessions are off

#### Scenario: The agent has no Integrate prompt of its own
- **WHEN** a workspace root is configured, agent sessions are on, the default agent's executable is found and its profile carries no `integrate` prompt
- **THEN** **New project** is active

### Requirement: Every precondition is checked before anything is written

The dashboard SHALL check every condition that would stop the project from being set up — agent sessions on, a default
agent configured and its executable found, `git` found, the root and name accepted — before it creates the folder. A
refused request MUST create no folder, run no git command and start no process.

#### Scenario: Agent missing
- **WHEN** the default agent's executable is not found and the user confirms a valid name
- **THEN** the request is refused with that reason, no folder exists at the path and no process was started

#### Scenario: git missing
- **WHEN** `git` is not found on this machine
- **THEN** the request is refused with a reason saying git was not found and no folder is created
