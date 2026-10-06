# Spec Delta

## ADDED Requirements

### Requirement: Repository snapshots report a git repository with no commit to branch from
For each successfully scanned git repository the scanner SHALL report `noCommit: true` when the repository has nothing
to branch a session from: `HEAD` names no commit and `refs/remotes/origin/HEAD` does not exist. Otherwise the field SHALL
be omitted, and it SHALL always be omitted for a repository that is not a git repository. Determining it MUST use only
read-only git commands already permitted, MUST NOT contact a remote, and a failure to determine it MUST NOT fail the
repository's scan; when it cannot be determined the field SHALL be omitted. When a repository's scan fails, the previous
value SHALL be retained.

#### Scenario: Freshly initialised repository
- **WHEN** the tracked repository `/w/acme/fresh-app` was created with `git init`, has an `openspec/` tree and no commit,
  and has no remote
- **THEN** its snapshot reports `isGit: true` and `noCommit: true`, and the scan otherwise succeeds

#### Scenario: Repository with a commit
- **WHEN** the tracked repository `/w/acme/demo-ops` has at least one commit on its checked-out branch
- **THEN** its snapshot carries no `noCommit`

#### Scenario: Folder without git
- **WHEN** a tracked folder has an `openspec/` tree but no `.git`
- **THEN** its snapshot reports `isGit: false` and carries no `noCommit`
