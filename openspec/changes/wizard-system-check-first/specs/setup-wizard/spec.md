# Spec Delta

## MODIFIED Requirements

### Requirement: The wizard has seven steps in a fixed order
The wizard SHALL be a modal dialog with the steps **Welcome**, **System check**, **Workspace**, **Agents**, **Console**,
**Project settings** and **Done**, in this order, so that the tools the later steps rely on are checked before any of
them is used, showing the current step's position as "n of 7" and the
names of all steps. Every step before the current one SHALL be marked as done, in green with a check mark beside its
name, and SHALL be announced as done to assistive technology; the current step SHALL be marked as current, and the
steps after it SHALL show neither. The step list SHALL also be a way to move: every step up to the furthest one reached
SHALL be activatable from it, while a step not reached yet SHALL NOT be. Activating an earlier step SHALL act as
**Back**, keeping what was entered and saving nothing; activating a later step already reached SHALL first save the
current step exactly as its **Continue** would, and SHALL stay on the current step, showing the error, when that save
fails. While a step saves, the list SHALL NOT be activatable. Every step except Welcome SHALL offer **Back**; every step except Done SHALL offer **Continue** and
**Skip setup**. While the wizard is open the page behind it SHALL NOT receive clicks or keyboard focus, and it SHALL be
exposed to assistive technology as a dialog named as the setup. Pressing Escape SHALL act as **Skip setup**, after a
confirmation when the user has entered something the wizard has not saved yet. While a native folder picker opened by
the Workspace step is open, Escape in the page SHALL NOT end setup, and while a setting's help overlay is open, Escape
SHALL close that overlay and SHALL NOT end setup. The wizard SHALL work at a viewport width of 400px
without horizontal scrolling.

#### Scenario: Position shown
- **WHEN** the wizard shows the Console step
- **THEN** it reads "5 of 7" and lists Welcome, System check, Workspace, Agents, Console, Project settings and Done with Console marked current

#### Scenario: Steps passed are done
- **WHEN** the user continues from the Agents step to the Console step
- **THEN** Welcome, System check, Workspace and Agents are shown green with a check mark and announced as done, Console is marked current, and Project settings and Done are shown plain

#### Scenario: Jumping back from the step list
- **WHEN** the user is on the Project settings step and activates Workspace in the step list
- **THEN** the Workspace step is shown with what was entered, and nothing was saved by the jump

#### Scenario: Jumping forward again
- **WHEN** the user went back from Project settings to Agents, checks Codex and activates Project settings in the step list
- **THEN** the Agents step's save runs — Codex is added — and the Project settings step is shown

#### Scenario: A step not reached yet
- **WHEN** the user is on the Agents step for the first time
- **THEN** Console, Project settings and Done cannot be activated from the step list

#### Scenario: Back unmarks
- **WHEN** the user then activates **Back**
- **THEN** Agents is marked current again and only Welcome, System check and Workspace are shown as done

#### Scenario: Back keeps entries
- **WHEN** the user enters a workspace root, continues to Agents and activates **Back**
- **THEN** the Workspace step is shown with that root listed

#### Scenario: Narrow window
- **WHEN** the wizard is shown in a 400px wide viewport
- **THEN** every step's content and controls are reachable without scrolling sideways

### Requirement: The Welcome step says what setup covers
The Welcome step SHALL say in a few sentences what the dashboard is for, and that setup covers a check of the tools
the dashboard relies on, where the user's projects live, the agent CLIs the
user works with, the main console and the settings of the user's projects. It SHALL show these five topics as a diagram of the steps ahead: one node per step,
in the order the wizard takes them and connected in that order, each node with the step's number, its name and one line
on what it sets up, ending in a node for being ready to work. The diagram SHALL run across on a wide viewport and down
on a narrow one, SHALL fit a 400px viewport without horizontal scrolling, and SHALL be exposed to assistive technology
as an ordered list of the steps, with its connectors and icons hidden. It SHALL say that every step can be skipped and
changed later, in Settings or in a project's settings, and that setup can be run again from Help.

