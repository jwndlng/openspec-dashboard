# Spec Delta

## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action, and then only as enumerated here: (1) `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles); (2) for agent sessions, creating a git worktree and its branch for a session (`git worktree add`, preceded by `git worktree prune`), with the worktree's directory placed under `~/.openspec-dashboard/worktrees/` and never inside the repository's working tree, and removing such a worktree with a non-forcing `git worktree remove` (preceded by `git worktree unlock`) after the user confirmed and read-only checks proved that it holds no uncommitted change and no work that exists nowhere else; (3) the pull action: `git fetch` from the repository's own remote followed by a fast-forward-only `git merge` of the main checkout's upstream, with repository hooks disabled, as specified in the `repository-pull` capability; (4) creating a new change directory at `openspec/changes/<name>/` with its `.openspec.yaml` marker and an optional `prompt.md`, as specified in the `change-creation` capability — the dashboard writes those files itself and MUST NOT invoke the `openspec` CLI or any other external command for it; (5) staging that new change directory, and only it, with a single `git add -- openspec/changes/<name>/` once those files are written, as specified in the `change-creation` capability — best-effort, never failing the creation, and never run for a refused create; (6) repository cleanup, as specified in the `repository-cleanup` capability, on the user's confirmation of items the user selected: removing any linked worktree of the repository with a non-forcing `git worktree remove` (preceded by `git worktree unlock` only for a worktree the dashboard created) after read-only checks proved that it holds no uncommitted change and no work that exists nowhere else, removing stale worktree records with `git worktree prune`, and deleting a local branch other than the default branch and the main checkout's branch with `git branch -D` after read-only checks proved that its work is in the default branch and that it still points at the commit the user saw. Apart from those worktree commands and that branch deletion the dashboard MUST NOT delete or move anything in a tracked repository. Apart from the pull action it MUST NOT change the main checkout's working tree beyond the create-change directory above, and MUST NOT change the main checkout's index beyond adding that same directory's files to it, and MUST NOT contact a remote, and it MUST NOT change the main checkout's branch at all. It MUST NOT commit, push, stash or reset in a tracked repository under any circumstances, and MUST NOT create or delete a ref except the session branch created with a session's worktree and the local branches deleted by repository cleanup; it MUST NOT delete a remote-tracking ref or a remote branch. The pull action MUST NOT run except on the user's explicit request for that repository (or for all repositories): never on a timer, during a scan, on page load or as a side effect of another operation. Apart from the pull action, the only network access the dashboard makes is the pull-request query of the `pull-requests` capability: it runs only the GitHub CLI's read-only `gh pr list` and `gh api user`, never any other `gh` subcommand, with its working directory outside every tracked repository, and only when the user asks for it as specified in that capability; it MUST NOT write to a tracked repository, run git, or change anything on GitHub. Scanning, polling, discovery and serving the UI MUST NOT start a `gh` process. All other filesystem writes MUST be confined to `~/.openspec-dashboard/`. Scanning, polling, discovery, previews, reading work statuses and saving any dashboard setting MUST NOT write to a tracked repository. Apart from the worktree commands, the pull action's `fetch` and `merge --ff-only`, the create-change `add` and the cleanup's `branch -D` above, git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `show-ref`, `symbolic-ref`, `for-each-ref`, `rev-list`, `diff`, `config --get`). Every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`), so that no invocation rewrites `.git/index` as a side effect — `git status` refreshes the index by default — and the create-change `add` is the only invocation that may write the index at all, which it does by design. When agent sessions are enabled, the dashboard MAY start the user's configured agent in a session's worktree on the user's explicit request; what that agent changes, commits or pushes is the agent's doing under its own permission prompts and is never done by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

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
- **WHEN** the dashboard starts, serves the UI, runs full scans on its poll interval and reads work statuses, and nobody uses the pull action or opens or refreshes a pull-request list
- **THEN** no git command that contacts a remote is run, no `gh` process is started, and no main checkout's index or working tree changes

#### Scenario: Pull changes only what a fast-forward changes
- **WHEN** the pull action is used on a repository
- **THEN** only its git directory and the files the fast-forward updates in its main checkout change, its checked-out branch is the same as before, and no linked worktree's files, index or branch change

