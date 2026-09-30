# Proposal

## Why

Everything the dashboard and the agents it starts depend on lives outside the dashboard: `git`, a committer identity,
the `openspec` CLI, the agent executable, `gh` for the pull request Ship asks for. When one of them is missing or
unconfigured, nothing says so up front — the failure surfaces minutes later inside an agent's terminal, in a Ship that
cannot open a pull request, or in a worktree that was never created. Only the agent executable is checked today, and
only where a starter is offered. The user needs one place that says, before any work starts, what this machine is
missing and what to do about it.

## What Changes

- A new **environment report**: a set of named checks of the machine the dashboard runs on, each with a status
  (`ok`, `warning`, `problem`, or `not needed` when the feature requiring it is switched off), what was found, and one
  line on how to fix it. The checks are `git` on the PATH, the git committer identity (`user.name`, `user.email`), the
  `openspec` CLI, each configured agent's executable, GitHub CLI credentials, and the dashboard's own home directory
  being present and writable. Which checks matter is derived from the configuration: `gh` and the agent executables are
  `not needed` while agent sessions are off.
- The report is computed **locally and read-only**: executable lookups on the PATH, `git config --get` run outside every
  tracked repository, a write probe under `~/.openspec-dashboard/`, and the presence of `gh`'s stored credentials —
  never their value. **No network**, so a configured GitHub token that has expired reads as `ok`; the report says that
  validity is only known when the agent uses it. Invariant 4 stays as it is, and no new git subcommand is introduced:
  `config --get` is already an allowed read-only invocation.
- A new **Environment** section at the end of Settings listing every check, with **Re-check**. Its navigation entry
  shows the number of checks that are not `ok` and is emphasised when that number is greater than zero.
- A new indicator in the hero's status corner, shown only while a check is failing: text and icon, linking to the
  Environment section, so a problem is visible from the board before the user starts anything.
- `GET /api/environment` returns the report. It is a read-only GET; no mutating route is added.
- The demo build serves a fixed report in which every check passes, spawning no process.

## Capabilities

### New Capabilities
- `environment-check`: the environment report — which checks exist, what each one inspects and the statuses it can
  have, that the report is local-only and never contacts a network or writes to a tracked repository, how the
  configuration decides which checks are needed, when the report is recomputed, and what the report says about what it
  cannot know.

### Modified Capabilities
- `settings-page`: the section list gains `environment` as the last section, and the navigation counts requirement
  gains the count of failing checks for that entry.
- `dashboard-api`: a new requirement for `GET /api/environment` and what it may and may not do.
- `kanban-board`: a new requirement for the environment indicator in the hero's status corner.
- `demo-site`: a new requirement for the demo's fixed, all-passing report.

## Impact

- New: `src/server/environment.ts` (the checks), `src/ui/environment.tsx` (the Settings section), types in
  `src/shared/types.ts`, `test/environment.test.ts`.
- Changed: `src/server/api.ts` (one GET route), `src/ui/settingsSections.ts` and `src/ui/settings.tsx` (the section and
  its count), `src/ui/app.tsx` (the hero indicator), `src/ui/api.ts` (the fetch), `src/ui/demo/` (the fixed report),
  `src/ui/styles.css`.
- No new dependency and no new external command: the only process the report starts is `git config --get`, already
  enumerated as read-only in `dashboard-api`. Nothing in a tracked repository is read or written for the report.
- Overlap with in-flight changes: `dashboard-api`'s "never writes" requirement is modified by `list-recently-opened-prs`,
  `recover-blocked-pull` and `dismiss-task`, and `kanban-board`'s hero header requirement by `add-auto-refresh`. This
  change therefore adds requirements to both specs instead of modifying those, and modifies only `settings-page`, which
  no in-flight change touches.
