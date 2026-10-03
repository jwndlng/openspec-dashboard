# Spec Delta

## MODIFIED Requirements

### Requirement: Agent session settings are part of the configuration

The configuration SHALL contain an `agentSessions` object with `enabled` (default `false`), `agents` (at least one profile; default: the Claude Code profile and no other preset) and `defaultAgent` (the id of one of them), and each repository entry MAY carry `agent: { enabled, agentId }` (default absent, meaning included and using the default agent; `enabled: false` excludes the repository). A profile has `id`, `name`, `command` (a non-empty list of arguments whose first element is the executable and in which `{prompt}` is the only placeholder), `prompts` (optionally one template each for `draft`, `implement`, `validate`, `archive`, each containing `{change}` as its only placeholder, and optionally `integrate`, which MUST NOT contain any placeholder at all because the repository folder is the agent's working directory; a profile without `integrate` uses the agent-neutral default Integrate prompt), and optionally `resumeCommand` and `unsetEnv`. A configuration without these fields, or carrying settings of an earlier version of this feature, MUST load: missing fields take their defaults and unknown fields are dropped. Validation MUST reject duplicate agent ids, a `defaultAgent` or a repository `agentId` that names no configured agent, an empty command, unknown placeholders, a starter prompt without `{change}`, an `integrate` prompt containing any placeholder, and any command, resume command or prompt containing a permission-bypass mode or flag.

#### Scenario: Older configuration loads
- **WHEN** the stored configuration has no `agentSessions` key, or has one written by the earlier transcript-based version
- **THEN** it loads with the Claude Code profile as the only and default agent, the stored `enabled` value kept (`false` when absent), and no repository excluded

#### Scenario: Unknown placeholder
- **WHEN** a configuration is saved with an agent prompt `/opsx:apply {change} {branch}`
- **THEN** it is rejected naming the unknown placeholder and the stored configuration is unchanged

#### Scenario: Bypass flag rejected
- **WHEN** an agent's command contains a flag that switches off the agent's permission checks
- **THEN** the configuration is rejected

#### Scenario: Repository names a removed agent
- **WHEN** a configuration is saved in which a repository selects an agent id that is not configured
- **THEN** it is rejected

#### Scenario: Integrate prompt with a placeholder
- **WHEN** a configuration is saved with an agent's `integrate` prompt containing `{change}`
- **THEN** it is rejected naming that placeholder and the stored configuration is unchanged

#### Scenario: Configuration without an Integrate prompt
- **WHEN** a configuration whose agents carry no `integrate` prompt is loaded
- **THEN** it loads unchanged, no `integrate` prompt is added to it, and those agents offer Integrate with the agent-neutral default prompt

#### Scenario: A saved Integrate prompt is kept
- **WHEN** a configuration whose Claude Code profile carries an `integrate` prompt is loaded
- **THEN** that prompt is kept as it is and used by Integrate

### Requirement: Settings expose agent sessions with their risks stated

The Settings view SHALL provide a section for agent sessions containing the global switch; the list of agent profiles, each editable (name, command with one argument per line, its prompts including the Integrate prompt, resume command), removable while another remains, selectable as default, and marked with whether its executable was found on this machine; a way to add a profile and to add every preset that is not configured yet, each preset offered marked with whether its executable was found on this machine and the found ones listed first; and for each tracked repository a toggle that is on by default and, when more than one agent is configured, a choice of agent. The section MUST state plainly that enabling it lets the dashboard start that program on this machine, that the agent can change files and run commands as the user allows it to, that each session works in its own worktree under the dashboard home and never in a main checkout, the one exception being an integration session, which runs in the repository folder itself, and that it applies to every tracked repository unless switched off. It SHALL list worktrees created by sessions with their state. The controls below the switch MUST be inactive while it is off.

#### Scenario: Enabling and excluding one repository
- **WHEN** the user turns on the global switch, switches repository `beta-soc` off and saves
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