#### Scenario: Create-change touches only the new directory
- **WHEN** a change is created via `POST /api/repos/<id>/changes`
- **THEN** the only path under that repository that is created, modified or deleted is the new `openspec/changes/<name>/` directory and its files, and the only other effect is those same files being added to the repository's index

#### Scenario: Create-change stages nothing else
- **WHEN** a change is created in a repository that already has unrelated modified and untracked files
- **THEN** none of those files is staged, and no ref, branch or commit changes

#### Scenario: Failed create writes nothing
- **WHEN** `POST /api/repos/<id>/changes` is refused for any reason
- **THEN** no file, directory, index entry or git ref under that repository changes, and no git command is run

#### Scenario: Cleanup preview has no side effects
- **WHEN** a cleanup preview is computed for a repository with merged worktrees and branches
- **THEN** no file under the repository, its git directory or its worktrees is created, modified or deleted, and no ref changes

#### Scenario: Cleanup deletes only confirmed local branches
- **WHEN** the user confirms a cleanup that selects one merged branch while two other merged branches exist
- **THEN** exactly that one `refs/heads/` ref is deleted, and no other ref, including every `refs/remotes/` ref, changes

#### Scenario: Discovery has no side effects
- **WHEN** discovery looks up the `origin` remote of candidates and configured repositories
- **THEN** no file under any of those repositories, including their git config, is created, modified or deleted

#### Scenario: Pull-request query leaves repositories alone
- **WHEN** the pull requests of every tracked repository are refreshed
- **THEN** no file under any tracked repository, its git directory or its worktrees is created, modified or deleted, and only `gh pr list` and `gh api user` processes were started, none of them in a tracked repository's directory

## ADDED Requirements

### Requirement: Pull request endpoints
`GET /api/pull-requests` SHALL return the cached pull-request lists without contacting any network host and without starting a process: `{ viewer?, repos: [...] }`, where `viewer` is the signed-in GitHub login when known and `repos` holds one entry per enabled repository with its `repoId`, its GitHub repository (`owner/name`) when it has one, a `status` of `ok`, `unavailable`, `failed` or `never` (not fetched yet), a `reason` for `unavailable` and `failed`, the time of the last successful fetch, and its pull requests as specified in the `pull-requests` capability. `POST /api/pull-requests/refresh` SHALL refresh the lists, with an optional JSON body `{ "repoId"?: string, "force"?: boolean }`: with `repoId` only that repository (and the other enabled repositories sharing its GitHub repository) is refreshed, otherwise every enabled repository; without `force: true` a repository whose last fetch is younger than the freshness window SHALL be left as it is. The response SHALL be the same shape as the `GET` after the refresh. An unknown or disabled `repoId` SHALL be refused with `404` without starting a process. While a refresh is running, a second refresh request SHALL wait for and return the running refresh's result rather than start a second query for the same repositories. The refresh endpoint is a mutating request under the same-origin protection. Neither endpoint SHALL trigger a scan.

#### Scenario: Reading the cache
- **WHEN** `GET /api/pull-requests` is called
- **THEN** the cached lists are returned and no `gh` process is started

#### Scenario: Refresh one repository
- **WHEN** `POST /api/pull-requests/refresh` is called with `{ "repoId": "<id of alpha-infra>", "force": true }`
- **THEN** only `alpha-infra`'s GitHub repository is queried and the response carries its fresh list alongside the other repositories' cached lists

#### Scenario: Fresh enough
- **WHEN** `POST /api/pull-requests/refresh` is called without `force` two minutes after the last successful fetch of every repository
- **THEN** no `gh` process is started and the cached lists are returned

#### Scenario: Concurrent refreshes
- **WHEN** two refresh requests for all repositories arrive while the first is still running
- **THEN** each GitHub repository is queried once and both responses carry the same result

#### Scenario: Foreign origin
- **WHEN** a page on another origin posts to `/api/pull-requests/refresh`
- **THEN** the response is `403` and no `gh` process is started
