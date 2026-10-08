# Spec Delta

## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action — or, for the automatic fetch of (9), a setting the user switched on for that one repository — and then only as enumerated here: (1) `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles); (2) for agent sessions, creating a git worktree and its branch for a session (`git worktree add`, preceded by `git worktree prune`), with the worktree's directory placed under `~/.spec-control/worktrees/` and never inside the repository's working tree, and removing such a worktree with a non-forcing `git worktree remove` (preceded by `git worktree unlock`) after the user confirmed — or, for a session whose agent the dashboard asked to enable auto-merge, after a pull-request query result showed that session's pull request merged while the project has docs auto-merge on, as specified in the `agent-sessions` capability — and read-only checks proved that it holds no uncommitted change and no work that exists nowhere else; (3) the pull action: `git fetch` from the repository's own remote followed by a fast-forward-only `git merge` of the main checkout's upstream, with repository hooks disabled, as specified in the `repository-pull` capability, and — only after the user confirmed Resolve and pull and the re-checks of that capability proved every blocking file to be an unchanged change leftover — removing exactly those leftover files from the main checkout's index (`git rm --cached`) and working tree immediately before the retried fast-forward, having first saved a copy of each leftover that differs under `~/.spec-control/`, and, when that fast-forward is still refused, writing those same files back with their previous content and re-staging the ones that had been staged (`git add -- <those paths>`); (4) creating a new change directory at `openspec/changes/<name>/` with its `.openspec.yaml` marker, an optional `prompt.md`, an optional `depends-on.yaml` and, for a change imported from a GitHub issue, an `issue.yaml`, as specified in the `change-creation` capability — the dashboard writes those files itself and MUST NOT invoke the `openspec` CLI or any other external command for it; (5) staging that new change directory, and only it, with a single `git add -- openspec/changes/<name>/` once those files are written, as specified in the `change-creation` capability — best-effort, never failing the creation, and never run for a refused create; (6) repository cleanup, as specified in the `repository-cleanup` capability, on the user's confirmation of items the user selected: removing any linked worktree of the repository with a non-forcing `git worktree remove` (preceded by `git worktree unlock` only for a worktree the dashboard created) after read-only checks proved that it holds no uncommitted change and no work that exists nowhere else, removing stale worktree records with `git worktree prune`, and deleting a local branch other than the default branch and the main checkout's branch with `git branch -D` after read-only checks proved that its work is in the default branch and that it still points at the commit the user saw; (7) dismissing a change, as specified in the `change-dismissal` capability, on the user's confirmation: deleting an active change's directory `openspec/changes/<name>/` from the main checkout — never a directory under `openspec/changes/archive/`, never a symbolic link's target, never anything in a linked worktree — after re-checking that its content is what the confirmation showed and that no agent session for the change is running, then staging that removal, and only it, with a single `git add --all -- openspec/changes/<name>/` — best-effort, never failing the dismissal, and never run for a refused dismissal; (8) the home migration, as specified in the requirement on moving the home from its old name: once the user has started a binary that finds only the old home, running `git worktree repair` for the worktrees the dashboard itself created, with their new paths under `~/.spec-control/worktrees/`, which rewrites only the repository's administrative record of where those linked worktrees are (`.git/worktrees/<name>/gitdir`) and those worktrees' own `.git` files — it MUST NOT touch any other worktree, the main checkout's working tree, index, `HEAD` or any ref, and MUST NOT contact a remote; (9) the automatic fetch, as specified in the `repository-pull` capability, for a repository whose auto-fetch setting the user switched on: exactly the pull action's `git fetch` from the repository's own remote, on that setting's interval, which writes only remote-tracking refs, `FETCH_HEAD` and objects — it MUST NOT fast-forward, merge, prune, or change the main checkout's branch, index or working tree or any linked worktree. Outside tracked repositories, the one other place the dashboard writes beyond `~/.spec-control/` is creating a new project, as specified in the `project-creation` capability, on the user's confirmation: creating one new, empty directory directly inside a configured workspace root with an exclusive create — never in or below a tracked repository, an ignore path or the dashboard's home directory, and never reusing anything that exists — and running `git init` in that directory and nowhere else; it MUST NOT write any other file there, stage, commit, add a remote or delete anything it created. Apart from those worktree commands, that branch deletion, the pull action's removal of confirmed change leftovers and that change-directory deletion the dashboard MUST NOT delete or move anything in a tracked repository. Apart from the pull action it MUST NOT change the main checkout's working tree beyond the created and the dismissed change directories above, and MUST NOT change the main checkout's index beyond adding the created directory's files to it and staging the dismissed directory's removal, and MUST NOT contact a remote, and it MUST NOT change the main checkout's branch at all. It MUST NOT commit, push, stash or reset in a tracked repository under any circumstances, and MUST NOT create or delete a ref except the session branch created with a session's worktree and the local branches deleted by repository cleanup; it MUST NOT delete a remote-tracking ref or a remote branch. The pull action MUST NOT run except on the user's explicit request for that repository (or for all repositories): never on a timer, during a scan, on page load or as a side effect of another operation. The automatic fetch is not the pull action: it runs the pull action's fetch and nothing more, only for a repository whose auto-fetch setting is on, only on that setting's interval, and never during a scan, on page load, for another repository or in the demo. Apart from the pull action and the automatic fetch, the only network access the dashboard makes is the pull-request query of the `pull-requests` capability and the issue query of the `issue-import` capability: they run only the GitHub CLI's read-only `gh pr list`, `gh api user` and `gh issue list`, never any other `gh` subcommand, with their working directory outside every tracked repository, and only when the user asks for them as specified in those capabilities; they MUST NOT write to a tracked repository, run git, or change anything on GitHub. Scanning, polling, discovery and serving the UI MUST NOT start a `gh` process. All other filesystem writes MUST be confined to `~/.spec-control/`, apart from the new project directory and its `git init`. Scanning, polling, discovery, previews, reading work statuses and saving any dashboard setting MUST NOT write to a tracked repository. Apart from the worktree commands (including the home migration's `worktree repair`), the pull action's and the automatic fetch's `fetch`, the pull action's `merge --ff-only`, leftover `rm --cached` and restoring `add`, the create-change and dismissal `add`, the cleanup's `branch -D` and the new project's `git init` above, git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `show-ref`, `symbolic-ref`, `for-each-ref`, `rev-list`, `diff`, `config --get`, `ls-files`, `ls-tree`, `cat-file`, `merge-tree`, and `hash-object` without `-w`). `merge-tree`, which computes the conflict signal of a work status, writes the merged tree it produces into an object database; it MUST therefore be invoked with its object directory pointed at a scratch store under `~/.spec-control/` and the repository's own object database offered only as an alternate, so that it reads everything it needs and writes nothing into the repository. It MUST NOT be given a working tree, an index or a ref to update. Every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`), so that no invocation rewrites `.git/index` as a side effect — `git status` refreshes the index by default — and only the pull action's `merge --ff-only`, its leftover `rm --cached` and restoring `add`, and the create-change and dismissal `add` may write the index at all, which they do by design. When agent sessions are enabled, the dashboard MAY start the user's configured agent in a session's worktree on the user's explicit request. The same holds, in place in the folder itself, for an integration session in a repository that is not tracked yet (`repo-integration` capability) for a project console in a tracked repository's folder, which for a git repository is its main checkout (`project-console` capability), and for a change session in a git repository with no commit yet, which runs in its main checkout (`agent-sessions` capability). For none of them does the dashboard create a worktree or branch, write a file or run a git command. What that agent changes, commits or pushes is the agent's doing under its own permission prompts and is never done by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

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

