# Proposal

## Why

The main console always runs the default agent. A user who keeps Claude Code as the default for change work but wants
Codex or Antigravity for general questions in the console has to switch the default agent, which changes every project
that has no agent of its own. Projects already choose their own agent and fall back to the default. The console should
work the same way.

## What Changes

- **Console agent setting.** `agentSessions.consoleAgent` (optional) names the agent profile the main console runs. When
  it is absent, the console runs the default agent, as it does today, so existing configurations behave as before.
- **Settings.** The **Console** group under Settings → Agent sessions gets an agent picker next to the console folder:
  "default agent" plus every configured profile, like a project's agent picker. The picker is shown only when there is
  a choice to make, which means two or more profiles. It is saved with Settings, like the console folder.
- **Removing a profile.** Removing the profile the console uses sends the console back to the default agent, as a
  repository goes back. Saving never fails because of an unknown console agent.
- **Validation.** `PUT /api/config` refuses with `400` a `consoleAgent` that is not the id of a configured profile.
- **Opening and resuming.** `POST /api/console` starts the console agent, without a prompt and as before. The
  agent-not-found refusal names that agent. A running console keeps its agent until it ends. Resume continues with the
  agent the session was started with, as every session does.
- **Overlay and environment check.** The console overlay's text says "your console agent" instead of "your default
  agent". In the environment check, a missing console agent counts as `problem`, like an agent that a project uses.
- **Unchanged.** **Integrate** and **New project** still run the default agent. Project consoles run the project's
  agent.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `main-console`: the console runs the console agent (the configured one, else the default). Settings offers the
  picker, and removing the chosen profile falls back to the default.
- `agent-sessions`: removing a profile also returns the console to the default agent.
- `dashboard-api`: the main console endpoint starts the console agent and reports when it is not found.
  `PUT /api/config` validates `consoleAgent`.
- `environment-check`: the console agent is one of the agents in use.

## Impact

- `src/shared/types.ts` (`AgentSessionsConfig.consoleAgent`), `src/server/config.ts` (schema and validation).
- `src/server/sessions/agents.ts` (`consoleAgentOf`, which replaces the console's use of `defaultAgentOf`),
  `src/server/sessions/manager.ts` (`openConsole`).
- `src/server/environment.ts` (`checkAgents`: the console agent is in use).
- `src/ui/agentSettings.tsx` (Console picker; `removeAgent` clears the picker), `src/ui/console.tsx` (overlay text,
  header comment).
- Tests: `test/consoleSession.test.ts`, config validation tests, environment check tests, and the UI helper tests for
  the picker and for removal.
- No new network access, no write to a repository, no new git or `gh` subcommand. Invariants are unchanged.
