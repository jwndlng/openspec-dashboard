# change-scanner Specification

## Purpose
Defines how the scanner polls tracked repositories and derives each change's artifact status, task progress, dates, git activity and branch matches, with per-repository failure isolation and snapshot caching.
## Requirements
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
For each non-archived change and for the 25 most recently archived changes, the scanner SHALL determine the committer date of the latest commit touching the change directory (`git log -1 --format=%cI -- <changeDir>`). For every change in a git repository, the scanner SHALL also consider the modification time of each file under the change directory that git reports as modified, added, deleted, renamed or untracked relative to `HEAD`. `lastActivityAt` SHALL be the most recent of these instants. Modification times of files that git reports as unchanged MUST NOT be considered, so that clones, checkouts and rebases do not alter `lastActivityAt`. If the repository is not a git repository, or the path has neither commits nor reported files, `lastActivityAt` MUST fall back to the newest file mtime within the change directory. Git MUST only be invoked with read-only commands and with `cwd` set to the repository.

#### Scenario: Committed change
- **WHEN** the latest commit touching `openspec/changes/foo` is dated `2026-07-20T14:26:00+02:00` and git reports no modified or untracked files under it
- **THEN** `lastActivityAt` is `2026-07-20T14:26:00+02:00`

#### Scenario: Uncommitted new change
- **WHEN** a change directory exists but has never been committed
- **THEN** `lastActivityAt` equals the newest mtime inside that directory

#### Scenario: Uncommitted edit to a committed change
- **WHEN** `openspec/changes/foo/design.md` was last committed three weeks ago and has been modified on disk two minutes ago without committing
- **THEN** `lastActivityAt` is the modification time from two minutes ago

#### Scenario: Fresh checkout does not look recent
- **WHEN** a repository was cloned one minute ago, its working tree is clean, and the latest commit touching `openspec/changes/foo` is five months old
- **THEN** `lastActivityAt` is the five-month-old commit date

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

### Requirement: Repository last-updated time covers the whole openspec directory
For each successfully scanned repository the scanner SHALL set `lastUpdatedAt` to the most recent of: the committer date of the latest commit touching the repository's `openspec/` directory, and the modification time of any file under `openspec/` that git reports as modified, added, deleted, renamed or untracked relative to `HEAD` (listing untracked files individually). A deleted file SHALL count with the modification time of its nearest existing parent directory. Modification times of unchanged files MUST NOT be considered. For a repository that is not a git repository, `lastUpdatedAt` SHALL be the newest file mtime under `openspec/`. The field SHALL cover all content under `openspec/`, including `specs/`, `config.yaml` and archived changes, not only change directories. When a repository's scan fails, its previous `lastUpdatedAt` SHALL be retained. Determining the value MUST use only read-only git commands, at most one status and one log invocation per repository per scan, and a failure of those commands MUST NOT fail the repository's scan.

#### Scenario: Spec edited outside any change
- **WHEN** `openspec/specs/auth/spec.md` is modified on disk and no change directory was touched for a month
- **THEN** the repository's `lastUpdatedAt` is the modification time of that spec file

#### Scenario: Only committed history
- **WHEN** the working tree is clean and the latest commit touching `openspec/` is dated `2026-09-01T10:00:00+02:00`
- **THEN** `lastUpdatedAt` is `2026-09-01T10:00:00+02:00`

#### Scenario: New untracked change directory
- **WHEN** an untracked directory `openspec/changes/new-idea/` contains `proposal.md` edited ten minutes ago
- **THEN** `lastUpdatedAt` is that file's modification time, even if the directory's own mtime is older

#### Scenario: Non-git repository
- **WHEN** the repository is not a git repository
- **THEN** `lastUpdatedAt` is the newest file mtime under `openspec/`

#### Scenario: Git status fails
- **WHEN** `git status` times out for a repository
- **THEN** the repository is still reported with `ok: true` and `lastUpdatedAt` from the latest commit touching `openspec/`