#### Scenario: Welcome
- **WHEN** the wizard opens
- **THEN** the Welcome step names the five topics, says that every step can be skipped and changed later, and says setup can be run again from Help

#### Scenario: The steps as a diagram
- **WHEN** the Welcome step is shown in a 1440px wide viewport
- **THEN** it shows System check, Workspace, Agents, Console and Project settings as numbered nodes from 1 to 5 in one row, connected in that order and followed by a node for being ready, each with one line on what it sets up

#### Scenario: The diagram on a narrow window
- **WHEN** the Welcome step is shown in a 400px wide viewport
- **THEN** the nodes run from top to bottom, connected in the same order, without scrolling sideways

#### Scenario: The diagram for a screen reader
- **WHEN** a screen reader user reaches the diagram
- **THEN** it is announced as a list of five steps in order, each read as its name and its line, without the connectors

### Requirement: The System check step shows the environment report with instructions
The System check step SHALL follow Welcome and SHALL request a fresh environment report in its setup view (the
`environment-check` capability's "The setup view leaves agents out") when it is shown, and show every check of that view
in the report's order with its label, its status in text, what was found and, for a check that is not `ok`, its remedy
and its instructions, each command shown so that it can be copied with one action. It SHALL NOT list a check per agent:
whether each agent's executable is found is shown in the Agents step. It SHALL say that the GitHub CLI is used for pull requests
and issues, and that git is needed to give each agent session its own worktree. It SHALL offer **Re-check**, which requests a fresh report and marks itself as working while
it does. It SHALL say plainly when everything needed is in place, and SHALL allow continuing whatever the report says.
The dashboard SHALL NOT run any command shown in the instructions.

#### Scenario: gh is missing
- **WHEN** a fresh installation has agent sessions off and `gh` is not on the PATH
- **THEN** the System check step, shown second, lists the GitHub CLI check as `warning` with instructions to install the GitHub CLI and to run `gh auth login`, each with a copy control

#### Scenario: No agent checks
- **WHEN** three agent profiles are configured and the System check step is shown
- **THEN** it lists no check for any agent

#### Scenario: Re-check after installing
- **WHEN** the user installs the missing tool and activates **Re-check**
- **THEN** the control shows that it is working and the list is replaced by the fresh report

#### Scenario: Copying a command
- **WHEN** the user activates the copy control next to a command
- **THEN** the command is on the clipboard, the control confirms it, and no process was started

#### Scenario: All in place
- **WHEN** every check of the setup view is `ok`
- **THEN** the step says that everything needed is in place

### Requirement: The Agents step can switch agent sessions on with a chosen default agent
The Agents step SHALL state, as the Agent sessions section of Settings does, that enabling agent sessions lets the
dashboard start the chosen programs on this machine, that an agent can change files and run commands as the user allows
it to, that each session works in its own worktree under the dashboard home, and that it applies to every tracked
repository unless switched off for a project. It SHALL offer a switch for agent sessions, switched on by default:
while agent sessions are off in the saved configuration it SHALL start checked, so that **Continue** switches them on
unless the user unchecks it; while they are on it SHALL show them on and SHALL NOT switch them off.

It SHALL list the configured profiles and every preset not configured yet, each with a checkbox and marked found or not
found on this machine, found ones first, side by side in one row of tiles of the same height on a wide viewport — each
with its name and whether it was found on one line and its status below — and one below the other on a narrow one.
Configured profiles SHALL be shown checked and SHALL NOT be uncheckable, since
the wizard never removes a profile the user configured. Agents SHALL NOT come pre-configured in the wizard: while the
configuration's agents are exactly what a fresh installation ships — the Claude Code profile, unchanged, as the only
profile and the default, with no console agent — that profile SHALL NOT count as configured, and Claude Code SHALL be
offered like any other preset. A preset SHALL be checked by default when its executable is found, and unchecked
otherwise. The Agents step is where agents are checked: whether each listed agent's executable is found SHALL be looked up when the
step is shown and again when the user activates **Check again**, which marks itself as working while it does and then
updates every mark. For every checked agent whose executable is not found, the step SHALL show how to install it, as the
`environment-check` capability's instructions specify, with each command copyable with one action, and SHALL still allow
continuing. It SHALL NOT refer the user to the System check step for agents.

The step SHALL offer **Add another agent**, which asks for a name and a command line, given as one argument per line,
in which `{prompt}` stands for the opening prompt. A custom agent SHALL need a non-empty name and a non-empty first
argument; until it has both it SHALL say what is missing and SHALL NOT be saved. It SHALL be listed and checked like a
preset, and SHALL be removable in this step until saved. Its prompts SHALL be those Settings gives a newly added agent,
and the step SHALL say that its prompts can be edited in Settings.

The step SHALL offer a choice of the **default agent** among the checked agents. The configured default SHALL be
preselected when it is checked and its executable is found, otherwise the first checked agent that is found, otherwise
the configured default.

At least one agent is required to proceed: while no agent is configured, checked or described completely as a custom
agent, **Continue** SHALL be disabled and SHALL say that an agent has to be chosen, and no later step SHALL open from the
step list; **Back** and **Skip setup** stay available, and skipping keeps the configuration's agents as they are.

**Continue** SHALL save: agent sessions switched on unless the user unchecked the switch; every checked preset and every custom
agent that is not configured yet added as a profile, in the order listed — in place of the shipped profile while the
agents are the untouched default, so that exactly the checked agents are configured; and the chosen agent as the
default. It SHALL NOT switch agent sessions off, remove or edit a profile the user configured, or change any
repository's agent settings.
If the user unchecked the switch, checked nothing new and chose the current default, **Continue** SHALL save nothing.

#### Scenario: Several agents installed
- **WHEN** a fresh installation finds `claude` and `codex` but not `agy`
- **THEN** Claude Code and Codex are listed checked and can be unchecked, Antigravity is unchecked, and Claude Code is preselected as the default agent

#### Scenario: Claude Code is not pre-configured
- **WHEN** a fresh installation finds none of the presets' executables
- **THEN** no agent is checked, Claude Code can be checked like Codex and Antigravity, and **Continue** is disabled with the reason that an agent has to be chosen

#### Scenario: One agent is enough
- **WHEN** in that state the user checks Codex
- **THEN** **Continue** is available, and continuing saves Codex as the only profile and the default agent, without the shipped Claude Code profile

#### Scenario: A profile the user edited stays
- **WHEN** the user changed the Claude Code profile's command in Settings and runs setup again
- **THEN** Claude Code is listed as configured, checked and cannot be unchecked

#### Scenario: Switching on with an installed preset
- **WHEN** on a fresh installation `codex` is found, `claude` is not, and agent sessions are off
- **THEN** Codex is checked and preselected as the default agent and Claude Code is unchecked; continuing with agent sessions switched on saves agent sessions enabled and Codex as the only profile and the default

#### Scenario: Adding two agents
- **WHEN** the user keeps Codex checked, also checks Antigravity, keeps agent sessions switched on, chooses Codex as the default and continues
- **THEN** the saved configuration has agent sessions enabled, the profiles Codex and Antigravity, Codex as the default agent, and every repository's agent settings unchanged

#### Scenario: A custom agent
- **WHEN** the user activates **Add another agent**, enters the name `My agent` and the command `my-agent` and `{prompt}` on two lines, and continues
- **THEN** the saved configuration has a profile named `My agent` with the command `["my-agent", "{prompt}"]` and the prompts Settings gives a new agent

#### Scenario: An incomplete custom agent
- **WHEN** the user adds a custom agent with a name but no command
- **THEN** the step says that a command is required and **Continue** does not save that agent

#### Scenario: The chosen agent is not installed
- **WHEN** the user checks the Antigravity preset and `agy` is not found
- **THEN** the step shows how to install Antigravity with a command to copy, and **Continue** is still available

#### Scenario: Risks are stated
- **WHEN** the Agents step is shown
- **THEN** it says that an agent can change files and run commands as the user allows it to, and that sessions work in their own worktree

#### Scenario: On by default
- **WHEN** agent sessions are off in the saved configuration and the Agents step is shown
- **THEN** **Turn agent sessions on** is checked, and continuing without touching it saves agent sessions enabled

#### Scenario: Leaving it off
- **WHEN** the user unchecks **Turn agent sessions on** and continues without checking a new agent and without changing the default agent
- **THEN** no configuration is saved by the step

#### Scenario: Checking again after installing
- **WHEN** `agy` was not found, the user checked Antigravity, installs it and activates **Check again**
- **THEN** Antigravity is marked found, its install instructions are gone, and no process other than the executable lookup was started

### Requirement: The Done step summarises and ends setup
The Done step SHALL summarise what setup saved: the roots added, the number of projects tracked, whether agent
sessions are on, the agents added, the default agent, the console agent and the number of projects whose settings were
changed. It SHALL also say what is left, naming the checks of a setup-view report requested when the Done step is shown that are
still `problem` or `warning`, and each checked agent whose executable the Agents step last found missing. It SHALL present this
visually: a headline that setup is complete, with a large check mark — or, when checks still need attention, that setup
is complete with something left to fix — followed by one card per step from System check to Project settings, in the wizard's
order, each with that step's icon from the Welcome diagram, its name, its outcome in a word or a number and a line of
detail, and a mark in text and colour of whether it is **done**, **needs attention** or had **nothing changed**. A card
SHALL need attention only for the System check, when a check is `problem` or `warning`, and for Agents, when a checked
agent is not found. Below the cards it SHALL say
what comes next: the projects overview, and the tour on a first start. The cards SHALL be exposed to assistive
technology as a list, each read as its name, mark and outcome, and the headline's animation, if any, SHALL not play when
the user prefers reduced motion. It SHALL offer **Finish**. Finishing, and **Skip setup** at any step, SHALL mark setup as done on the server and close the wizard,
keeping everything earlier steps saved. If marking setup as done fails, the wizard SHALL close anyway and open by itself
again on the next page load. After the wizard closed on a first start, the onboarding tour SHALL start under its own
rules.

#### Scenario: Finish
- **WHEN** the user activates **Finish**
- **THEN** the wizard closes, the configuration no longer has `setup: "pending"`, and on reload the wizard does not open

#### Scenario: A visual ending
- **WHEN** the user added `/w/acme`, tracked two projects, added Codex, kept the console on the default agent, changed no project setting, and every check is `ok`
- **THEN** the Done step's headline says setup is complete beside a large check mark, and it shows five cards — System check "All in place" done, Workspace "2 projects" done, Agents "2 agents" done, Console "Claude Code" done, Project settings nothing changed — each with its step's icon

#### Scenario: Something left to fix
- **WHEN** the GitHub CLI check is `warning` on the Done step
- **THEN** the headline says something is left to fix, and the System check card is marked as needing attention and names the GitHub CLI

#### Scenario: Summary of agents and projects
- **WHEN** the user added Codex and Antigravity, kept the console on the default agent and changed the auto fetch of three projects
- **THEN** the Done step lists Codex and Antigravity as added, names the default agent as the console agent, and says that the settings of three projects were saved

#### Scenario: Skip keeps what was saved
- **WHEN** the user continues from the Workspace step, which tracked two projects, and activates **Skip setup** on the Agents step
- **THEN** the wizard closes, setup is marked done, and the two projects are still tracked

#### Scenario: The tour follows
- **WHEN** a first-time user finishes the wizard in a browser that has not seen the tour
- **THEN** the onboarding tour starts at its first step

#### Scenario: An agent still missing
- **WHEN** the user checked Antigravity, `agy` is still not found, and every check of the setup view is `ok`
- **THEN** the Agents card is marked as needing attention and names Antigravity, and the System check card is done
