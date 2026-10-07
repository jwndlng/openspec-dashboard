## Why

`rename-to-spec-control` renamed everything a person sees and the executable, but deliberately left the identifiers
stored on users' machines and in their repositories under the old name, because changing them needs a migration. Until
they move, the codebase carries two names, and new contributors and agents keep wondering which one is right.

## What Changes

- The home directory moves from `~/.openspec-dashboard/` to `~/.spec-control/`. On first start, when only the old home
  exists, the binary migrates it with one rename: `config.json`, `activity.jsonl`, session records, pull backups, the
  scratch object store, the console folder and the session worktrees move together, stored paths that point into the
  old home are rewritten, and every git worktree the dashboard created is re-registered with `git worktree repair` in
  its repository, so no worktree record points at a missing directory. A symbolic link at the old path keeps paths
  held elsewhere (open shells, editors, scripts) working. A migration that cannot start (the old home cannot be
  renamed, or another instance is still serving) leaves the old home in place and in use, and says why; steps that
  fail after the rename are reported and retried on the next start.
- `OPENSPEC_DASHBOARD_HOME` becomes `SPEC_CONTROL_HOME` and `OPENSPEC_DASHBOARD_VERSION` becomes
  `SPEC_CONTROL_VERSION`; the old variables are still read, for one release, when the new ones are unset.
- Browser storage keys `openspec-dashboard.*` become `spec-control.*`; the UI copies a stored value from the old key
  the first time it reads a new key that is empty, so theme, tour, groups, auto-refresh and What's new state survive.
- The shared-config markers `openspec-dashboard:shared` in tracked repositories' `openspec/config.yaml` become
  `spec-control:shared`. The old markers are still recognised; a section is rewritten with the new marker only when the
  user applies a profile again, so no repository is touched without a user action.
- The `depends-on.yaml` header names `spec-control`; existing files are left as they are.
- **BREAKING (for scripts):** anything that sets `OPENSPEC_DASHBOARD_HOME` keeps working for one release only.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `dashboard-api`: home directory, environment variables, the home migration, and the "never writes" list gains the
  `git worktree repair` the migration runs.
- `shared-config`: markers are written as `spec-control:shared`, and old markers are still recognised.
- `kanban-board`: storage keys and their one-time copy.
- `release-publishing`: `SPEC_CONTROL_VERSION`, and `--version` moves nothing.
- Path only (`~/.openspec-dashboard/` becomes `~/.spec-control/`, behaviour unchanged): `activity-feed`,
  `agent-sessions`, `change-scanner`, `main-console`, `project-console`, `project-labels`, `pull-requests`,
  `repo-discovery`, `repo-hygiene`, `repo-integration`, `repository-cleanup`, `repository-pull`.

## Impact

- Code: `src/server/paths.ts`, a new home-migration module, `src/server/index.ts`, `src/server/environment.ts`,
  `src/server/version.ts`, `src/server/sessions/worktree.ts`,
  `src/server/sharedConfig.ts`, `src/server/createChange.ts`, `src/ui/*State.ts` and other modules holding storage keys,
  `src/ui/demo/*`, UI text naming the home (`settings.tsx`, `agentSettings.tsx`, `helpContent.tsx`, `pullState.ts`),
  `src/ui/changelog.ts`, `scripts/build.ts`, `.github/workflows/release.yml`.
- Docs: `CLAUDE.md` (drop the note that the old name stays on purpose, and update every `~/.openspec-dashboard/` path),
  README, CONTRIBUTING.
- Tests that set `OPENSPEC_DASHBOARD_HOME` or assert on markers and storage keys.
- Users: one automatic migration on first start; nothing else to do.
