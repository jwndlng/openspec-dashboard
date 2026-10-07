## MODIFIED Requirements

### Requirement: Single binary serves UI and API on loopback

The dashboard SHALL be built with `bun build --compile` into one executable named `spec-control` that serves the embedded SPA and the JSON API bound to `127.0.0.1` on the configured port (default 4711). Starting the binary SHALL print the URL and open the default browser unless `--no-open` is passed.

#### Scenario: Start
- **WHEN** the user runs `spec-control`
- **THEN** the server listens on `http://127.0.0.1:4711`, prints that URL, and the browser opens it

#### Scenario: Not reachable from the network
- **WHEN** another host on the LAN requests port 4711
- **THEN** the connection is refused

#### Scenario: Existing state carries over
- **WHEN** a user who ran an earlier `openspec-dashboard` binary starts `spec-control`
- **THEN** it moves the old home to `~/.spec-control/` once, as the home migration requirement specifies, and then uses the same configuration, sessions and worktrees as before

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action, and then only as enumerated here: (1) `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles); (2) for agent sessions, creating a git worktree and its branch for a session (`git worktree add`, preceded by `git worktree prune`), with the worktree's directory placed under `~/.spec-control/worktrees/` and never inside the repository's working tree, and removing such a worktree with a non-forcing `git worktree remove` (preceded by `git worktree unlock`) after the user confirmed — or, for a session whose agent the dashboard asked to enable auto-merge, after a pull-request query result showed that session's pull request merged while the project has docs auto-merge on, as specified in the `agent-sessions` capability — and read-only checks proved that it holds no uncommitted change and no work that exists nowhere else; (3) the pull action: `git fetch` from the repository's own remote followed by a fast-forward-only `git merge` of the main checkout's upstream, with repository hooks disabled, as specified in the `repository-pull` capability, and — only after the user confirmed Resolve and pull and the re-checks of that capability proved every blocking file to be an unchanged change leftover — removing exactly those leftover files from the main checkout's index (`git rm --cached`) and working tree immediately before the retried fast-forward, having first saved a copy of each leftover that differs under `~/.spec-control/`, and, when that fast-forward is still refused, writing those same files back with their previous content and re-staging the ones that had been staged (`git add -- <those paths>`); (4) creating a new change directory at `openspec/changes/<name>/` with its `.openspec.yaml` marker, an optional `prompt.md` and an optional `depends-on.yaml`, as specified in the `change-creation` capability — the dashboard writes those files itself and MUST NOT invoke the `openspec` CLI or any other external command for it; (5) staging that new change directory, and only it, with a single `git add -- openspec/changes/<name>/` once those files are written, as specified in the `change-creation` capability — best-effort, never failing the creation, and never run for a refused create; (6) repository cleanup, as specified in the `repository-cleanup` capability, on the user's confirmation of items the user selected: removing any linked worktree of the repository with a non-forcing `git worktree remove` (preceded by `git worktree unlock` only for a worktree the dashboard created) after read-only checks proved that it holds no uncommitted change and no work that exists nowhere else, removing stale worktree records with `git worktree prune`, and deleting a local branch other than the default branch and the main checkout's branch with `git branch -D` after read-only checks proved that its work is in the default branch and that it still points at the commit the user saw; (7) dismissing a change, as specified in the `change-dismissal` capability, on the user's confirmation: deleting an active change's directory `openspec/changes/<name>/` from the main checkout — never a directory under `openspec/changes/archive/`, never a symbolic link's target, never anything in a linked worktree — after re-checking that its content is what the confirmation showed and that no agent session for the change is running, then staging that removal, and only it, with a single `git add --all -- openspec/changes/<name>/` — best-effort, never failing the dismissal, and never run for a refused dismissal; (8) the home migration, as specified in the requirement on moving the home from its old name: once the user has started a binary that finds only the old home, running `git worktree repair` for the worktrees the dashboard itself created, with their new paths under `~/.spec-control/worktrees/`, which rewrites only the repository's administrative record of where those linked worktrees are (`.git/worktrees/<name>/gitdir`) and those worktrees' own `.git` files — it MUST NOT touch any other worktree, the main checkout's working tree, index, `HEAD` or any ref, and MUST NOT contact a remote. Outside tracked repositories, the one other place the dashboard writes beyond `~/.spec-control/` is creating a new project, as specified in the `project-creation` capability, on the user's confirmation: creating one new, empty directory directly inside a configured workspace root with an exclusive create — never in or below a tracked repository, an ignore path or the dashboard's home directory, and never reusing anything that exists — and running `git init` in that directory and nowhere else; it MUST NOT write any other file there, stage, commit, add a remote or delete anything it created. Apart from those worktree commands, that branch deletion, the pull action's removal of confirmed change leftovers and that change-directory deletion the dashboard MUST NOT delete or move anything in a tracked repository. Apart from the pull action it MUST NOT change the main checkout's working tree beyond the created and the dismissed change directories above, and MUST NOT change the main checkout's index beyond adding the created directory's files to it and staging the dismissed directory's removal, and MUST NOT contact a remote, and it MUST NOT change the main checkout's branch at all. It MUST NOT commit, push, stash or reset in a tracked repository under any circumstances, and MUST NOT create or delete a ref except the session branch created with a session's worktree and the local branches deleted by repository cleanup; it MUST NOT delete a remote-tracking ref or a remote branch. The pull action MUST NOT run except on the user's explicit request for that repository (or for all repositories): never on a timer, during a scan, on page load or as a side effect of another operation. Apart from the pull action, the only network access the dashboard makes is the pull-request query of the `pull-requests` capability: it runs only the GitHub CLI's read-only `gh pr list` and `gh api user`, never any other `gh` subcommand, with its working directory outside every tracked repository, and only when the user asks for it as specified in that capability; it MUST NOT write to a tracked repository, run git, or change anything on GitHub. Scanning, polling, discovery and serving the UI MUST NOT start a `gh` process. All other filesystem writes MUST be confined to `~/.spec-control/`, apart from the new project directory and its `git init`. Scanning, polling, discovery, previews, reading work statuses and saving any dashboard setting MUST NOT write to a tracked repository. Apart from the worktree commands (including the home migration's `worktree repair`), the pull action's `fetch`, `merge --ff-only`, leftover `rm --cached` and restoring `add`, the create-change and dismissal `add`, the cleanup's `branch -D` and the new project's `git init` above, git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `show-ref`, `symbolic-ref`, `for-each-ref`, `rev-list`, `diff`, `config --get`, `ls-files`, `ls-tree`, `cat-file`, `merge-tree`, and `hash-object` without `-w`). `merge-tree`, which computes the conflict signal of a work status, writes the merged tree it produces into an object database; it MUST therefore be invoked with its object directory pointed at a scratch store under `~/.spec-control/` and the repository's own object database offered only as an alternate, so that it reads everything it needs and writes nothing into the repository. It MUST NOT be given a working tree, an index or a ref to update. Every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`), so that no invocation rewrites `.git/index` as a side effect — `git status` refreshes the index by default — and only the pull action's `merge --ff-only`, its leftover `rm --cached` and restoring `add`, and the create-change and dismissal `add` may write the index at all, which they do by design. When agent sessions are enabled, the dashboard MAY start the user's configured agent in a session's worktree on the user's explicit request. The same holds, in place in the folder itself, for an integration session in a repository that is not tracked yet (`repo-integration` capability) for a project console in a tracked repository's folder, which for a git repository is its main checkout (`project-console` capability), and for a change session in a git repository with no commit yet, which runs in its main checkout (`agent-sessions` capability). For none of them does the dashboard create a worktree or branch, write a file or run a git command. What that agent changes, commits or pushes is the agent's doing under its own permission prompts and is never done by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

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
- **THEN** the only paths removed from the index and working tree before the fast-forward are those two files, `notes.md` keeps its edit, no commit, stash, reset or branch change happens, and copies are written only under `~/.spec-control/`

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

