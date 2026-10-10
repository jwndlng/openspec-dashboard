# Design

## Context

`STEP` in `src/ui/setupWizard.tsx` is `welcome, workspace, agents, console, projects, system, done`. The System check
calls `api.environment(true)`; `src/server/environment.ts` derives each check's status from the configuration and the
last scan. The Agents step's found/not-found marks come from its own executable lookup (`setupState.ts`
`agentChoices`), not from the report.

## Goals / Non-Goals

**Goals:** check tools before the steps that use them; one place per kind of check; no `not-needed` verdict for a
setup that has not been saved yet.

**Non-Goals:** changing Settings' Environment section or the report's checks; running any install command.

## Decisions

### D1. A server-side setup view, not filtering in the UI
`computeEnvironment(config, scan, { view: "setup" })` drops `agent:*` and swaps the needed-ness rules for fixed setup
verdicts. Filtering in the UI was rejected: the needed-ness rules live on the server, and at step two the configuration
says "agent sessions off", which would leave `gh` and the identity as `not-needed` with no instructions. The cache is
keyed per view. Any other `view` is a `400`.

### D2. Agents keep their own lookup
The Agents step already has the lookup that marks agents found; **Check again** re-runs it. The hint "the System check
step shows whether each agent is found" is removed.

### D3. Done asks again
Done requests a fresh setup view (the System check ran before the user installed anything in later steps) and adds the
checked agents still not found from the Agents step's last lookup.

### D4. Demo
The demo's environment report gets the setup view in memory, as the mock API must implement every operation.

## Risks / Trade-offs

- [Two verdicts for the same machine — Settings `not-needed`, setup `warning`] → each view says what it judges; the
  setup view is used only by the wizard.
- [Order change surprises users who ran setup before] → setup is run rarely; the step list shows the new order.