#### Scenario: Issue query leaves repositories and GitHub alone
- **WHEN** the user opens Import from issues for a repository and refreshes its list
- **THEN** no file under any tracked repository, its git directory or its worktrees is created, modified or deleted, and only `gh issue list` processes were started for it, none of them in a tracked repository's directory

#### Scenario: Importing an issue touches only the new change directory
- **WHEN** a change is imported from an issue
- **THEN** the only paths created under the repository are `openspec/changes/<name>/.openspec.yaml`, `prompt.md` and `issue.yaml`, the index changes only by those three files, and no `gh` process is started by the create

#### Scenario: Automatic fetch writes only what a fetch writes
- **WHEN** a repository with auto fetch on is automatically fetched while its main checkout has uncommitted edits and is behind its upstream
- **THEN** its remote-tracking refs have moved, and its branch, `HEAD`, `.git/index`, working tree and linked worktrees are byte-for-byte unchanged

#### Scenario: Scans never fetch
- **WHEN** a repository has auto fetch on and a full scan, discovery and a page load run
- **THEN** none of them contacts the repository's remote; only the auto-fetch schedule does

#### Scenario: Without the setting nothing is fetched
- **WHEN** no tracked repository has auto fetch on and the dashboard runs for hours with the board open
- **THEN** no repository's remote is contacted