#### Scenario: Dismissal touches only the change directory
- **WHEN** a change is dismissed via `POST /api/repos/<id>/changes/<name>/dismiss` in a repository with unrelated modified and untracked files and a linked worktree holding a copy of the change
- **THEN** the only path under that repository that is deleted is `openspec/changes/<name>/` in the main checkout, the only other effect is its removal being staged, and no other file, index entry, ref, commit or linked worktree changes

#### Scenario: Refused dismissal writes nothing
- **WHEN** `POST /api/repos/<id>/changes/<name>/dismiss` is refused for any reason
- **THEN** no file, directory, index entry or git ref under that repository changes, and no git command that writes is run

#### Scenario: Discovery has no side effects
- **WHEN** discovery looks up the `origin` remote of candidates and configured repositories
- **THEN** no file under any of those repositories, including their git config, is created, modified or deleted

#### Scenario: Pull-request query leaves repositories alone
- **WHEN** the pull requests of every tracked repository are refreshed
- **THEN** no file under any tracked repository, its git directory or its worktrees is created, modified or deleted, and only `gh pr list` and `gh api user` processes were started, none of them in a tracked repository's directory

#### Scenario: The conflict check writes nothing into the repository
- **WHEN** work statuses with their conflict signal are computed for every session worktree of a repository
- **THEN** no file under that repository, including its object database, index and refs, is created, modified or deleted

