## Why

OpenSpec work is spread across ~18 repositories (`~/Workspace/{prvt,acme,ops}`) with ~40 active and ~96 archived changes, and there is no single place to see what is open, what is stuck, and what was finished recently. As more of this work is driven by agents in parallel, staying on top of it by opening repos one at a time no longer scales — especially for infrastructure hygiene changes that repeat across many repos.

## What Changes

- Introduce **openspec-dashboard**: a local-first, read-only dashboard shipped as a single Bun binary that indexes every tracked OpenSpec repository on this machine.
- **Repository discovery**: scan configured workspace roots for `openspec/config.yaml`, list found repos, and let the user opt in per repo. Config lives in `~/.openspec-dashboard/config.json`.
- **Scanner**: poll enabled repos on an interval, compute per-change artifact status via the `@fission-ai/openspec` library (in-process, no CLI shell-outs), task progress from `tasks.md`, archive dates, last git activity, and matching branch/worktree. Snapshot cached in `~/.openspec-dashboard/cache/`.
- **Kanban view**: one board across all tracked repos. Columns are derived from each change's schema artifact order, followed by `Implementing`, `Done` (all tasks complete, not yet archived) and `Archived`. Cards show repo, change name, progress, last-activity age and a branch badge. Filters: repo, text search, stale-for-N-days, hide archived.
- **Settings view**: workspace roots, discovery results with enable toggles, editable repo display names, poll interval.
- **Agent seam**: a per-card "copy command" producing `cd <repo> && claude "/opsx:apply <change>"`. No execution, no writes to repos.
- Non-goals for this change: activity feed, cross-repo campaign grouping, remote git sources, agent dispatch, multi-user/auth, light theme, writing to repositories.

## Capabilities

### New Capabilities
- `repo-discovery`: finding OpenSpec-enabled repositories under configured roots, opt-in tracking, and persisted dashboard configuration.
- `change-scanner`: periodic, fault-tolerant indexing of tracked repos into a change snapshot (artifact status, task progress, dates, git activity, branch match).
- `kanban-board`: the cross-repo Kanban UI, column derivation rules, card content, and filters.
- `dashboard-api`: the local HTTP API the UI consumes (state snapshot, config read/write, scan and discovery triggers).

### Modified Capabilities
<!-- none — greenfield project -->

## Impact

- New codebase (currently empty besides `openspec/`): Bun + TypeScript backend, small TypeScript SPA embedded in the binary, `git init` and project scaffolding required.
- Runtime dependency on `@fission-ai/openspec` (pinned 1.13.x) for artifact-graph/status computation; must read repos created by older CLI versions (1.3.x).
- Reads the filesystem and runs `git` (read-only commands) in tracked repos. Writes only to `~/.openspec-dashboard/`.
- Establishes the data model (Project, Change, Snapshot) that later changes (activity feed, dispatcher, remote sources) will build on.
