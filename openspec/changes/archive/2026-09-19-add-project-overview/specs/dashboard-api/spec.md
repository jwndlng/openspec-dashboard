## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
All filesystem writes MUST be confined to `~/.openspec-dashboard/`. Git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`). Because `git status` refreshes the index by default, every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`) so that not even `.git/index` is rewritten.

#### Scenario: No side effects
- **WHEN** a full scan runs across all tracked repos
- **THEN** no file under any tracked repository is created, modified or deleted

#### Scenario: Status does not refresh the index
- **WHEN** a scan runs `git status` in a repository whose index has stale stat information
- **THEN** the repository's `.git/index` file is byte-for-byte unchanged afterwards