#### Scenario: Creating a project writes one folder and its git directory
- **WHEN** a project `gamma-tools` is created under the workspace root `/w/acme`
- **THEN** the only new path under `/w/acme` is `/w/acme/gamma-tools`, holding only `.git` from `git init`, every tracked repository is byte-for-byte unchanged, and no git command other than `git init` was run for it

#### Scenario: Opening a project console leaves the main checkout alone
- **WHEN** a project console is opened for a tracked git repository
- **THEN** until the agent acts, the repository's checked-out branch, index, working tree and refs are unchanged, no worktree or branch is created, and the dashboard has run no git command for the session

#### Scenario: Create touches only the new change directory
- **WHEN** a change is created with a prompt and dependencies
- **THEN** the only paths created under the repository are `openspec/changes/<name>/.openspec.yaml`, `prompt.md` and `depends-on.yaml`, no existing change's files change, and the index changes only by those three files

#### Scenario: Change session in a repository without a commit
- **WHEN** agent sessions are enabled and the user starts **Draft artifacts** for a change of a tracked git repository that has no commit yet
- **THEN** the agent starts in the repository's main checkout, and the dashboard creates no worktree or branch, writes no file and runs no git command there for the session

#### Scenario: Merged auto-merge pull request removes only the session worktree
- **WHEN** a pull-request refresh shows the archive pull request of a session that was asked to enable auto-merge as merged, and its worktree is clean and pushed
- **THEN** the only change under the repository is that worktree's removal by a non-forcing `git worktree remove`, the session's local branch and every other ref are unchanged, no fetch runs, and the only processes the refresh itself started are `gh pr list` and `gh api user`

#### Scenario: The home migration re-registers only the dashboard's own worktrees
- **WHEN** the old home holds a session worktree of `demo-ops` and `demo-ops` also has a linked worktree the user created elsewhere
- **THEN** after the migration git lists the session worktree at its path under `~/.spec-control/worktrees/`, the user's worktree record is unchanged, and the main checkout's branch, index, working tree and refs are unchanged

## ADDED Requirements

### Requirement: The dashboard keeps its state in one home directory
The dashboard's home directory SHALL be `~/.spec-control/`. When the environment variable `SPEC_CONTROL_HOME` is set and not empty, its value SHALL be the home instead. When `SPEC_CONTROL_HOME` is unset or empty and the former variable `OPENSPEC_DASHBOARD_HOME` is set and not empty, its value SHALL be the home, and the dashboard SHALL print on start that `OPENSPEC_DASHBOARD_HOME` is deprecated and will stop working in a later release, naming `SPEC_CONTROL_HOME`; `OPENSPEC_DASHBOARD_HOME` SHALL be honoured at least until the release after the one that introduces `SPEC_CONTROL_HOME`. Every path this specification and the other capabilities place under `~/.spec-control/` SHALL be under the home in use. User-visible text that names the home (Settings, Help, the pull dialog, the environment check) SHALL name `~/.spec-control/` or the configured home, never `~/.openspec-dashboard/`.

#### Scenario: Default home
- **WHEN** neither variable is set and `~/.spec-control/` does not exist and neither does `~/.openspec-dashboard/`
- **THEN** the dashboard creates `~/.spec-control/` with a default `config.json` and creates nothing named `.openspec-dashboard`

#### Scenario: New variable wins
- **WHEN** `SPEC_CONTROL_HOME=/w/state/a` and `OPENSPEC_DASHBOARD_HOME=/w/state/b` are both set
- **THEN** the dashboard reads and writes only under `/w/state/a`, and prints no deprecation notice

#### Scenario: Former variable still works
- **WHEN** only `OPENSPEC_DASHBOARD_HOME=/w/state/b` is set
- **THEN** the dashboard uses `/w/state/b` as its home and prints that `OPENSPEC_DASHBOARD_HOME` is deprecated in favour of `SPEC_CONTROL_HOME`

