# Spec Delta

## MODIFIED Requirements

### Requirement: An agent is a configurable profile, not a built-in integration
The dashboard SHALL start agents from user-configurable profiles. A profile consists of an id, a display name, a command given as an argument list, an opening prompt per session starter, optional additional instructions per prompt, an optional resume command and an optional list of environment variables to remove. The dashboard MUST NOT depend on any vendor-specific protocol or output format of an agent: any program that runs interactively in a terminal SHALL be usable. One profile is the default; a repository MAY select a different one with its agent picker on the projects overview. Removing a profile in Settings SHALL return every repository that selected it, and the main console when it selected it, to the default agent. The dashboard SHALL ship **presets** — ready-made profiles — for Claude Code (`claude`), Codex (`codex`) and Antigravity (`agy`). A preset SHALL be an ordinary profile with nothing a user-written profile could not express, and once added it SHALL be edited, made the default or removed like any other profile. Only the Claude Code preset SHALL be configured by default; another preset SHALL become a profile only when the user adds it in Settings, never because its executable was found on this machine. No preset SHALL carry additional instructions for any of its prompts, and no preset's command, resume command or prompt SHALL contain a permission-bypass mode or flag. The dashboard MUST NOT read, store, log or transmit an agent's credentials and MUST NOT offer a login flow; an agent uses its own login and its own settings.

#### Scenario: A second agent
- **WHEN** the user adds a profile with command `my-agent-cli`, `{prompt}` and an Implement prompt, and selects it for repository `demo-ops` on the projects overview
- **THEN** Implement on a `demo-ops` card starts `my-agent-cli` and other repositories keep using the default agent

#### Scenario: Removing a selected profile
- **WHEN** `demo-ops` uses the profile `my-agent` and the user removes `my-agent` in Settings and saves
- **THEN** `demo-ops` uses the default agent and the configuration is saved without an "unknown agent" error

#### Scenario: Removing the console's profile
- **WHEN** the main console uses the profile `my-agent` and the user removes `my-agent` in Settings and saves
- **THEN** the configuration is saved without an "unknown agent" error and the next console starts the default agent

#### Scenario: Agent not installed
- **WHEN** the executable of a repository's agent cannot be found on this machine
- **THEN** that repository's starters are disabled with an explanation, and opening a session is refused with that reason

#### Scenario: API key variables are removed for the preconfigured agent
- **WHEN** the dashboard was started from a shell that exports `ANTHROPIC_API_KEY` and a Claude Code session is opened with the default profile
- **THEN** the agent's environment does not contain `ANTHROPIC_API_KEY`, so its own login is used

#### Scenario: An installed agent is not added on its own
- **WHEN** `agy` and `codex` are found on this machine and the configuration has never listed them
- **THEN** the loaded configuration still has the Claude Code profile as its only agent

#### Scenario: Antigravity preset takes its prompt as one argument
- **WHEN** the user has added the Antigravity preset and starts **Implement** on change `cache-api-calls` with it
- **THEN** the agent is started with two arguments, `agy` and one argument `--prompt-interactive=` followed by a prompt that names `cache-api-calls`, and resuming that session starts `agy --continue`

#### Scenario: Antigravity preset starts without a prompt
- **WHEN** the Antigravity preset is the agent of a main console or a project console
- **THEN** `agy` is started alone, with no option left over that expects a value

#### Scenario: Codex preset takes its prompt as one argument
- **WHEN** the user has added the Codex preset and starts **Implement** on change `cache-api-calls` with it
- **THEN** the agent is started with two arguments, `codex` and one prompt that names `cache-api-calls`

#### Scenario: Every preset is a valid profile
- **WHEN** a configuration listing every preset unchanged is validated
- **THEN** it is accepted, including the rule against permission-bypass modes and flags

#### Scenario: A saved profile from before additional instructions existed
- **WHEN** a configuration saved without any additional instructions is loaded
- **THEN** every prompt of every profile is composed exactly as it was, and the profile carries no additional instructions
