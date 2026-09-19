## ADDED Requirements

### Requirement: Scanner polls enabled repositories on an interval
The scanner SHALL scan every enabled repository each `pollIntervalSeconds` (default 60) and on explicit trigger. Repositories MUST be scanned concurrently with a bounded concurrency (default 4) and a per-repository timeout. If a scan is already in flight, a trigger MUST NOT start a second concurrent full scan.

#### Scenario: Periodic scan
- **WHEN** the dashboard is running with `pollIntervalSeconds: 60`
- **THEN** every enabled repository is rescanned at least once per 60 seconds

#### Scenario: Trigger while in flight
- **WHEN** a scan is running and `POST /api/scan` is called
- **THEN** the response is `{ started: false }` and no second scan starts

### Requirement: Artifact status is computed with the OpenSpec library
For every change directory under `openspec/changes/` (excluding `archive/`) and under `openspec/changes/archive/`, the scanner SHALL compute artifact statuses using `@fission-ai/openspec` (`resolveSchema`, `loadChangeContext`, `formatChangeStatus`) in-process. The scanner MUST NOT invoke the `openspec` CLI. Artifacts MUST be reported in schema order with status `done`, `ready` or `blocked`.

#### Scenario: Spec-driven change with proposal only
- **WHEN** a change contains only `proposal.md`
- **THEN** artifacts are reported as `proposal: done`, `design: ready`, `specs: ready`, `tasks: blocked`

#### Scenario: Repos written by older CLI versions
- **WHEN** a repository was initialised with OpenSpec CLI 1.3.x
- **THEN** its changes are parsed and reported without error

### Requirement: Task progress is derived from tasks.md
The scanner SHALL count completed and total task checkboxes in the change's tasks artifact, recognising `- [x]`, `- [ ]`, `* `, `+ ` and ordered-list markers, case-insensitive `x`. When the tasks artifact does not exist, `tasks` MUST be `null`.

#### Scenario: Mixed markers
- **WHEN** `tasks.md` contains `- [x] a`, `* [ ] b`, `1. [X] c`
- **THEN** progress is `done: 2, total: 3`

#### Scenario: Missing tasks file
- **WHEN** the change has no `tasks.md`
- **THEN** `tasks` is `null`

### Requirement: Dates and archive state are read from disk
The scanner SHALL read `created` from `.openspec.yaml` when present, and SHALL mark a change as archived with the date parsed from its directory name `YYYY-MM-DD-<name>` when located under `changes/archive/`. If the archive directory name has no date prefix, the change is still archived with `archived` set from the directory mtime.

#### Scenario: Archived change with date prefix
- **WHEN** a change lives at `openspec/changes/archive/2026-07-20-yaml-settings/`
- **THEN** it is reported with `name: yaml-settings`, `archived: 2026-07-20`

### Requirement: Last activity comes from git with a filesystem fallback
For each non-archived change and for the 25 most recently archived changes, the scanner SHALL set `lastActivityAt` to the committer date of the latest commit touching the change directory (`git log -1 --format=%cI -- <changeDir>`). If the repository is not a git repository or the path has no commits, `lastActivityAt` MUST fall back to the newest file mtime within the change directory. Git MUST only be invoked with read-only commands and with `cwd` set to the repository.

#### Scenario: Committed change
- **WHEN** the latest commit touching `openspec/changes/foo` is dated `2026-07-20T14:26:00+02:00`
- **THEN** `lastActivityAt` is `2026-07-20T14:26:00+02:00`

#### Scenario: Uncommitted new change
- **WHEN** a change directory exists but has never been committed
- **THEN** `lastActivityAt` equals the newest mtime inside that directory

### Requirement: Branch and worktree matching
The scanner SHALL record the repository's current branch and its worktrees (`git worktree list --porcelain`). A change SHALL get `branchMatch` set to the first branch or worktree branch whose name contains the change name.

#### Scenario: Feature branch checked out in a worktree
- **WHEN** a worktree is on branch `feat/structured-report-format` and a change `structured-report-format` exists
- **THEN** the change has `branchMatch: feat/structured-report-format`

### Requirement: Per-repository failure isolation and snapshot caching
A failure in one repository MUST NOT fail the scan; the repository is reported with `ok: false` and an `error`, retaining the changes from its last successful scan. After each scan the full snapshot SHALL be written to `~/.openspec-dashboard/cache/snapshot.json`, and on startup the cached snapshot SHALL be served until the first scan completes.

#### Scenario: One repo path was deleted
- **WHEN** an enabled repo's path no longer exists
- **THEN** that repo shows `ok: false` with an error and other repos are scanned normally

#### Scenario: Startup serves cache
- **WHEN** the dashboard starts and a cached snapshot exists
- **THEN** `GET /api/state` returns the cached snapshot immediately, and the fresh one once the first scan finishes

### Requirement: Change directory names are validated before use
The scanner MUST only process change directories whose name matches `^[A-Za-z0-9._-]+$` (after stripping the archive date prefix) and MUST skip and report any other name, so that no untrusted path segment reaches a git invocation.

#### Scenario: Unexpected directory name
- **WHEN** a directory named `foo;rm -rf` exists under `openspec/changes/`
- **THEN** it is skipped and listed in the repository's warnings
