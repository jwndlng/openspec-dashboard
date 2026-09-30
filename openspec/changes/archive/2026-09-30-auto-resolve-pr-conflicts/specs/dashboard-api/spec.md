# Spec Delta

## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action, and then only as enumerated here: (1) `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles); (2) for agent sessions, creating a git worktree and its branch for a session (`git worktree add`, preceded by `git worktree prune`), with the worktree's directory placed under `~/.openspec-dashboard/worktrees/` and never inside the repository's working tree, and removing such a worktree with a non-forcing `git worktree remove` (preceded by `git worktree unlock`) after the user confirmed and read-only checks proved that it holds no uncommitted change and no work that exists nowhere else; (3) the pull action: `git fetch` from the repository's own remote followed by a fast-forward-only `git merge` of the main checkout's upstream, with repository hooks disabled, as specified in the `repository-pull` capability, and — only after the user confirmed Resolve and pull and the re-checks of that capability proved every blocking file to be an unchanged change leftover — removing exactly those leftover files from the main checkout's index (`git rm --cached`) and working tree immediately before the retried fast-forward, having first saved a copy of each leftover that differs under `~/.openspec-dashboard/`, and, when that fast-forward is still refused, writing those same files back with their previous content and re-staging the ones that had been staged (`git add -- <those paths>`); (4) creating a new change directory at `openspec/changes/<name>/` with its `.openspec.yaml` marker and an optional `prompt.md`, as specified in the `change-creation` capability — the dashboard writes those files itself and MUST NOT invoke the `openspec` CLI or any other external command for it; (5) staging that new change directory, and only it, with a single `git add -- openspec/changes/<name>/` once those files are written, as specified in the `change-creation` capability — best-effort, never failing the creation, and never run for a refused create; (6) repository cleanup, as specified in the `repository-cleanup` capability, on the user's confirmation of items the user selected: removing any linked worktree of the repository with a non-forcing `git worktree remove` (preceded by `git worktree unlock` only for a worktree the dashboard created) after read-only checks proved that it holds no uncommitted change and no work that exists nowhere else, removing stale worktree records with `git worktree prune`, and deleting a local branch other than the default branch and the main checkout's branch with `git branch -D` after read-only checks proved that its work is in the default branch and that it still points at the commit the user saw; (7) dismissing a change, as specified in the `change-dismissal` capability, on the user's confirmation: deleting an active change's directory `openspec/changes/<name>/` from the main checkout — never a directory under `openspec/changes/archive/`, never a symbolic link's target, never anything in a linked worktree — after re-checking that its content is what the confirmation showed and that no agent session for the change is running, then staging that removal, and only it, with a single `git add --all -- openspec/changes/<name>/` — best-effort, never failing the dismissal, and never run for a refused dismissal. Apart from those worktree commands, that branch deletion, the pull action's removal of confirmed change leftovers and that change-directory deletion the dashboard MUST NOT delete or move anything in a tracked repository. Apart from the pull action it MUST NOT change the main checkout's working tree beyond the created and the dismissed change directories above, and MUST NOT change the main checkout's index beyond adding the created directory's files to it and staging the dismissed directory's removal, and MUST NOT contact a remote, and it MUST NOT change the main checkout's branch at all. It MUST NOT commit, push, stash or reset in a tracked repository under any circumstances, and MUST NOT create or delete a ref except the session branch created with a session's worktree and the local branches deleted by repository cleanup; it MUST NOT delete a remote-tracking ref or a remote branch. The pull action MUST NOT run except on the user's explicit request for that repository (or for all repositories): never on a timer, during a scan, on page load or as a side effect of another operation. Apart from the pull action, the only network access the dashboard makes is the pull-request query of the `pull-requests` capability: it runs only the GitHub CLI's read-only `gh pr list` and `gh api user`, never any other `gh` subcommand, with its working directory outside every tracked repository, and only when the user asks for it as specified in that capability; it MUST NOT write to a tracked repository, run git, or change anything on GitHub. Scanning, polling, discovery and serving the UI MUST NOT start a `gh` process. All other filesystem writes MUST be confined to `~/.openspec-dashboard/`. Scanning, polling, discovery, previews, reading work statuses and saving any dashboard setting MUST NOT write to a tracked repository. Apart from the worktree commands, the pull action's `fetch`, `merge --ff-only`, leftover `rm --cached` and restoring `add`, the create-change and dismissal `add` and the cleanup's `branch -D` above, git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `show-ref`, `symbolic-ref`, `for-each-ref`, `rev-list`, `diff`, `config --get`, `ls-files`, `ls-tree`, `cat-file`, `merge-tree`, and `hash-object` without `-w`). `merge-tree`, which computes the conflict signal of a work status, writes the merged tree it produces into an object database; it MUST therefore be invoked with its object directory pointed at a scratch store under `~/.openspec-dashboard/` and the repository's own object database offered only as an alternate, so that it reads everything it needs and writes nothing into the repository. It MUST NOT be given a working tree, an index or a ref to update. Every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`), so that no invocation rewrites `.git/index` as a side effect — `git status` refreshes the index by default — and only the pull action's `merge --ff-only`, its leftover `rm --cached` and restoring `add`, and the create-change and dismissal `add` may write the index at all, which they do by design. When agent sessions are enabled, the dashboard MAY start the user's configured agent in a session's worktree on the user's explicit request; what that agent changes, commits or pushes is the agent's doing under its own permission prompts and is never done by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

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

## ADDED Requirements

### Requirement: Resolve-conflicts endpoint

`POST /api/sessions/<id>/resolve-conflicts` SHALL perform the Resolve conflicts action for that session and return the session together with whether the prompt was submitted. It MUST be refused with `403` when agent sessions are disabled, `404` for an unknown session, `400` for a session that is not a change session or runs in place, `409` when the session's worktree reports no conflict or another session for the change is running, and `503` when the agent's executable is not found. The route is a mutating request under the same-origin protection. Performing it MUST NOT run any git command that changes the repository.

#### Scenario: Resolving a conflicting session
- **WHEN** `POST /api/sessions/<id>/resolve-conflicts` names a running session whose worktree conflicts with the base
- **THEN** the response reports the session and whether the prompt was submitted, and the repository's working tree, index, refs and checked-out branch are unchanged

#### Scenario: Nothing to resolve
- **WHEN** the named session's worktree reports no conflict
- **THEN** the response is `409` and no process is started and no prompt is sent

#### Scenario: In-place session
- **WHEN** the named session runs in a tracked folder that is not a git repository
- **THEN** the response is `400`

#### Scenario: Cross-site request
- **WHEN** the request arrives without the dashboard's own origin
- **THEN** it is refused by the same-origin protection and no prompt is sent