### Requirement: Per-repository settings endpoints
Six mutating endpoints SHALL each change one configured repository in the saved configuration, persist it atomically and return the saved config, under the same validation and canonicalisation as `PUT /api/config`, and applied one at a time with every other configuration write against the configuration as the previous write left it:

- `POST /api/repos/<id>/name` with `{ name }`: SHALL set that repository's name to the trimmed `name`, keeping everything else. A `name` that is not a string, or is empty after trimming, MUST be refused with `400`.
- `POST /api/repos/<id>/agent` with `{ enabled?, agentId?, autoMergeDocs? }`: SHALL set that repository's agent-session settings. A boolean `enabled` SHALL switch the repository's agent sessions on or off. A string `agentId` SHALL select that agent profile for the repository, and `agentId: null` SHALL clear the selection so that the default agent is used. A boolean `autoMergeDocs` SHALL switch the repository's auto-merge of docs-only pull requests on or off; `false` SHALL remove the key, so a configuration never carries `autoMergeDocs: false`. A field that is absent SHALL leave that part of the setting unchanged. An `enabled` that is neither absent nor boolean, an `agentId` that is neither absent, `null` nor a string, an `agentId` that names no configured profile, an `autoMergeDocs` that is neither absent nor boolean, and a body with none of the three fields MUST be refused with `400`.
- `POST /api/repos/<id>/labels` with `{ labels?, hiddenLabels? }`: SHALL replace that repository's custom labels and/or hidden detected labels with the given lists, under the label rules of the `project-labels` capability. An empty list SHALL remove the key, so a configuration never gains an empty list. A field that is absent SHALL leave that list unchanged. A field that is not a list of strings, a list that breaks the label rules, and a body with neither field MUST be refused with `400`.
- `POST /api/repos/<id>/forget` with an empty JSON body: SHALL remove that repository from the configuration. A repository that is enabled MUST be refused with `409`, so that only a repository the user has disabled can be forgotten.
- `POST /api/repos/<id>/pr-title-convention` with `{ convention }`: SHALL set that repository's pull request title convention. `convention: "conventional-commits"` SHALL set it, and `convention: null` SHALL remove the key so that the repository has no convention. Any other value, and a body without `convention`, MUST be refused with `400`.
- `POST /api/repos/<id>/auto-fetch` with `{ minutes }`: SHALL set that repository's auto-fetch interval. `minutes` of `5`, `15`, `30` or `60` SHALL set `autoFetchMinutes` to it, and `minutes: null` SHALL remove the key so that the repository is not fetched automatically; a configuration never carries another value. Any other value, and a body without `minutes`, MUST be refused with `400`. A saved change SHALL take effect on the automatic-fetch schedule at once, as specified in the `repository-pull` capability, without itself fetching or scanning.

An unknown id MUST be refused with `404` by all six. A refused request MUST leave the configuration unchanged. None of these endpoints changes the set of enabled repositories, so none of them triggers a scan. These endpoints are mutating requests under the same-origin protection, and none of them reads or writes anything inside a repository.

#### Scenario: Renaming
- **WHEN** `POST /api/repos/<id>/name` is sent with `{ "name": "  Beta SOC " }` for a configured repository
- **THEN** the saved config has that repository named `Beta SOC` with its `enabled` and agent settings unchanged

