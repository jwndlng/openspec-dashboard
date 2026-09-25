# Spec Delta

## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action, and then only as enumerated here: (1) `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles); (2) for agent sessions, creating a git worktree and its branch for a session (`git worktree add`, preceded by `git worktree prune`), with the worktree's directory placed under `~/.openspec-dashboard/worktrees/` and never inside the repository's working tree, and removing such a worktree with a non-forcing `git worktree remove` (preceded by `git worktree unlock`) after the user confirmed and read-only checks proved that it holds no uncommitted change and no work that exists nowhere else; (3) the pull action: `git fetch` from the repository's own remote followed by a fast-forward-only `git merge` of the main checkout's upstream, with repository hooks disabled, as specified in the `repository-pull` capability, and — only after the user confirmed Resolve and pull and the re-checks of that capability proved every blocking file to be an unchanged change leftover — removing exactly those leftover files from the main checkout's index (`git rm --cached`) and working tree immediately before the retried fast-forward, having first saved a copy of each leftover that differs under `~/.openspec-dashboard/`, and, when that fast-forward is still refused, writing those same files back with their previous content and re-staging the ones that had been staged (`git add -- <those paths>`); (4) creating a new change directory at `openspec/changes/<name>/` with its `.openspec.yaml` marker and an optional `prompt.md`, as specified in the `change-creation` capability — the dashboard writes those files itself and MUST NOT invoke the `openspec` CLI or any other external command for it; (5) staging that new change directory, and only it, with a single `git add -- openspec/changes/<name>/` once those files are written, as specified in the `change-creation` capability — best-effort, never failing the creation, and never run for a refused create; (6) repository cleanup, as specified in the `repository-cleanup` capability, on the user's confirmation of items the user selected: removing any linked worktree of the repository with a non-forcing `git worktree remove` (preceded by `git worktree unlock` only for a worktree the dashboard created) after read-only checks proved that it holds no uncommitted change and no work that exists nowhere else, removing stale worktree records with `git worktree prune`, and deleting a local branch other than the default branch and the main checkout's branch with `git branch -D` after read-only checks proved that its work is in the default branch and that it still points at the commit the user saw. Apart from those worktree commands, that branch deletion and the pull action's removal of confirmed change leftovers the dashboard MUST NOT delete or move anything in a tracked repository. Apart from the pull action it MUST NOT change the main checkout's working tree beyond the create-change directory above, and MUST NOT change the main checkout's index beyond adding that same directory's files to it, and MUST NOT contact a remote, and it MUST NOT change the main checkout's branch at all. It MUST NOT commit, push, stash or reset in a tracked repository under any circumstances, and MUST NOT create or delete a ref except the session branch created with a session's worktree and the local branches deleted by repository cleanup; it MUST NOT delete a remote-tracking ref or a remote branch. The pull action MUST NOT run except on the user's explicit request for that repository (or for all repositories): never on a timer, during a scan, on page load or as a side effect of another operation. All other filesystem writes MUST be confined to `~/.openspec-dashboard/`. Scanning, polling, discovery, previews, reading work statuses and saving any dashboard setting MUST NOT write to a tracked repository. Apart from the worktree commands, the pull action's `fetch`, `merge --ff-only`, leftover `rm --cached` and restoring `add`, the create-change `add` and the cleanup's `branch -D` above, git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `show-ref`, `symbolic-ref`, `for-each-ref`, `rev-list`, `diff`, `config --get`, `ls-files`, `ls-tree`, `cat-file`, and `hash-object` without `-w`). Every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`), so that no invocation rewrites `.git/index` as a side effect — `git status` refreshes the index by default — and only the pull action's `merge --ff-only`, its leftover `rm --cached` and restoring `add`, and the create-change `add` may write the index at all, which they do by design. When agent sessions are enabled, the dashboard MAY start the user's configured agent in a session's worktree on the user's explicit request; what that agent changes, commits or pushes is the agent's doing under its own permission prompts and is never done by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

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

#### Scenario: Resolving leftovers touches only the leftovers
- **WHEN** the user confirms Resolve and pull for a repository blocked by two change leftovers while `notes.md` has an unrelated uncommitted edit
- **THEN** the only paths removed from the index and working tree before the fast-forward are those two files, `notes.md` keeps its edit, no commit, stash, reset or branch change happens, and copies are written only under `~/.openspec-dashboard/`

#### Scenario: Offering a resolution writes nothing
- **WHEN** a pull is refused because of change leftovers and the result offers Resolve and pull
- **THEN** until the user confirms, no file, index entry or ref under the repository has changed beyond the fetch

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

### Requirement: Pull endpoints

`POST /api/repos/<id>/pull` SHALL run the pull action for one repository and return its result, including the blocking files and, when every one is a change leftover, what the user has to confirm to resolve them; `POST /api/pull` SHALL run it for every eligible repository with bounded concurrency and return one result per repository, a failure in one not affecting the others. `POST /api/repos/<id>/pull` with a body `{ "resolve": { "upstream": <commit>, "files": [{ "path", … }] } }` — the incoming commit and the blocking files exactly as a previous result offered them — SHALL run Resolve and pull for that repository as specified in the `repository-pull` capability instead of a fetch; the server MUST re-determine the blocking files itself and MUST NOT treat any path or content in the request as more than the claim it checks. A malformed resolve body SHALL be refused with `400` and nothing touched; a resolve whose claim no longer matches SHALL be answered with a `refused` result and nothing touched. `POST /api/pull` never resolves anything. A repository is eligible only if it is enabled in the config, its last scan succeeded and it is a git repository; the repository's path MUST come from the config and never from the request. An unknown, disabled or non-git repository SHALL be refused without running git. A second request for a repository whose pull or resolve is still running SHALL be refused with `409`. Both endpoints are mutating requests under the same-origin protection. After a pull or resolve the repository SHALL be rescanned.

#### Scenario: One repository
- **WHEN** `POST /api/repos/<id>/pull` is called for an enabled repository that is two commits behind its upstream
- **THEN** the response reports a fast-forward of 2 commits and a following `GET /api/state` reflects the repository's new state

#### Scenario: Not eligible
- **WHEN** the id belongs to a disabled repository, or to none
- **THEN** the response is an error and no git command was run

#### Scenario: Already pulling
- **WHEN** a second pull is requested for a repository while its first is still running
- **THEN** the response is `409` and only one fetch runs

#### Scenario: Pull all with one unreachable remote
- **WHEN** `POST /api/pull` runs over three repositories and one remote cannot be reached
- **THEN** the response has three results, two successful and one `failed` with a reason

#### Scenario: Resolve as offered
- **WHEN** a pull result offered Resolve and pull and the same upstream commit and files are posted back as `resolve`
- **THEN** the response reports the fast-forward and the replaced files with the locations of any copies, and no fetch was run

#### Scenario: Resolve claiming a file that is not a leftover
- **WHEN** a `resolve` body names `src/app.ts`, which has an uncommitted edit that the incoming commits change
- **THEN** the response is a `refused` result and `src/app.ts`, the index and the branch are unchanged

#### Scenario: Malformed resolve
- **WHEN** the `resolve` body has no upstream commit or a path that is absolute or contains `..`
- **THEN** the response is `400` and no git command that writes is run

#### Scenario: Foreign origin
- **WHEN** a page on another origin posts to a pull endpoint, with or without `resolve`
- **THEN** the response is `403` and nothing is fetched or removed
