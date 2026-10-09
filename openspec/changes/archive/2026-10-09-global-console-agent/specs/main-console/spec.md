# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: The console runs the default agent without a prompt`
- TO: `### Requirement: The console runs the console agent without a prompt`

## MODIFIED Requirements

### Requirement: The console runs the console agent without a prompt
The console SHALL run the **console agent**: the agent profile chosen for the console in the agent sessions settings,
or the default agent when none is chosen. It SHALL be started without a shell, from the profile's command argument
list with every argument that contains `{prompt}` left out. No text SHALL be typed into it on start-up; the user writes
the first instruction. The agent's environment SHALL be prepared exactly as for any session, including the profile's
removed environment variables. When the console agent's executable cannot be found, opening the console SHALL be
refused with that reason, which names that agent, and the overlay SHALL show it. A running console SHALL keep the agent
it was started with when the choice changes; the choice applies to the next console started. Resuming an ended console
SHALL use the agent that console was started with.

#### Scenario: Preconfigured agent
- **WHEN** no console agent is chosen, the default agent is the preconfigured profile with command `claude`, `{prompt}`
  and the user opens the console
- **THEN** the agent is started with the argument list `claude` alone, and nothing is typed into its terminal

#### Scenario: Prompt embedded in an argument
- **WHEN** the console agent's command is `my-agent-cli`, `--task={prompt}`, `--color`
- **THEN** the console starts `my-agent-cli`, `--color`

#### Scenario: A console agent other than the default
- **WHEN** the default agent is the Claude Code profile, the Antigravity preset has been added, the user chose it as the
  console agent and opens the console
- **THEN** `agy` is started alone in the console folder, and change sessions of projects without an agent of their own
  still start `claude`

#### Scenario: Agent not installed
- **WHEN** the console agent's executable cannot be found and the user opens the console
- **THEN** no process is started and the overlay says that this agent was not found

#### Scenario: Choice changed while the console runs
- **WHEN** the console runs the default agent and the user chooses another profile as the console agent and saves
- **THEN** the running console is unaffected and keeps its agent, and the next console started after it ends runs the
  chosen profile

## ADDED Requirements

### Requirement: The console agent is chosen in the agent sessions settings
The agent sessions settings SHALL offer, in their Console group next to the console folder, a choice of the console
agent: "default agent" or any configured profile. The choice SHALL be shown only while at least two profiles are
configured, and SHALL be saved with the rest of the settings. "Default agent" SHALL be stored as no choice, so the
console follows the default agent when the default changes. A choice that names no configured profile SHALL be
refused when saving, with a reason, and SHALL leave the saved configuration unchanged. Removing the chosen profile in
the settings SHALL reset the choice to the default agent before saving.

#### Scenario: Only one profile
- **WHEN** only the Claude Code profile is configured
- **THEN** the Console group shows no agent choice, and the console runs that profile

#### Scenario: Following the default
- **WHEN** no console agent is chosen and the user makes the Codex preset the default agent and saves
- **THEN** the next console started runs `codex`

#### Scenario: Removing the chosen profile
- **WHEN** the console agent is `my-agent` and the user removes `my-agent` in the settings and saves
- **THEN** the saved configuration has no console agent and the next console runs the default agent
