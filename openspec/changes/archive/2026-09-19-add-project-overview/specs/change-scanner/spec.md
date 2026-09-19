## MODIFIED Requirements

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

## ADDED Requirements

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
