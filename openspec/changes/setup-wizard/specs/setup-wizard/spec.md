# Spec Delta

## Purpose

Defines the setup wizard: a short, skippable dialog that walks a user through the first start of a fresh installation —
workspace roots, the agent to use and the tools the dashboard relies on — and says how to fix whatever is missing.

## ADDED Requirements

### Requirement: The wizard opens by itself once per installation
The dashboard SHALL open the setup wizard by itself when the loaded configuration has `setup: "pending"`, once the
configuration has loaded, on whatever route was opened. It SHALL NOT open by itself while the change detail view, the
main console, an integration terminal or the onboarding tour is open; it SHALL then open once none of them is. It
SHALL open by itself at most once per page load. Whether it opens SHALL depend only on the server's configuration, never
on browser storage, so that every browser and the desktop app see the same state. A configuration without `setup`
SHALL never open the wizard by itself.

#### Scenario: First start
- **WHEN** the dashboard is started for the first time, so a fresh configuration with `setup: "pending"` was created, and the user opens it
- **THEN** the setup wizard opens at its first step

#### Scenario: Upgrading from an earlier version
- **WHEN** the dashboard starts with a configuration written by an earlier version, without a `setup` key
- **THEN** the setup wizard does not open by itself

#### Scenario: A second browser after setup
- **WHEN** the user finished the wizard in one browser and then opens the dashboard in another browser
- **THEN** the setup wizard does not open

#### Scenario: A deep link to a change
- **WHEN** setup is pending and the user opens a link to a change's detail view
- **THEN** the wizard opens only once the detail view is closed

### Requirement: The wizard has five steps in a fixed order
The wizard SHALL be a modal dialog with the steps **Welcome**, **Workspace**, **Agents**, **System check** and **Done**,
in this order, showing the current step's position as "n of 5" and the names of all steps. Every step except Welcome
SHALL offer **Back**; every step except Done SHALL offer **Continue** and **Skip setup**. While the wizard is open the
page behind it SHALL NOT receive clicks or keyboard focus, and it SHALL be exposed to assistive technology as a dialog
named as the setup. Pressing Escape SHALL act as **Skip setup**, after a confirmation when the user has entered
something the wizard has not saved yet. The wizard SHALL work at a viewport width of 400px without horizontal scrolling.

#### Scenario: Position shown
- **WHEN** the wizard shows the Agents step
- **THEN** it reads "3 of 5" and lists Welcome, Workspace, Agents, System check and Done with Agents marked current

#### Scenario: Back keeps entries
- **WHEN** the user enters a workspace root, continues to Agents and activates **Back**
- **THEN** the Workspace step is shown with that root listed

#### Scenario: Narrow window
- **WHEN** the wizard is shown in a 400px wide viewport
- **THEN** every step's content and controls are reachable without scrolling sideways

### Requirement: The Welcome step says what setup covers
The Welcome step SHALL say in a few sentences what the dashboard is for, that setup covers where the user's projects
live, which agent to use and a check of the tools it relies on, that every step can be skipped and changed later in
Settings, and that setup can be run again from Help.

#### Scenario: Welcome
- **WHEN** the wizard opens
- **THEN** the Welcome step names the three topics, says that every step can be skipped and changed later in Settings, and says setup can be run again from Help

### Requirement: The Workspace step adds roots and tracks projects
The Workspace step SHALL list the configured workspace roots and let the user add roots by typing a path, with `~`
accepted, and remove roots added in this step. It SHALL offer as one-click suggestions the folders the server reports as
existing in the user's home directory that are not configured yet. Whenever the entered roots change, discovery SHALL
run against the configured and entered roots and the configured ignore paths without saving anything, and the step
SHALL list the OpenSpec projects found that are not tracked yet, each with a checkbox, all checked by default, and say
how many git repositories without OpenSpec were found, adding that they can be integrated from the projects overview. A
root that discovery reports as missing SHALL be marked with that error and SHALL NOT be saved. Only the latest
discovery result SHALL be shown. **Continue** SHALL save the configuration with the entered roots added and then track
each checked project; it SHALL NOT remove any root, ignore path or repository, and SHALL NOT change any repository's
name or enabled state other than tracking the checked ones. If saving fails, the step SHALL stay open, show the error and
keep the entries. Continuing with nothing entered and nothing checked SHALL save nothing.

#### Scenario: A suggested folder
- **WHEN** `~/Workspace` exists, is not a configured root, and the user opens the Workspace step
- **THEN** `~/Workspace` is offered as a suggestion, and activating it adds it to the entered roots and runs discovery

#### Scenario: Projects found are tracked
- **WHEN** the user adds `/w/acme`, discovery finds `/w/acme/alpha-infra` and `/w/acme/demo-ops` with OpenSpec and `/w/acme/chat-groups` without, the user unchecks `demo-ops` and continues
- **THEN** the saved configuration has `/w/acme` as a root, `alpha-infra` is tracked and enabled, `demo-ops` is not in the configuration, and the step had said that one repository without OpenSpec can be integrated from the overview

#### Scenario: Nothing is saved before Continue
- **WHEN** the user adds a root and discovery lists projects, and the user then activates **Skip setup**
- **THEN** the saved configuration's roots and repositories are unchanged

#### Scenario: A missing folder
- **WHEN** the user enters `~/does-not-exist`
- **THEN** the root is marked as not found and is not saved on **Continue**

#### Scenario: Existing roots are kept
- **WHEN** setup is run again with two configured roots and the user adds a third and continues
- **THEN** the saved configuration has all three roots

