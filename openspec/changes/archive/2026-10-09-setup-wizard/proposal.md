# Proposal

## Why

A first start today lands on an empty projects overview: no workspace root, no tracked project, agent sessions off,
and nothing that says what to do next. Everything needed is there, but it is spread over Settings (Workspace roots,
Agent sessions, Environment) and the overview, and the environment report only says "Install git" without saying how.
A short setup wizard on the first start walks a new user through the three things that decide whether the dashboard is
useful at all — where their projects live, which agent to use, and whether the tools it relies on are installed — and
tells them how to fix whatever is missing.

## What Changes

- A **setup wizard** opens by itself on the first start of a fresh installation (no `config.json` yet), as a dialog over
  the page, with the steps **Welcome**, **Workspace**, **Agents**, **System check** and **Done**. Every step can be
  skipped, and **Skip setup** ends the wizard at any step.
- **Workspace**: the user adds one or more workspace roots, with suggestions for common folders that exist directly in
  their home directory (`~/Workspace`, `~/Projects`, `~/Developer`, …); discovery runs against the entered roots without
  saving, lists the OpenSpec projects found (all selected for tracking) and counts the git repositories without OpenSpec,
  pointing to the overview for those. Continuing saves the roots and tracks the selected projects.
- **Agents**: states what agent sessions do and their risks, as Settings does, and offers to switch them on (off by
  default) with a default agent chosen from the configured profiles and the presets, each marked found or not found on
  this machine. When the chosen agent is not installed, its install instructions are shown. Continuing saves the choice.
- **System check**: the environment report for the configuration just saved, with **Re-check**, and for each check that
  is not `ok` concrete, platform-specific instructions with commands to copy (never run by the dashboard).
- **Done**: what was set up and what is left, then the onboarding tour starts, as it does today on a first visit.
- The wizard only adds: it adds roots, tracks projects, switches agent sessions on, adds a preset profile and picks the
  default agent. It never removes a root, untracks a project, switches agent sessions off or deletes a profile.
- A fresh configuration carries `setup: "pending"`; finishing or skipping the wizard clears it with a new
  `POST /api/setup/done`, so the wizard opens once per installation, not once per browser. Configurations written by an
  earlier version have no `setup` key and never show the wizard by itself.
- **Help** offers **Run setup again**, which opens the wizard with the current configuration prefilled.
- The environment report's checks gain optional **instructions** (ordered steps with an optional command), chosen for
  the platform the server runs on; agent presets carry their install command.
- The onboarding tour waits until the wizard is closed; the demo never opens the wizard by itself.

## Capabilities

### New Capabilities
- `setup-wizard`: the first-start wizard — when it opens, its steps, what each step saves, Skip, completion, re-running
  it from Help, and its behaviour in the demo.

### Modified Capabilities
- `environment-check`: checks that are not `ok` may carry platform-specific install or setup instructions with copyable
  commands; agent presets supply their install command.
- `repo-discovery`: the configuration gains `setup` (`"pending"` only in a configuration created on first start or after
  a reset); earlier configurations load without it.
- `dashboard-api`: `PUT /api/config` keeps the stored `setup` value whatever the body says; new `GET /api/setup` (pending
  state, workspace-root suggestions and the server's platform) and `POST /api/setup/done`.
- `onboarding-tour`: the tour does not start by itself while the setup wizard is open or pending.
- `help-page`: Help offers **Run setup again** next to **Take the tour**.

## Impact

- `src/server/setup.ts` (new): the root suggestions (a fixed list of folder names, checked with `stat` directly in the
  home directory) and clearing the pending flag. `src/server/config.ts`: the `setup` field, set on first start and on
  reset, kept by `PUT /api/config`. `src/server/api.ts`: the two routes. `src/server/environment.ts`: instructions per
  check and platform.
- `src/shared/types.ts` (`Config.setup`, `SetupState`, `EnvironmentCheck.instructions`), `src/shared/agentDefaults.ts`
  (preset install commands).
- `src/ui/setupWizard.tsx`, `src/ui/setupState.ts` (new); `src/ui/app.tsx` (opening it, ordering it before the tour),
  `src/ui/tourState.ts`, `src/ui/help.tsx`, `src/ui/helpContent.tsx`, `src/ui/environment.tsx` (shows instructions in
  Settings too), `src/ui/api.ts`, `src/ui/styles.css`, `src/ui/changelog.ts`, `src/ui/demo/demoApi.ts`.
- Tests: config migration and first start, the two endpoints (including the cross-site guard), suggestions with a
  temporary home, instructions per platform, the wizard's step logic and the tour ordering. `README.md`: the first start.
- No new write outside `~/.spec-control/`, no network, no new process: the wizard uses the existing config, discovery,
  tracking and environment endpoints, and suggestions only `stat` folders in the home directory. Invariants 1 and 4 are
  unchanged.
- `src/server/config.ts`, `src/shared/types.ts`, `src/ui/app.tsx`, `src/ui/api.ts` and `src/ui/demo/demoApi.ts` are also
  touched by in-flight changes (`add-validate-phase`, `update-notice`); the edits here are additive and rebase on them.
