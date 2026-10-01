## MODIFIED Requirements

### Requirement: Agent sessions are off until enabled, then apply to every tracked repository
Agent sessions SHALL be available only when the global `agentSessions.enabled` setting is true. That switch SHALL be in the Agent sessions section of Settings. Once it is on, agent sessions apply to every tracked (enabled) repository by default. A repository MAY be excluded individually, and MAY be given an agent profile other than the default, with that repository's agent-session toggle and agent picker on the projects overview, which take effect at once. The Agent sessions section of Settings SHALL NOT list repositories; it SHALL say that agent sessions are switched on or off per project on the projects overview, and link there. An excluded or untracked repository MUST NOT show session starters and MUST be refused by the API. A fresh or migrated configuration MUST have the feature disabled. A repository entry without agent settings counts as included.

#### Scenario: Default configuration
- **WHEN** the dashboard starts with a configuration that predates this feature
- **THEN** agent sessions are disabled and no card shows a session starter

#### Scenario: One switch enables all tracked repositories
- **WHEN** the user turns agent sessions on and has not changed any per-repository setting
- **THEN** cards of every tracked repository offer the starters their stage and agent allow, and every project's toggle on the overview reads Enabled

#### Scenario: Repository switched off
- **WHEN** agent sessions are enabled and the user switches `alpha-infra` to Disabled on the projects overview
- **THEN** cards of `alpha-infra` show no session starter and opening a session for it is refused, while other repositories are unaffected

#### Scenario: Settings points to the overview
- **WHEN** the user opens the Agent sessions section of Settings
- **THEN** it has the global switch, the agent profiles, the shortcuts and the console folder, lists no repository, and links to the projects overview for per-project settings

### Requirement: An agent is a configurable profile, not a built-in integration
The dashboard SHALL start agents from user-configurable profiles. A profile consists of an id, a display name, a command given as an argument list, an opening prompt per session starter, optional additional instructions per prompt, an optional resume command and an optional list of environment variables to remove. The dashboard MUST NOT depend on any vendor-specific protocol or output format of an agent: any program that runs interactively in a terminal SHALL be usable. One profile is the default; a repository MAY select a different one with its agent picker on the projects overview. Removing a profile in Settings SHALL return every repository that selected it to the default agent. A profile for Claude Code SHALL be preconfigured, with no additional instructions for any of its prompts. The dashboard MUST NOT read, store, log or transmit an agent's credentials and MUST NOT offer a login flow; an agent uses its own login and its own settings.

#### Scenario: A second agent
- **WHEN** the user adds a profile with command `my-agent-cli`, `{prompt}` and an Implement prompt, and selects it for repository `demo-ops` on the projects overview
- **THEN** Implement on a `demo-ops` card starts `my-agent-cli` and other repositories keep using the default agent

#### Scenario: Removing a selected profile
- **WHEN** `demo-ops` uses the profile `my-agent` and the user removes `my-agent` in Settings and saves
- **THEN** `demo-ops` uses the default agent and the configuration is saved without an "unknown agent" error

#### Scenario: Agent not installed
- **WHEN** the executable of a repository's agent cannot be found on this machine
- **THEN** that repository's starters are disabled with an explanation, and opening a session is refused with that reason

#### Scenario: API key variables are removed for the preconfigured agent
- **WHEN** the dashboard was started from a shell that exports `ANTHROPIC_API_KEY` and a Claude Code session is opened with the default profile
- **THEN** the agent's environment does not contain `ANTHROPIC_API_KEY`, so its own login is used

#### Scenario: A saved profile from before additional instructions existed
- **WHEN** a configuration saved without any additional instructions is loaded
- **THEN** every prompt of every profile is composed exactly as it was, and the profile carries no additional instructions