### Requirement: The home moves once from its old name
When neither `SPEC_CONTROL_HOME` nor `OPENSPEC_DASHBOARD_HOME` is set, `~/.spec-control/` does not exist and `~/.openspec-dashboard/` exists and is not a symbolic link to `~/.spec-control/`, starting the server SHALL migrate the old home before it scans, discovers, starts any session or serves the UI. `--help` and `--version` MUST NOT migrate. The migration SHALL only start after the server has bound its port, read from the old home's `config.json`, so that it never runs while another instance of the dashboard is serving from the old home. It SHALL:

1. move the old home to `~/.spec-control/` with a single rename, so that its whole content — configuration, shared config profiles, activity log, session records, cached snapshot and pull-request lists, pull backups, scratch object store, console folder and session worktrees — moves at once and no file is copied;
2. leave a symbolic link at `~/.openspec-dashboard` pointing at `~/.spec-control`, so that paths held by anything outside the dashboard — open shells and editors, scripts, git records not yet repaired — keep resolving;
3. rewrite every absolute path the dashboard itself stored that lies under the old home — session records' worktree paths and paths in `config.json` such as a configured console folder — to the same path under the new home, writing each file atomically; and
4. for every directory under `~/.spec-control/worktrees/<repository id>/` that is a linked worktree, run `git worktree repair` with its new path in the repository its `.git` file names, so that the repository's worktree record points at the new path.

When the rename cannot be made, the dashboard SHALL leave the old home where it is, use it as its home for this run exactly as before, and print and show in the environment check why the migration did not happen; it SHALL try again on the next start. When the rename succeeded but a later step failed for some file or worktree, the dashboard SHALL go on starting, report each failure with its reason in the same places, and retry the failed steps on the next start until they succeed or the worktree directory is gone; it MUST NOT delete, recreate or force anything to recover. The migration MUST NOT touch any worktree outside the home, change any repository's main checkout, or move any file the old home did not hold. Once both homes exist as real directories, the dashboard SHALL use `~/.spec-control/` and SHALL NOT move or merge anything, and the environment check's `dashboard-home` check SHALL name the leftover old home. The migration's outcome SHALL be printed on start and recorded in the home, but MUST NOT be written to the activity log.

#### Scenario: Upgrade from an earlier binary
- **WHEN** `~/.openspec-dashboard/` holds `config.json`, 12 session records and two session worktrees of `demo-ops`, and the user starts `spec-control` for the first time
- **THEN** `~/.spec-control/` holds the same files, `~/.openspec-dashboard` is a symbolic link to it, the session records name worktree paths under `~/.spec-control/worktrees/`, `git worktree list` in `demo-ops` shows both worktrees at their new paths, and the board shows the same projects, sessions and work statuses as before

#### Scenario: Nothing to migrate
- **WHEN** `~/.spec-control/` already exists
- **THEN** starting the dashboard moves nothing and runs no `git worktree repair` beyond retrying steps a previous migration recorded as failed

#### Scenario: Another instance still running
- **WHEN** an earlier binary is still serving on port 4711 from `~/.openspec-dashboard/` and the user starts `spec-control`
- **THEN** `spec-control` fails to bind the port and exits without moving or writing anything

#### Scenario: Rename refused
- **WHEN** `~/.openspec-dashboard/` cannot be renamed, for example because it is a mount point
- **THEN** the dashboard runs from `~/.openspec-dashboard/` as before, prints why it was not moved, and the environment check says the same

#### Scenario: A repository has moved away
- **WHEN** the repository of one moved session worktree no longer exists at the path its `.git` file names
- **THEN** the other worktrees are repaired, the failure is reported naming that worktree, nothing is deleted, and the next start tries that worktree again

#### Scenario: Version check does not migrate
- **WHEN** the user runs `spec-control --version` with only `~/.openspec-dashboard/` present
- **THEN** the version is printed and `~/.openspec-dashboard/` is unchanged and `~/.spec-control/` does not exist

#### Scenario: Explicit home is never migrated
- **WHEN** `SPEC_CONTROL_HOME` or `OPENSPEC_DASHBOARD_HOME` is set
- **THEN** no migration runs and nothing under `~/.openspec-dashboard/` or `~/.spec-control/` is read or written