#### Scenario: Empty name
- **WHEN** `POST /api/repos/<id>/name` is sent with `{ "name": "   " }`
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Switching agent sessions off for one repository
- **WHEN** `POST /api/repos/<id>/agent` is sent with `{ "enabled": false }` for a repository with no agent settings
- **THEN** the saved config has agent sessions switched off for that repository, and opening a session for one of its changes is refused

#### Scenario: Selecting and clearing an agent
- **WHEN** `POST /api/repos/<id>/agent` is sent with `{ "agentId": "my-agent" }` and later with `{ "agentId": null }`
- **THEN** after the first the repository uses `my-agent`, and after the second it uses the default agent, with its on/off setting unchanged both times

#### Scenario: Switching auto-merge of docs-only pull requests
- **WHEN** `POST /api/repos/<id>/agent` is sent with `{ "autoMergeDocs": true }` for a repository with no agent settings, and later with `{ "autoMergeDocs": false }`
- **THEN** after the first the saved config has `agent: { enabled: true, autoMergeDocs: true }` for it, and after the second `agent: { enabled: true }`; no scan was triggered either time

#### Scenario: Auto-merge setting that is not a boolean
- **WHEN** `POST /api/repos/<id>/agent` is sent with `{ "autoMergeDocs": "yes" }`
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Unknown agent
- **WHEN** `POST /api/repos/<id>/agent` is sent with `{ "agentId": "nope" }` and no profile has that id
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Setting labels
- **WHEN** `POST /api/repos/<id>/labels` is sent with `{ "labels": ["client"] }` and later with `{ "labels": [] }`
- **THEN** after the first the repository carries `["client"]` with its hidden labels unchanged, and after the second it has no `labels` key; no scan was triggered

#### Scenario: Invalid labels
- **WHEN** `POST /api/repos/<id>/labels` is sent with `{ "labels": ["Infra", "infra"] }`
- **THEN** the response is `400` naming the label and the config is unchanged

#### Scenario: Setting and clearing the pull request title convention
- **WHEN** `POST /api/repos/<id>/pr-title-convention` is sent with `{ "convention": "conventional-commits" }` and later with `{ "convention": null }`
- **THEN** after the first the repository carries `prTitleConvention: conventional-commits` with its name, `enabled` state, agent settings and labels unchanged, after the second it has no `prTitleConvention` key, and no scan was triggered

#### Scenario: Unknown convention
- **WHEN** `POST /api/repos/<id>/pr-title-convention` is sent with `{ "convention": "angular" }` or with `{}`
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Forgetting a disabled repository
- **WHEN** `POST /api/repos/<id>/forget` is sent for a repository with `enabled: false`
- **THEN** the saved config no longer contains it and no scan was triggered

#### Scenario: Forgetting an enabled repository
- **WHEN** `POST /api/repos/<id>/forget` is sent for a repository with `enabled: true`
- **THEN** the response is `409` and the config is unchanged

#### Scenario: Unknown repository
- **WHEN** any of the six endpoints names an id that is not in the config
- **THEN** the response is `404` and the config is unchanged

#### Scenario: Concurrent settings
- **WHEN** `POST /api/repos/<a>/name` and `POST /api/repos/<b>/agent` with `{ "enabled": false }` arrive concurrently
- **THEN** the saved config has both changes

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/repos/<id>/forget`
- **THEN** the response is `403` and the config is unchanged

#### Scenario: Setting and clearing auto fetch
- **WHEN** `POST /api/repos/<id>/auto-fetch` is sent with `{ "minutes": 15 }` and later with `{ "minutes": null }`
- **THEN** after the first the repository carries `autoFetchMinutes: 15` with its name, `enabled` state, agent settings, labels and convention unchanged, after the second it has no `autoFetchMinutes` key, and neither request fetched or triggered a scan

#### Scenario: Unsupported interval
- **WHEN** `POST /api/repos/<id>/auto-fetch` is sent with `{ "minutes": 1 }`, `{ "minutes": "15" }` or `{}`
- **THEN** the response is `400` and the config is unchanged
