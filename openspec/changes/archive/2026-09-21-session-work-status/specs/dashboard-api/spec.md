## ADDED Requirements

### Requirement: Worktree and ship endpoints
`GET /api/sessions` SHALL additionally return `worktrees`: one entry per session worktree directory of a configured repository with `repoId`, `name`, `path`, the `change` and `action` it belongs to, its `branch`, its work status, the time of its last activity, and the id of its most recent session if a record exists. When agent sessions are disabled the list SHALL be empty and no git command SHALL be run for it. `POST /api/sessions/<id>/ship` SHALL perform the Ship action and return the session; it MUST be refused with `403` when agent sessions are disabled, `409` when there is nothing to ship or another session for the change is running, and `503` when the agent's executable is not found. `POST /api/worktrees/remove` with `{ repoId, name }` SHALL remove that worktree under the clean-up rules and return whether it was removed and, if not, why; `repoId` MUST be a configured repository and `name` MUST be a single path segment of lower-case letters, digits, dots, dashes and underscores, otherwise the response is `404` or `400`; it MUST be refused with `409` while a session is running in the worktree. Both `POST` routes are subject to the same-origin protection.

#### Scenario: Worktrees in the session list
- **WHEN** agent sessions are enabled and one session worktree with an untracked file exists
- **THEN** `GET /api/sessions` returns it in `worktrees` with status `uncommitted`

#### Scenario: Path traversal
- **WHEN** `POST /api/worktrees/remove` is sent with `name` set to `../x`
- **THEN** the response is `400` and no git command is run

#### Scenario: Removing under a running session
- **WHEN** `POST /api/worktrees/remove` names the worktree of a running session
- **THEN** the response is `409` and the worktree is kept

## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action, and then only as enumerated here: (1) `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles); (2) for agent sessions, creating a git worktree and its branch for a session (`git worktree add`, preceded by `git worktree prune`), with the worktree's directory placed under `~/.openspec-dashboard/worktrees/` and never inside the repository's working tree, and removing such a worktree with a non-forcing `git worktree remove` after the user confirmed and read-only checks proved that it holds no uncommitted change and no work that exists nowhere else. Apart from those worktree commands the dashboard MUST NOT delete or move anything in a tracked repository, MUST NOT change the main checkout's branch, index or working tree, and MUST NOT contact a remote. All other filesystem writes MUST be confined to `~/.openspec-dashboard/`. Scanning, polling, discovery, previews, reading work statuses and saving any dashboard setting MUST NOT write to a tracked repository. Apart from the worktree commands above, git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `show-ref`, `symbolic-ref`, `for-each-ref`, `rev-list`, `diff`). Because `git status` refreshes the index by default, every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`) so that not even `.git/index` is rewritten. When agent sessions are enabled, the dashboard MAY start the user's configured agent in a session's worktree on the user's explicit request; what that agent changes, commits or pushes is the agent's doing under its own permission prompts and is never done by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

#### Scenario: No side effects
- **WHEN** a full scan runs across all tracked repos
- **THEN** no file under any tracked repository is created, modified or deleted

#### Scenario: Status does not refresh the index
- **WHEN** a scan runs `git status` in a repository whose index has stale stat information
- **THEN** the repository's `.git/index` file is byte-for-byte unchanged afterwards

#### Scenario: Preview and save have no side effects
- **WHEN** shared config profiles are saved and a preview is requested for every tracked repository
- **THEN** no file under any tracked repository is created, modified or deleted

#### Scenario: Apply touches exactly one file
- **WHEN** shared config profiles are applied to a repository
- **THEN** `openspec/config.yaml` is the only path under that repository that is created, modified or deleted

#### Scenario: Opening a session leaves the main checkout alone
- **WHEN** a session is opened for a change
- **THEN** the repository's checked-out branch and `git status` are unchanged, and no new file or directory appears in its working tree

#### Scenario: Reading work statuses has no side effects
- **WHEN** work statuses are read for a worktree whose index has stale stat information
- **THEN** no file in the worktree or in the repository's git directory is modified
