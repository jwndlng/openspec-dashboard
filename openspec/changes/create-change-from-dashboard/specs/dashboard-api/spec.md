# Spec Delta

## ADDED Requirements

### Requirement: Create-change endpoint
`POST /api/repos/<id>/changes` SHALL create a new OpenSpec change in the repository identified by `<id>`. The request body SHALL be JSON `{ name, prompt? }`, where `name` is a valid change name (`^[A-Za-z0-9._-]+$`) and `prompt` is an optional string. On success the response is `201` with `{ name }` and the repository is rescanned. On failure the response is `400` (invalid body or invalid name), `404` (unknown repository) or `409` (repository disabled, last scan failed, no `openspec/` parent, or an active or archived change already uses that name) with a JSON message. The endpoint MUST NOT write anything to the repository unless the request succeeds; a failed request MUST leave the repository byte-for-byte unchanged. The endpoint is mutating and MUST pass the same-origin protection.

#### Scenario: Successful create
- **WHEN** `POST /api/repos/<id>/changes` is called with `{ "name": "add-audit-trail" }` for an enabled, successfully scanned repository that has no `add-audit-trail` change
- **THEN** the response is `201` with `{ "name": "add-audit-trail" }`, `openspec/changes/add-audit-trail/.openspec.yaml` exists in that repository, and a following `GET /api/state` reflects the new change

#### Scenario: Invalid name
- **WHEN** the request body is `{ "name": "foo/bar" }`
- **THEN** the response is `400` and nothing is written

#### Scenario: Duplicate name
- **WHEN** an active `add-audit-trail` change already exists
- **THEN** the response is `409` and nothing is written

#### Scenario: Cross-site
- **WHEN** a page on another origin posts to the endpoint
- **THEN** the response is `403` and nothing is written

## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action, and then only as enumerated here: (1) `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles); (2) for agent sessions, creating a git worktree and its branch for a session (`git worktree add`, preceded by `git worktree prune`), with the worktree's directory placed under `~/.openspec-dashboard/worktrees/` and never inside the repository's working tree, and removing such a worktree with a non-forcing `git worktree remove` after the user confirmed and read-only checks proved that it holds no uncommitted change and no work that exists nowhere else; (3) the pull action: `git fetch` from the repository's own remote followed by a fast-forward-only `git merge` of the main checkout's upstream, with repository hooks disabled, as specified in the `repository-pull` capability; (4) creating a new change directory at `openspec/changes/<name>/` with its `.openspec.yaml` marker and an optional `prompt.md`, as specified in the `change-creation` capability — the dashboard writes those files itself and MUST NOT invoke the `openspec` CLI or any other external command for it. Apart from those worktree commands the dashboard MUST NOT delete or move anything in a tracked repository. Apart from the pull action it MUST NOT change the main checkout's index or working tree beyond the create-change directory above, and MUST NOT contact a remote, and it MUST NOT change the main checkout's branch at all. The pull action MUST NOT run except on the user's explicit request for that repository (or for all repositories): never on a timer, during a scan, on page load or as a side effect of another operation. All other filesystem writes MUST be confined to `~/.openspec-dashboard/`. Scanning, polling, discovery, previews, reading work statuses and saving any dashboard setting MUST NOT write to a tracked repository. Apart from the worktree commands and the pull action's `fetch` and `merge --ff-only` above, git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `show-ref`, `symbolic-ref`, `for-each-ref`, `rev-list`, `diff`). Because `git status` refreshes the index by default, every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`) so that not even `.git/index` is rewritten. When agent sessions are enabled, the dashboard MAY start the user's configured agent in a session's worktree on the user's explicit request; what that agent changes, commits or pushes is the agent's doing under its own permission prompts and is never done by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

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

#### Scenario: A refused session creates nothing
- **WHEN** opening a session is refused
- **THEN** no worktree and no branch is created

#### Scenario: Feature disabled means no processes
- **WHEN** agent sessions are disabled and any API request is made
- **THEN** no agent process is started and no repository is touched

#### Scenario: No network unless asked
- **WHEN** the dashboard starts, serves the UI, runs full scans on its poll interval and reads work statuses, and nobody uses the pull action
- **THEN** no git command that contacts a remote is run and no main checkout's index or working tree changes

#### Scenario: Pull changes only what a fast-forward changes
- **WHEN** the pull action is used on a repository
- **THEN** only its git directory and the files the fast-forward updates in its main checkout change, its checked-out branch is the same as before, and no linked worktree's files, index or branch change

#### Scenario: Create-change touches only the new directory
- **WHEN** a change is created via `POST /api/repos/<id>/changes`
- **THEN** the only path under that repository that is created, modified or deleted is the new `openspec/changes/<name>/` directory and its files

#### Scenario: Failed create writes nothing
- **WHEN** `POST /api/repos/<id>/changes` is refused for any reason
- **THEN** no file, directory or git ref under that repository changes
