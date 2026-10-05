# Spec Delta

## MODIFIED Requirements

### Requirement: The project console runs the project's agent without a prompt
A project console SHALL run the project's agent: the profile chosen for that project, else the default agent. It SHALL be
started without a shell, from the profile's command argument list with every argument that contains `{prompt}` left out,
and with no text typed into it on start-up. The agent's environment SHALL be prepared exactly as for any session. When
the agent's executable cannot be found, opening the console SHALL be refused with that reason and the overlay SHALL show
it.

#### Scenario: Project with its own agent
- **WHEN** two agent profiles are configured, `demo-ops` uses `my-agent` with command `my-agent-cli`, `--task={prompt}`,
  `--color`, and the user opens `demo-ops`'s console
- **THEN** `my-agent-cli`, `--color` is started and nothing is typed into its terminal

#### Scenario: Default agent
- **WHEN** `alpha-infra` has no agent of its own and the default agent's command is `claude`, `{prompt}`
- **THEN** its console starts `claude` alone

#### Scenario: Agent not installed
- **WHEN** the project's agent executable cannot be found and the user opens its console
- **THEN** no process is started and the overlay says that the agent was not found

#### Scenario: Prompt carried by an option
- **WHEN** `demo-ops` uses the Antigravity preset, whose command is `agy`, `--prompt-interactive={prompt}`, and the user opens `demo-ops`'s console
- **THEN** `agy` is started alone and nothing is typed into its terminal
