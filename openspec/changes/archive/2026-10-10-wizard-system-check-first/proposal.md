# Proposal

## Why

The setup wizard checks the user's tools last, after the steps that rely on them, and that check repeats the Agents
step: every agent is already marked found or not found there, with its install command. Worse, the report judges what
matters from the saved configuration, so during setup — agent sessions still off — the GitHub CLI and the committer
identity read `not-needed` and carry no instructions, though setup is about to switch agents on.

## What Changes

- The **System check** step moves to the front, right after Welcome. New order: Welcome, System check, Workspace,
  Agents, Console, Project settings, Done (still "n of 7"); the Welcome diagram, the step list and the Done cards follow
  it.
- The step uses a new **setup view** of the environment report (`GET /api/environment?view=setup`): no per-agent
  checks, and fixed setup verdicts instead of configuration-derived ones — a missing `git` is a problem; a missing
  identity, GitHub CLI, GitHub credentials or `openspec` CLI is a warning; nothing is `not-needed`. Settings' report is
  unchanged.
- The **Agents** step is where agents are checked: it already looks up each agent's executable; it gains **Check again**
  and no longer points to the System check for agents.
- The **Done** step requests a fresh setup view and also names checked agents that are still not found, marking the
  Agents card as needing attention.

## Capabilities

### New Capabilities

### Modified Capabilities
- `setup-wizard`: step order; the System check step uses the setup view and lists no agent checks; Agents gets Check
  again; the Done step's cards and what is left.
- `environment-check`: the setup view of the report.
- `dashboard-api`: `view=setup` on the environment endpoint.

## Impact

- `src/server/environment.ts`, `src/server/api.ts` (environment route), `src/ui/api.ts`, `src/ui/setupWizard.tsx`,
  `src/ui/setupState.ts`, the demo's environment report in `src/ui/demo/`, and the tests `test/environment.test.ts`,
  `test/environmentApi.test.ts` and the wizard tests. No new dependency, no new process, no network.
- `add-github-repositories` builds its Workspace-step changes on this order and depends on this change.
