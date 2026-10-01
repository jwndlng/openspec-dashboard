# Spec Delta

## MODIFIED Requirements

### Requirement: Agent session settings are part of the configuration

The configuration SHALL contain an `agentSessions` object with `enabled` (default `false`), `agents` (at least one profile; default: the Claude Code profile) and `defaultAgent` (the id of one of them), and each repository entry MAY carry `agent: { enabled, agentId }` (default absent, meaning included and using the default agent; `enabled: false` excludes the repository). A profile has `id`, `name`, `command` (a non-empty list of arguments whose first element is the executable and in which `{prompt}` is the only placeholder), `prompts` (optionally one template each for `draft`, `implement`, `validate`, `archive`, each containing `{change}` as its only placeholder, and optionally `integrate`, which MUST NOT contain any placeholder at all because the repository folder is the agent's working directory; a profile without `integrate` uses the agent-neutral default Integrate prompt), and optionally `resumeCommand` and `unsetEnv`. A configuration without these fields, or carrying settings of an earlier version of this feature, MUST load: missing fields take their defaults and unknown fields are dropped. Validation MUST reject duplicate agent ids, a `defaultAgent` or a repository `agentId` that names no configured agent, an empty command, unknown placeholders, a starter prompt without `{change}`, an `integrate` prompt containing any placeholder, and any command, resume command or prompt containing a permission-bypass mode or flag.

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

## ADDED Requirements

### Requirement: Settings show the default Integrate prompt

Settings SHALL show, for each agent profile, the agent-neutral default Integrate prompt as the placeholder of an empty
Integrate prompt field and SHALL say that leaving it empty uses that default; it MUST NOT say that an empty Integrate
prompt makes the agent offer no Integrate action. Clearing the field and saving SHALL store the profile without an
`integrate` prompt. The hint for additional Integrate instructions SHALL say that they are appended to the Integrate
prompt or, when it is empty, to the default.

#### Scenario: Empty field shows the default
- **WHEN** the Settings view shows an agent profile without an `integrate` prompt
- **THEN** the Integrate prompt field is empty, shows the default prompt as its placeholder, and its hint says that empty uses the default

#### Scenario: Clearing the prompt
- **WHEN** the user clears an agent's Integrate prompt and saves
- **THEN** the stored profile has no `integrate` prompt and **Integrate** stays available, using the default
