# Spec Delta

## MODIFIED Requirements

### Requirement: Agent session settings are part of the configuration

The configuration SHALL contain an `agentSessions` object with `enabled` (default `false`), `agents` (at least one profile; default: the Claude Code profile and no other preset) and `defaultAgent` (the id of one of them), and each repository entry MAY carry `agent: { enabled, agentId, autoMergeDocs }` (default absent, meaning included, using the default agent and not auto-merging; `enabled: false` excludes the repository; `autoMergeDocs` is an optional boolean, absent meaning `false`, that lets Ship ask for auto-merge of a pull request changing only OpenSpec documents, as the `agent-sessions` capability specifies). A profile has `id`, `name`, `command` (a non-empty list of arguments whose first element is the executable and in which `{prompt}` is the only placeholder), `prompts` (optionally one template each for `draft`, `implement`, `validate`, `archive`, each containing `{change}` as its only placeholder, and optionally `integrate`, which MUST NOT contain any placeholder at all because the repository folder is the agent's working directory; a profile without `integrate` uses the agent-neutral default Integrate prompt), and optionally `resumeCommand` and `unsetEnv`. A configuration without these fields, or carrying settings of an earlier version of this feature, MUST load: missing fields take their defaults and unknown fields are dropped. Validation MUST reject duplicate agent ids, a `defaultAgent` or a repository `agentId` that names no configured agent, a repository `autoMergeDocs` that is not a boolean, an empty command, unknown placeholders, a starter prompt without `{change}`, an `integrate` prompt containing any placeholder, and any command, resume command or prompt containing a permission-bypass mode or flag.

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

#### Scenario: Auto-merge is off unless set
- **WHEN** a configuration whose repositories carry `agent: { enabled: true }` or no `agent` at all is loaded
- **THEN** it loads unchanged, no `autoMergeDocs` is added to it, and Ship asks for no auto-merge in any of those repositories

#### Scenario: Auto-merge setting that is not a boolean
- **WHEN** a configuration is saved with a repository's `agent.autoMergeDocs` set to `"yes"`
- **THEN** it is rejected and the stored configuration is unchanged