### Requirement: The Agents step can switch agent sessions on with a chosen default agent
The Agents step SHALL state, as the Agent sessions section of Settings does, that enabling agent sessions lets the
dashboard start the chosen program on this machine, that the agent can change files and run commands as the user allows
it to, that each session works in its own worktree under the dashboard home, and that it applies to every tracked
repository unless switched off on the projects overview. It SHALL offer a switch for agent sessions, showing the saved
value, and a choice of the default agent among the configured profiles and every preset not configured yet, each marked
found or not found on this machine, found ones first; the configured default SHALL be preselected when its executable is
found, otherwise the first agent in that list that is found, otherwise the configured default. When the chosen agent's executable is not found, the step SHALL show
how to install it, as the `environment-check` capability's instructions specify, and SHALL still allow continuing.
**Continue** SHALL save: agent sessions switched on if the user switched them on; the chosen preset added as a profile
if it was not configured; and the chosen agent as the default. It SHALL NOT switch agent sessions off, remove or edit a
profile, or change any repository's agent settings. If the user left agent sessions off and chose the current default,
**Continue** SHALL save nothing.

#### Scenario: Switching on with an installed preset
- **WHEN** `codex` is found, `claude` is not, agent sessions are off and only the Claude Code profile is configured
- **THEN** the Codex preset is preselected and marked found; switching agent sessions on and continuing saves agent sessions enabled, the Codex profile added and made the default, and the Claude Code profile kept

#### Scenario: The chosen agent is not installed
- **WHEN** the user chooses the Claude Code profile and `claude` is not found
- **THEN** the step shows how to install Claude Code with a command to copy, and **Continue** is still available

#### Scenario: Risks are stated
- **WHEN** the Agents step is shown
- **THEN** it says that the agent can change files and run commands as the user allows it to, and that sessions work in their own worktree

#### Scenario: Leaving it off
- **WHEN** the user continues from the Agents step without switching agent sessions on and without changing the agent
- **THEN** no configuration is saved by the step

### Requirement: The System check step shows the environment report with instructions
The System check step SHALL request a fresh environment report after the earlier steps saved, and show every check in
the report's order with its label, its status in text, what was found and, for a check that is not `ok` or
`not-needed`, its remedy and its instructions, each command shown so that it can be copied with one action. It SHALL
offer **Re-check**, which requests a fresh report and marks itself as working while it does. It SHALL say plainly when
everything needed is in place, and SHALL allow continuing whatever the report says. The dashboard SHALL NOT run any
command shown in the instructions.

#### Scenario: gh is missing
- **WHEN** agent sessions were switched on in the Agents step and `gh` is not on the PATH
- **THEN** the GitHub CLI check is listed as `warning` with instructions to install the GitHub CLI and to run `gh auth login`, each with a copy control

#### Scenario: Re-check after installing
- **WHEN** the user installs the missing tool and activates **Re-check**
- **THEN** the control shows that it is working and the list is replaced by the fresh report

#### Scenario: Copying a command
- **WHEN** the user activates the copy control next to a command
- **THEN** the command is on the clipboard, the control confirms it, and no process was started

#### Scenario: All in place
- **WHEN** every check is `ok` or `not-needed`
- **THEN** the step says that everything needed is in place

### Requirement: The Done step summarises and ends setup
The Done step SHALL summarise what setup saved — the roots added, the number of projects tracked, whether agent sessions
are on and the default agent — and what is left, naming the checks that are still `problem` or `warning`. It SHALL
offer **Finish**. Finishing, and **Skip setup** at any step, SHALL mark setup as done on the server and close the wizard,
keeping everything earlier steps saved. If marking setup as done fails, the wizard SHALL close anyway and open by itself
again on the next page load. After the wizard closed on a first start, the onboarding tour SHALL start under its own
rules.

#### Scenario: Finish
- **WHEN** the user activates **Finish**
- **THEN** the wizard closes, the configuration no longer has `setup: "pending"`, and on reload the wizard does not open

#### Scenario: Skip keeps what was saved
- **WHEN** the user continues from the Workspace step, which tracked two projects, and activates **Skip setup** on the Agents step
- **THEN** the wizard closes, setup is marked done, and the two projects are still tracked

#### Scenario: The tour follows
- **WHEN** a first-time user finishes the wizard in a browser that has not seen the tour
- **THEN** the onboarding tour starts at its first step

### Requirement: Setup can be run again
Running setup again from Help SHALL open the wizard at its first step whether or not setup is pending, with the current
configuration prefilled, under the same rules for steps, saving and finishing. It SHALL NOT start the onboarding tour
when it closes.

#### Scenario: Run again
- **WHEN** a user who finished setup activates **Run setup again** on the Help page
- **THEN** the wizard opens at Welcome and the Workspace step lists the configured roots

### Requirement: The wizard reads and writes only through existing rules
The wizard SHALL save only through the configuration, tracking and setup endpoints, and MUST NOT write to a tracked
repository, start an agent or any other process, or contact a network. Its workspace suggestions SHALL come from a fixed
list of folder names checked directly in the user's home directory, without listing the home directory or descending
into any folder.

#### Scenario: No process started
- **WHEN** the user steps through the whole wizard and switches agent sessions on
- **THEN** no agent was started and no repository file was created, modified or deleted

### Requirement: The demo does not open the wizard by itself
In the demo build the wizard SHALL NOT open by itself. **Run setup again** on the demo's Help page SHALL open it against
the demo's own data, where its saves change only the demo's in-page state.

#### Scenario: Demo first load
- **WHEN** a visitor opens the demo for the first time
- **THEN** no wizard is shown

#### Scenario: Demo run again
- **WHEN** a demo visitor activates **Run setup again**
- **THEN** the wizard opens at its first step
