## ADDED Requirements

### Requirement: Agent session settings are part of the configuration
The configuration SHALL contain an `agentSessions` object with `enabled` (default `false`), `agents` (at least one profile; default: the Claude Code profile) and `defaultAgent` (the id of one of them), and each repository entry MAY carry `agent: { enabled, agentId }` (default absent, meaning included and using the default agent; `enabled: false` excludes the repository). A profile has `id`, `name`, `command` (a non-empty list of arguments whose first element is the executable and in which `{prompt}` is the only placeholder), `prompts` (optionally one template each for `draft`, `implement`, `archive`, each containing `{change}` as its only placeholder), and optionally `resumeCommand` and `unsetEnv`. A configuration without these fields, or carrying settings of an earlier version of this feature, MUST load: missing fields take their defaults and unknown fields are dropped. Validation MUST reject duplicate agent ids, a `defaultAgent` or a repository `agentId` that names no configured agent, an empty command, unknown placeholders, a prompt without `{change}`, and any command, resume command or prompt containing a permission-bypass mode or flag.

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

### Requirement: Settings expose agent sessions with their risks stated
The Settings view SHALL provide a section for agent sessions containing the global switch; the list of agent profiles, each editable (name, command with one argument per line, the three prompts, resume command), removable while another remains, selectable as default, and marked with whether its executable was found on this machine; a way to add a profile and to restore the Claude Code preset; and for each tracked repository a toggle that is on by default and, when more than one agent is configured, a choice of agent. The section MUST state plainly that enabling it lets the dashboard start that program on this machine, that the agent can change files and run commands as the user allows it to, that each session works in its own worktree under the dashboard home and never in a main checkout, and that it applies to every tracked repository unless switched off. It SHALL list worktrees created by sessions with their state. The controls below the switch MUST be inactive while it is off.

#### Scenario: Enabling and excluding one repository
- **WHEN** the user turns on the global switch, switches repository `beta-soc` off and saves
- **THEN** cards of every other tracked repository offer session starters and cards of `beta-soc` do not

#### Scenario: Adding an agent
- **WHEN** the user adds an agent, enters its command one argument per line and an Implement prompt, and saves
- **THEN** the agent is stored with that argument list, is offered in each repository's agent choice, and shows whether its executable was found
