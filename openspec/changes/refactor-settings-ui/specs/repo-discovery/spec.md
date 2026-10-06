# Spec Delta

## MODIFIED Requirements

### Requirement: Settings expose agent sessions with their risks stated

The Settings view SHALL provide a section for agent sessions containing the global switch; the list of agent profiles, each editable (name, command with one argument per line, its prompts including the Integrate prompt, resume command), removable while another remains, selectable as default, and marked with whether its executable was found on this machine; a way to add a profile and to add every preset that is not configured yet, each preset offered marked with whether its executable was found on this machine and the found ones listed first; and a note, linking to the projects overview, that each tracked repository's switch — on by default — and, when more than one agent is configured, its choice of agent are set there. The section MUST state plainly that enabling it lets the dashboard start that program on this machine, that the agent can change files and run commands as the user allows it to, that each session works in its own worktree under the dashboard home and never in a main checkout, the one exception being an integration session, which runs in the repository folder itself, and that it applies to every tracked repository unless switched off. The controls below the switch MUST be inactive while it is off.

The section SHALL be organised as headed groups, in this order: the switch with that statement; **Agents** (the profiles and the ways to add one); **Shortcuts**; **Console**; **Projects** (the note above). Within each profile the fields SHALL be grouped under their own headings: **Command** (name, command, resume command); **Change starters** (the Draft artifacts, Implement, Validate and Archive prompts); and **Action prompts** (the Ship, Resolve conflicts and Integrate prompts). Each prompt's additional instructions SHALL be shown directly with that prompt, labelled as belonging to it, and never separated from it by another prompt. A profile's header SHALL show its name, its command, whether it is the default, whether its executable was found, and the controls to make it the default and to remove it, so that these work without expanding the profile. The section SHALL NOT list session worktrees: they are shown, with their work status and the actions on them, in Open work and the change detail.

#### Scenario: Enabling and excluding one repository
- **WHEN** the user turns on the global switch in Settings and saves, and switches repository `beta-soc` off on the projects overview
- **THEN** cards of every other tracked repository offer session starters and cards of `beta-soc` do not

#### Scenario: Adding an agent
- **WHEN** the user adds an agent, enters its command one argument per line and an Implement prompt, and saves
- **THEN** the agent is stored with that argument list, is offered in each repository's agent choice, and shows whether its executable was found

#### Scenario: Adding a preset
- **WHEN** `agy` is found on this machine, `codex` is not, the configuration lists only the Claude Code profile, and the user opens the agent sessions section
- **THEN** the Antigravity preset is offered first and marked as found, the Codex preset is offered after it and marked as not found, the Claude Code preset is not offered, and choosing Antigravity and saving stores it as an ordinary profile that the user can edit or remove

#### Scenario: A configured preset is not offered again
- **WHEN** a profile with the id `agy` is configured, edited or not
- **THEN** the Antigravity preset is not offered

#### Scenario: Restoring a removed preset
- **WHEN** the user removed the Claude Code profile and saved
- **THEN** the Claude Code preset is offered again, and choosing it adds the profile with its current preset prompts

#### Scenario: Editing the Integrate prompt
- **WHEN** the user edits an agent profile's Integrate prompt and saves
- **THEN** the prompt is stored and used the next time **Integrate** is activated for that agent

#### Scenario: The in-place exception is stated
- **WHEN** the agent sessions section is shown
- **THEN** it says that sessions run in their own worktree and never in a main checkout, except an integration session, which runs in the repository folder itself

#### Scenario: The section's groups
- **WHEN** agent sessions are enabled and the user opens the Agent sessions section
- **THEN** below the switch it shows the headings Agents, Shortcuts, Console and Projects in that order, and no other group

#### Scenario: A profile's fields are grouped
- **WHEN** the user expands the Claude Code profile
- **THEN** its name, command and resume command are under Command; its Draft artifacts, Implement, Validate and Archive prompts under Change starters; its Ship, Resolve conflicts and Integrate prompts under Action prompts; and each prompt's additional instructions follow that prompt before the next prompt begins

#### Scenario: Making a profile the default without expanding it
- **WHEN** two profiles are configured and the collapsed one's header is shown
- **THEN** its header offers Make default and Remove agent, and activating Make default marks it as the default without expanding it

#### Scenario: No worktree list in Settings
- **WHEN** a session worktree exists and the user opens the Agent sessions section
- **THEN** the section lists no worktree, and the worktree is still listed in Open work