### Requirement: Spec sync state is derived from the repository
For each non-archived change whose tasks are all complete (`tasks.total > 0` and `tasks.done == tasks.total`), the scanner SHALL report `specsSynced`, stating whether the change's delta specs are already reflected in the repository's main specs. For every delta spec file `specs/<capability>/spec.md` in the change, compared with `openspec/specs/<capability>/spec.md`, the delta is synced when: every ADDED requirement exists in the main spec by name; every MODIFIED requirement exists and its full block equals the delta's block ignoring differences in surrounding, trailing and repeated blank whitespace; every REMOVED requirement is absent; and for every RENAMED pair the new name exists and the old name does not. `specsSynced` SHALL be `true` only when every delta file is synced, and SHALL be `true` for a change with no delta spec files or only empty deltas. A missing main spec SHALL count as not synced when the delta adds or modifies requirements. The state MUST be derived only by reading files in the repository: the scanner MUST NOT write a marker, invoke git, or invoke the `openspec` CLI for it. If the delta or main spec cannot be read or parsed, `specsSynced` SHALL be `false` and the problem SHALL be listed in the change's warnings without failing the repository's scan. For changes that are archived or whose tasks are not all complete, `specsSynced` SHALL be omitted.

#### Scenario: Delta not applied yet
- **WHEN** a complete change adds requirement `Two-factor login` to capability `auth` and `openspec/specs/auth/spec.md` has no such requirement
- **THEN** `specsSynced` is `false`

#### Scenario: Delta applied
- **WHEN** the same change's added requirement is present in `openspec/specs/auth/spec.md`, and its modified requirement `Session timeout` has the same text there as in the delta
- **THEN** `specsSynced` is `true`

#### Scenario: Modified requirement still has the old text
- **WHEN** the delta modifies `Session timeout` and the main spec still contains the previous wording
- **THEN** `specsSynced` is `false`

#### Scenario: Removal and rename
- **WHEN** the delta removes `Legacy export` and renames `Login` to `Sign in`, and the main spec has no `Legacy export`, has `Sign in` and has no `Login`
- **THEN** `specsSynced` is `true`

#### Scenario: New capability whose main spec does not exist
- **WHEN** the delta adds requirements to capability `billing` and `openspec/specs/billing/spec.md` does not exist
- **THEN** `specsSynced` is `false`

#### Scenario: No delta specs
- **WHEN** a complete change has no `specs/` directory
- **THEN** `specsSynced` is `true`

#### Scenario: Agrees with the OpenSpec tool
- **WHEN** a change's deltas have been applied to the main specs by `openspec archive`
- **THEN** evaluating those deltas against the resulting main specs yields `specsSynced: true`

#### Scenario: Unparseable delta
- **WHEN** a delta spec file cannot be parsed
- **THEN** `specsSynced` is `false`, the change carries a warning, and the repository is still reported with `ok: true`

#### Scenario: Change still in progress
- **WHEN** a change has `tasks` `done: 3, total: 12`
- **THEN** `specsSynced` is omitted and no spec files are read for it

### Requirement: Repository snapshots report the carried shared-config profiles
When at least one shared config profile exists, the scanner SHALL set each successfully scanned repository's `sharedConfig` to `{ unreadable, applied }`, where `applied` lists the profiles its `openspec/config.yaml` carries, each with the state `in-sync`, `outdated` or `orphaned`, derived from the text of that file and the stored profiles. The scanner MUST derive it by reading that one file only, MUST NOT write anything, and a failure to read or parse the file MUST yield `unreadable: true` rather than failing the repository's scan. While no profile exists, the field SHALL be omitted. When a repository's scan fails, its previous value SHALL be retained.

#### Scenario: State in the snapshot
- **WHEN** profile `base` exists and a repository's config carries an identical managed section for it
- **THEN** that repository's snapshot has `sharedConfig.applied: [{ id: "base", state: "in-sync" }]`

#### Scenario: No profiles
- **WHEN** no profile exists
- **THEN** no repository snapshot contains `sharedConfig`

#### Scenario: Broken config file
- **WHEN** a repository's `openspec/config.yaml` is not valid YAML
- **THEN** the repository is reported with `ok: true` and `sharedConfig.unreadable: true`

