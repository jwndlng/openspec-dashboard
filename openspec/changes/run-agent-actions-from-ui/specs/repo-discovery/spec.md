## ADDED Requirements

### Requirement: Agent session settings are part of the configuration
The configuration SHALL contain an `agentSessions` object with `enabled` (default `false`), `maxRunning` (default `2`, minimum `1`), `idleMinutes` (default `30`), `claudePath` (default `claude`), `passApiKeyEnv` (default `false`) and `commands` (`draft`, `implement`, `archive`; each a template whose only placeholder is `{change}`), and each repository entry MAY carry `agent: { enabled, allowedTools }` (default absent, meaning included with no additional allowed tools; `enabled: false` excludes the repository). A configuration written before a command existed MUST load with that command's default. A configuration without these fields MUST load with the defaults. Validation MUST reject a `maxRunning` below 1, a command template with placeholders other than `{change}`, and any allowed-tools entry or template containing a permission-bypass mode or flag.

#### Scenario: Older configuration loads
- **WHEN** the stored configuration has no `agentSessions` key
- **THEN** it loads with agent sessions disabled and all defaults applied, and no repository excluded

#### Scenario: Invalid template
- **WHEN** a configuration is saved with `commands.implement` set to `/opsx:apply {change} {branch}`
- **THEN** it is rejected naming the unknown placeholder and the stored configuration is unchanged

#### Scenario: Bypass entry rejected
- **WHEN** a repository's `allowedTools` contains an entry naming a permission-bypass flag or mode
- **THEN** the configuration is rejected

### Requirement: Settings expose agent sessions with their risks stated
The Settings view SHALL provide a section for agent sessions containing the global switch, the availability of the agent CLI (found or not, with its version), `maxRunning`, the idle limit and the command templates, and for each tracked repository a toggle that is on by default and an editable list of additional allowed tools shown next to the built-in default list. The section MUST state plainly that enabling it lets an agent started from the dashboard modify files and run the allowed commands in a worktree of every tracked repository that is not switched off, using the user's own agent CLI login. It SHALL list worktrees created by sessions with their state. Per-repository controls MUST be inactive while the global switch is off.

#### Scenario: Enabling and excluding one repository
- **WHEN** the user turns on the global switch, switches repository `beta-soc` off, adds `Bash(bun run check*)` to the allowed tools of `demo-ops` and saves
- **THEN** the configuration stores those values, cards of `demo-ops` and every other tracked repository offer session starters, and cards of `beta-soc` do not

#### Scenario: CLI missing
- **WHEN** the agent CLI cannot be found
- **THEN** the section shows that it is missing and how to install it, and the global switch cannot be turned on
