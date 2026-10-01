# Spec Delta

## MODIFIED Requirements

### Requirement: Integrate starts the repository's agent in that repository

The dashboard SHALL offer an **Integrate** action for each integratable repository. Activating it SHALL start an
**integration session**: the repository's configured agent — the default agent, since the repository is not tracked and
so cannot select one — started with that agent's Integrate prompt and the repository folder as its working directory.
The Integrate prompt SHALL be the profile's `integrate` prompt when it has one, and otherwise an agent-neutral default
that asks the agent to run `openspec init` in this folder, to ask the user which tools to install it for, and to report
what it created. Like every Integrate prompt, the default MUST contain no placeholder and MUST NOT name any particular
agent, so that every profile can integrate without being configured for it.
An integration session is a session of its own kind: it belongs to no repository in the configuration, no change and no
action, and MUST NOT appear anywhere change sessions appear — not in Open work, not on a card, not in the activity log,
and never in work status, Ship, pull or worktree clean-up.

At most one integration session per folder SHALL be running; activating **Integrate** again while one runs SHALL return
the running session rather than start a second agent.

**Integrate** SHALL be unavailable, with the reason stated on the row, when agent sessions are off, when no default
agent is configured, or when the default agent's executable was not found on this machine. A profile without an
`integrate` prompt of its own MUST NOT make Integrate unavailable. Integratable repositories SHALL be listed in all of
those cases. When the agent cannot be started, the reason SHALL be shown on the row that activated **Integrate**,
because a session that was never created has no panel to report itself in.

#### Scenario: Starting an integration
- **WHEN** the user activates **Integrate** for an integratable repository and agent sessions are on
- **THEN** the default agent starts with the repository folder as its working directory and its terminal is shown

#### Scenario: Starting it twice
- **WHEN** **Integrate** is activated for a folder whose integration session is running
- **THEN** the running session is shown and no second agent is started

#### Scenario: Agent sessions are off
- **WHEN** agent sessions are disabled
- **THEN** integratable repositories are still listed, **Integrate** is inactive, and the reason given is that agent sessions are off

#### Scenario: The agent has no Integrate prompt
- **WHEN** the default agent's profile carries no `integrate` prompt, agent sessions are on and its executable is found
- **THEN** **Integrate** is active on every row, and activating it starts the agent with the agent-neutral default Integrate prompt

#### Scenario: The profile's own Integrate prompt wins
- **WHEN** the default agent's profile carries the `integrate` prompt `Set this project up for OpenSpec.`
- **THEN** activating **Integrate** starts the agent with exactly that prompt, not the default

#### Scenario: An integration session is not change work
- **WHEN** an integration session is running
- **THEN** it does not appear in Open work, on any card or in the activity log, and it has no work status, no Ship and no worktree
