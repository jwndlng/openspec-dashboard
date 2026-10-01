# dashboard-api Specification

## Purpose
Defines the single-binary loopback server and its JSON API (state, config, discover, scan, activity), the shared-config endpoints, the cross-site protection of mutating requests, and the guarantee that the dashboard writes to tracked repositories only on an explicit user action and only to enumerated paths.

## Requirements

### Requirement: Single binary serves UI and API on loopback

The dashboard SHALL be built with `bun build --compile` into one executable that serves the embedded SPA and the JSON API bound to `127.0.0.1` on the configured port (default 4711). Starting the binary SHALL print the URL and open the default browser unless `--no-open` is passed.

#### Scenario: Start
- **WHEN** the user runs `openspec-dashboard`
- **THEN** the server listens on `http://127.0.0.1:4711`, prints that URL, and the browser opens it

#### Scenario: Not reachable from the network
- **WHEN** another host on the LAN requests port 4711
- **THEN** the connection is refused

### Requirement: State endpoint

`GET /api/state` SHALL return the current `Snapshot` as JSON (`generatedAt`, `repos[]` with `changes[]` as defined in design.md), returning the cached snapshot until the first scan completes and an empty snapshot if no cache exists.

#### Scenario: Fresh install
- **WHEN** no repos are configured
- **THEN** `GET /api/state` returns `{ generatedAt, repos: [] }`

### Requirement: Config endpoints

`GET /api/config` SHALL return the config. `PUT /api/config` SHALL validate the body (absolute paths for `scanRoots`, `ignorePaths` and `repos[].path`, `pollIntervalSeconds >= 10`, unique repo ids, each repo `id` matching its canonical path), canonicalise all paths, persist it atomically, and return the saved config; invalid bodies MUST return `400` with a message and leave the config unchanged. A body without `ignorePaths` SHALL be accepted and saved with `ignorePaths: []`. If the set of enabled repos changed, a scan MUST be triggered.

#### Scenario: Invalid interval
- **WHEN** `PUT /api/config` is called with `pollIntervalSeconds: 1`
- **THEN** the response is `400` and the stored config is unchanged

#### Scenario: Relative ignore path is rejected
- **WHEN** `PUT /api/config` is called with `ignorePaths: ["relative/dir"]`
- **THEN** the response is `400` naming `ignorePaths.0` and the stored config is unchanged

#### Scenario: Paths are stored canonically
- **WHEN** `PUT /api/config` is called with a scan root given as `~/Workspace/alpha/` or through a symlink
- **THEN** the returned and stored config contain the canonical absolute path without a trailing separator

#### Scenario: Duplicate directory is rejected
- **WHEN** `PUT /api/config` is called with two repos whose paths resolve to the same directory
- **THEN** the response is `400` reporting a duplicate repo id

### Requirement: Discover endpoint

`POST /api/discover` SHALL run discovery and return `{ candidates: [...], integratable: [...], errors: [...] }`. The request MAY carry a JSON body with `scanRoots` and/or `ignorePaths`; when present they are used instead of the configured values, and each entry MUST be an absolute path after `~` expansion, otherwise the response MUST be `400` with a message. With no body the configured values are used. `candidates` SHALL contain only repositories found under the roots, outside the ignore paths, whose canonical path is not already in the saved config, each with `id`, canonical `path`, default `name` and `enabled: false`, sorted by path, and never the same directory twice. A candidate that shares its normalised `origin` remote with other known repositories SHALL carry `sameRemoteAs`, a list of `{ name, path, tracked }` for those repositories; otherwise the field is absent. `integratable` SHALL contain the git repositories found under the roots, outside the ignore paths, that hold no `openspec/config.yaml`, are not linked git worktrees, are not already in the saved config and do not contain a reported OpenSpec project, each with `id`, canonical `path` and default `name`, sorted by path and never the same directory twice; it is `[]` when there are none. `errors` SHALL list per-root problems. The endpoint MUST NOT persist anything and MUST NOT modify the in-memory config.

#### Scenario: Discover without saving
- **WHEN** `POST /api/discover` finds two new repos and the client never calls `PUT /api/config`
- **THEN** `GET /api/config` does not include the two repos

#### Scenario: Roots from the request body
- **WHEN** the saved config has no scan roots and `POST /api/discover` is called with `{ "scanRoots": ["/abs/workspace"] }`
- **THEN** the response lists the repositories under `/abs/workspace` as candidates and `GET /api/config` still returns empty `scanRoots`

#### Scenario: Ignore paths from the request body
- **WHEN** `POST /api/discover` is called with `{ "scanRoots": ["/abs/workspace"], "ignorePaths": ["/abs/workspace/mirror"] }`
- **THEN** no candidate has a path at or below `/abs/workspace/mirror` and `GET /api/config` still returns the saved `ignorePaths`

#### Scenario: Configured repos are not candidates
- **WHEN** the config already contains a repository at `/abs/workspace/a` (enabled or disabled) and discovery finds `/abs/workspace/a` and `/abs/workspace/b`
- **THEN** `candidates` contains only `/abs/workspace/b`

#### Scenario: Same directory through two roots
- **WHEN** `POST /api/discover` is called with two roots that resolve to the same directory
- **THEN** each repository below it appears once in `candidates`

#### Scenario: Shared remote is reported
- **WHEN** the config contains `/abs/a` and discovery finds `/abs/mirror/a` with the same `origin` remote
- **THEN** the candidate `/abs/mirror/a` has `sameRemoteAs` containing `{ "name": "a", "path": "/abs/a", "tracked": true }`

#### Scenario: Relative root is rejected
- **WHEN** `POST /api/discover` is called with `{ "scanRoots": ["relative/path"] }`
- **THEN** the response is `400` with a message and no walk is performed

#### Scenario: Missing root is reported, not fatal
- **WHEN** `POST /api/discover` is called with one existing and one non-existent root
- **THEN** the response is `200`, `errors` names the non-existent root, and `candidates` contains the repositories under the existing root

#### Scenario: Integratable repositories are returned
- **WHEN** `/abs/workspace/a` holds `openspec/config.yaml` and `/abs/workspace/b` is a git repository without it
- **THEN** `candidates` contains `/abs/workspace/a`, `integratable` contains `/abs/workspace/b`, and neither list contains the other's entry

#### Scenario: A container is not integratable
- **WHEN** `/abs/workspace/mono` is a git repository without the marker and `/abs/workspace/mono/pkg` holds `openspec/config.yaml`
- **THEN** `candidates` contains `/abs/workspace/mono/pkg` and `integratable` does not contain `/abs/workspace/mono`

#### Scenario: A tracked repository is in neither list
- **WHEN** the config contains `/abs/workspace/a` and discovery runs
- **THEN** `/abs/workspace/a` appears in neither `candidates` nor `integratable`

### Requirement: Scan endpoint

`POST /api/scan` SHALL trigger an immediate scan and return `{ started: true }`, or `{ started: false }` if a scan is already in flight.

#### Scenario: Trigger
- **WHEN** no scan is running and `POST /api/scan` is called
- **THEN** the response is `{ started: true }` and a new snapshot is available afterwards

### Requirement: Activity endpoint
`GET /api/activity` SHALL return `{ events, nextBefore?, newestId?, newerThanSince? }`: recorded activity newest first, with consecutive task progress of one change already collapsed. It SHALL accept `limit` (1–500, default 100), `before` (an event id; only older events are returned), `repos` (comma-separated repository ids), `kinds` (comma-separated event kinds) and `since` (an event id, possibly empty). `nextBefore` SHALL be present when older events matching the filters exist; `newestId` SHALL be the id of the newest recorded event regardless of filters, and absent when there is none. When `since` is given, `newerThanSince` SHALL be the number of recorded events newer than that id regardless of filters — all of them for an empty `since`. Invalid parameters MUST return `400` with a message. The endpoint MUST NOT modify anything, and it MUST NOT return file system paths, terminal output or prompt text.

#### Scenario: Nothing recorded
- **WHEN** no activity has been recorded
- **THEN** the response is `{ "events": [] }`

#### Scenario: Paging
- **WHEN** 250 events exist and the client requests `limit=100`, then repeats the request with `before` set to the returned `nextBefore`
- **THEN** the first response holds the newest 100 events and a `nextBefore`, the second the next 100, and no event appears twice

#### Scenario: Filtering
- **WHEN** the client requests `repos=<id of demo-ops>&kinds=session-started,session-ended`
- **THEN** only those kinds of events of that repository are returned, and `newestId` is still the newest event overall

#### Scenario: Counting what is new
- **WHEN** 5 events were recorded after the event with id `X` and the client requests `limit=1&since=X`
- **THEN** the response holds the newest event and `newerThanSince: 5`

#### Scenario: Invalid limit
- **WHEN** the client requests `limit=0`
- **THEN** the response is `400` with a message

### Requirement: Create-change endpoint
`POST /api/repos/<id>/changes` SHALL create a new OpenSpec change in the repository identified by `<id>`. The request body SHALL be JSON `{ name, prompt? }`, where `name` is a valid change name (`^[A-Za-z0-9._-]+$`) and `prompt` is an optional string. On success the response is `201` with `{ name, staged }`, where `staged` says whether the new directory was staged in the repository's index, and the repository is rescanned. On failure the response is `400` (invalid body or invalid name), `404` (unknown repository) or `409` (repository disabled, last scan failed, no `openspec/` parent, or an active or archived change already uses that name) with a JSON message. The endpoint MUST NOT write anything to the repository unless the request succeeds; a failed request MUST leave the repository byte-for-byte unchanged, its index and refs included. A failure to stage a successfully created change MUST NOT fail the request. The endpoint is mutating and MUST pass the same-origin protection.

#### Scenario: Successful create
- **WHEN** `POST /api/repos/<id>/changes` is called with `{ "name": "add-audit-trail" }` for an enabled, successfully scanned repository that has no `add-audit-trail` change
- **THEN** the response is `201` with `{ "name": "add-audit-trail", "staged": true }`, `openspec/changes/add-audit-trail/.openspec.yaml` exists in that repository and is staged in its index, and a following `GET /api/state` reflects the new change

#### Scenario: Staging failed
- **WHEN** the change is created but it could not be staged — the repository is not a git repository, or git failed
- **THEN** the response is still `201`, with `staged` false, and the change directory and its files are left in place

#### Scenario: Invalid name
- **WHEN** the request body is `{ "name": "foo/bar" }`
- **THEN** the response is `400` and nothing is written

#### Scenario: Duplicate name
- **WHEN** an active `add-audit-trail` change already exists
- **THEN** the response is `409` and nothing is written

#### Scenario: Cross-site
- **WHEN** a page on another origin posts to the endpoint
- **THEN** the response is `403` and nothing is written

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

### Requirement: Shared config endpoints

`GET /api/shared-config` SHALL return the stored profiles as `{ profiles: [...] }`, with an empty list when none has been saved. `PUT /api/shared-config` SHALL validate and persist them and return what was saved; invalid bodies MUST return `400` with a message and leave the stored profiles unchanged. `POST /api/shared-config/preview` with `{ "assignments": [{ "repoId", "profileIds": [...] }] }` SHALL return, per repository id, the profiles it carries now, the current file text, the text that apply would write, and a refusal reason when apply would refuse it, without writing anything. `POST /api/shared-config/apply` with the same body SHALL apply to each repository independently, where `profileIds` is the complete set of profiles that repository is to carry, return per repository `written`, `unchanged` or `refused` with a reason, and trigger a scan.

#### Scenario: Nothing saved yet
- **WHEN** `GET /api/shared-config` is called on a fresh install
- **THEN** the response is `{ profiles: [] }`

#### Scenario: Malformed assignments
- **WHEN** preview or apply is called without an `assignments` list of `{ repoId, profileIds }`
- **THEN** the response is `400` and nothing is written

#### Scenario: Partial success
- **WHEN** apply is requested for one healthy repository and one whose config is invalid YAML
- **THEN** the response is `200` with `written` for the first and `refused` with a reason for the second

### Requirement: Mutating requests are protected against cross-site requests

Every API request with a method other than `GET` SHALL be rejected with `403` unless its `Content-Type` is `application/json` and, when an `Origin` header is present, the origin is the dashboard's own (`http://127.0.0.1:<port>` or `http://localhost:<port>`). A request whose `Sec-Fetch-Site` header is `cross-site` SHALL be rejected. The server MUST NOT send CORS headers that would approve another origin. Rejected requests MUST have no side effects.

#### Scenario: Request from another web page
- **WHEN** a page on `https://example.com` sends `POST /api/shared-config/apply` to the dashboard
- **THEN** the response is `403` and no file is written

#### Scenario: Form post
- **WHEN** a `POST` arrives with `Content-Type: application/x-www-form-urlencoded`
- **THEN** the response is `403`

#### Scenario: The dashboard's own UI
- **WHEN** the UI served from `http://127.0.0.1:4711` sends `PUT /api/config` with a JSON body
- **THEN** the request is processed as before

#### Scenario: Command-line client
- **WHEN** `curl -X POST -H 'content-type: application/json'` calls `/api/scan` without an `Origin` header
- **THEN** the request is processed

### Requirement: Session endpoints

The API SHALL provide: `POST /api/sessions` with `{ repoId, change, action }` to open a session (returning, once the request passed the refusals listed below, the session that is already running for that repository and change if there is one, whatever action was asked for, `archive` included, and starting nothing in that case); `GET /api/sessions` returning the sessions and, for each configured agent, whether its executable was found; `GET /api/sessions/<id>`; `GET /api/sessions/<id>/worktree` reporting whether the worktree could be removed safely; `POST /api/sessions/<id>/resume`; `POST /api/sessions/<id>/close` with optional `{ removeWorktree }`, which ends the agent if it is running; and `DELETE /api/sessions/<id>` for a session that is not running. Opening MUST be refused with `403` when agent sessions are disabled or the repository is excluded from them, with `404` for an unknown repository or change, with `409` when the repository is not tracked or its last scan failed, with `400` for an invalid change name, an unknown action, an action not available in the change's stage or an agent without a prompt for it, with `503` when the agent's executable is not found, and with `500` and git's reason when the worktree cannot be created. All session routes other than `GET` are mutating and subject to the same-origin protection that applies to every mutating API request. `GET /api/state` SHALL remain unchanged.

#### Scenario: Duplicate open
- **WHEN** a session for repository `r` and change `c` is running and `POST /api/sessions` is sent again for `r` and `c`
- **THEN** the response contains the existing session and no second process is started

#### Scenario: Another action for a change that has a session
- **WHEN** a session for repository `r` and change `c` is running and `POST /api/sessions` is sent for `r` and `c` with `action: "archive"`
- **THEN** the response contains that running session, no worktree is created, no process is started and nothing is written to its terminal

#### Scenario: Feature disabled
- **WHEN** agent sessions are disabled and `POST /api/sessions` is called
- **THEN** the response is `403`, no worktree is created and no process is started

#### Scenario: Session routes are same-origin only
- **WHEN** a page from another origin sends `POST /api/sessions`
- **THEN** the response is `403` and no session is opened

#### Scenario: Deleting a running session
- **WHEN** `DELETE /api/sessions/<id>` targets a running session
- **THEN** the response is `409` and the session keeps running

### Requirement: The terminal is served over a same-origin WebSocket

`GET /api/sessions/<id>/terminal` SHALL upgrade to a WebSocket carrying the session's terminal: the server sends terminal output as binary frames — first what the terminal has shown so far, bounded — and one text frame `{"type":"exit"}` when the agent has ended; the client sends text frames `{"type":"input","data":…}` and `{"type":"resize","cols":…,"rows":…}`. Because a WebSocket handshake is a cross-origin-capable `GET` without a preflight, the upgrade MUST be refused with `403` unless the request is addressed to a loopback host name and carries an `Origin` header that is the dashboard's own origin; a missing `Origin` MUST be refused. A request for an unknown session MUST be refused, and a request that is not a WebSocket upgrade MUST NOT open anything. Input for a session that is not running MUST be ignored.

#### Scenario: Another web page tries to attach
- **WHEN** a page from `https://example.com` opens a WebSocket to a session's terminal
- **THEN** the handshake is refused and nothing is delivered to the agent

#### Scenario: No Origin header
- **WHEN** a client without an `Origin` header requests the terminal
- **THEN** the handshake is refused

#### Scenario: DNS rebinding
- **WHEN** the handshake is addressed to a host name other than a loopback name, even with a matching `Origin`
- **THEN** it is refused

#### Scenario: Output, input and resize
- **WHEN** the dashboard's own page attaches, sends a resize to 77 columns and then types a line
- **THEN** the agent sees a 77-column terminal, receives the line, and its output arrives as binary frames

#### Scenario: Second viewer
- **WHEN** a second viewer attaches to a running session
- **THEN** it first receives the earlier output and then the same live output as the first viewer

#### Scenario: Ended session
- **WHEN** a viewer attaches to a session that has ended
- **THEN** it receives the stored output followed by the exit frame

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

### Requirement: Prompt endpoint and fresh work status

`POST /api/sessions/<id>/prompt` with `{ action }` SHALL submit that starter's prompt to the running session under the rules for text sent on the user's behalf and return the session together with whether the prompt was submitted. Every action a change's stage allows SHALL be accepted, `archive` included, and the action the session itself was started with SHALL NOT restrict what is accepted. It MUST be refused with `403` when agent sessions are disabled, `404` for an unknown session or a change that is no longer scanned, `409` when the session is not running, and `400` for an unknown action, an action not available in the change's current stage, or an agent without a prompt for it. It is a mutating route under the same-origin protection. `GET /api/sessions/<id>/worktree` SHALL additionally return `work`, the worktree's work status read at the time of the request rather than from a cache.

#### Scenario: Prompt submitted
- **WHEN** `POST /api/sessions/<id>/prompt` targets a running session whose agent shows a text prompt
- **THEN** the response carries the session with `submitted` true and the agent received the prompt

#### Scenario: Archive accepted
- **WHEN** `POST /api/sessions/<id>/prompt` sends `archive` to the running session of a change in `Done` whose agent has an Archive prompt
- **THEN** the response carries that same session with its action `archive`, and no worktree was created and no process started

#### Scenario: Prompt only typed
- **WHEN** the agent does not show the typed prompt within the bounded time
- **THEN** the response carries the session with `submitted` false and no Enter was sent

#### Scenario: Not running
- **WHEN** `POST /api/sessions/<id>/prompt` targets an ended session
- **THEN** the response is `409` and no process is started

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/sessions/<id>/prompt`
- **THEN** the response is `403` and nothing is written to the terminal

#### Scenario: Fresh status for the end dialog
- **WHEN** a file is created in a session's worktree and `GET /api/sessions/<id>/worktree` is requested immediately
- **THEN** `work` is `uncommitted` with a count of 1

### Requirement: Change artifact endpoints
The API SHALL provide two read-only endpoints for the artifacts of one change of one tracked repository:

`GET /api/repos/<repoId>/changes/<changeName>/artifacts` SHALL return `{ change, artifacts }`, where `change` names the repository id, the change name, the schema, the absolute change directory and whether the change is archived, and `artifacts` lists, in the schema's artifact order, `{ id, status, files }` with `files` being the artifact's existing files as paths relative to the change directory, sorted, each with its size in bytes. An artifact with no file SHALL appear with an empty `files` list.

`GET /api/repos/<repoId>/changes/<changeName>/file?path=<relative path>` SHALL return `{ path, bytes, text }` for one file of that change, read as UTF-8.

Both endpoints SHALL resolve `<repoId>` against the repositories that are enabled in the dashboard config, and `<changeName>` against that repository's active and archived change directories; the change directory is always derived on the server and never taken from the request. When the snapshot says the change's data comes from a linked worktree of that repository, the endpoints SHALL read from that worktree — the same checkout the scanner read — and otherwise from the main checkout. Archived changes SHALL be readable through the same endpoints.

The responses MUST be: `400` when the change name does not match the permitted character set, or when `path` is missing, absolute, or escapes the change directory after normalisation; `404` for an unknown or disabled repository, an unknown change, or a `path` that is not an existing regular file inside the change directory; `413` when the file is larger than 1 MiB, without returning its content. A path whose resolved target — following symbolic links — lies outside the change directory MUST be refused as if it did not exist.

Both endpoints are `GET` and MUST NOT create, modify or delete anything in a tracked repository, and MUST NOT send CORS headers that let another origin read their responses.

#### Scenario: Artifact list
- **WHEN** `GET /api/repos/<id>/changes/cloud-deployment/artifacts` is called for a `spec-driven` change with a proposal and two delta specs
- **THEN** the response lists `proposal` with `proposal.md`, `specs` with both `specs/**/spec.md` paths sorted, and `design` and `tasks` with empty `files`

#### Scenario: File content
- **WHEN** `GET /api/repos/<id>/changes/cloud-deployment/file?path=proposal.md` is called
- **THEN** the response contains the file's text and its size in bytes

#### Scenario: Archived change
- **WHEN** either endpoint is called for a change that lives under `openspec/changes/archive/`
- **THEN** it answers from that archived directory

#### Scenario: Change in a linked worktree
- **WHEN** a change exists only in a linked worktree of a tracked repository and the board shows it
- **THEN** both endpoints answer from that worktree's change directory

#### Scenario: Traversal is refused
- **WHEN** `path` is `../../../../etc/passwd`, `/etc/passwd`, or `specs/../../../secrets.md`
- **THEN** the response is `400` or `404` and no file outside the change directory is read

#### Scenario: Symlink out of the change directory
- **WHEN** the change directory contains a symbolic link pointing outside it and that link is requested as `path`
- **THEN** the response is `404` and the link target is not read

#### Scenario: Unknown repository or change
- **WHEN** either endpoint is called with a repository id that is not enabled in the config, or with a change name that repository does not have
- **THEN** the response is `404`

#### Scenario: Invalid change name
- **WHEN** either endpoint is called with a change name containing a path separator or other characters outside the permitted set
- **THEN** the response is `400` and no directory is read

#### Scenario: Oversize file
- **WHEN** the requested file is larger than 1 MiB
- **THEN** the response is `413` with a message and without the file's content

#### Scenario: Reading changes nothing
- **WHEN** both endpoints are called for every change of every tracked repository
- **THEN** no file under any tracked repository is created, modified or deleted

### Requirement: Main console endpoint
`POST /api/console` SHALL open the main console and return its session: the running console session if there is one,
otherwise a newly started one. It MUST be refused with `403` when agent sessions are disabled, with `503` when the
default agent's executable is not found, and with `409` when the console folder is not usable, each with a reason and
without starting a process. It is a mutating request under the same-origin protection. `GET /api/sessions` SHALL
include console sessions, marked as such and without repository, change, action or branch; resume, close, delete and the
terminal WebSocket SHALL accept a console session's id like any other. `POST /api/sessions/<id>/ship`,
`POST /api/sessions/<id>/prompt` and `GET /api/sessions/<id>/worktree` SHALL be refused with `409` for a console
session, and `POST /api/sessions/<id>/close` SHALL ignore `removeWorktree` for it. `PUT /api/config` SHALL refuse with
`400` a console folder that is not an absolute path to an existing directory outside every tracked repository.

#### Scenario: Opening twice
- **WHEN** `POST /api/console` is sent while a console session is running
- **THEN** the response contains that session and no second process is started

#### Scenario: Feature disabled
- **WHEN** agent sessions are disabled and `POST /api/console` is called
- **THEN** the response is `403` and no process is started

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/console`
- **THEN** the response is `403` and no process is started

#### Scenario: Change-only routes
- **WHEN** `POST /api/sessions/<id>/ship` names a console session
- **THEN** the response is `409` and nothing is sent to its terminal

#### Scenario: Console folder inside a repository
- **WHEN** `PUT /api/config` sets the console folder to a directory inside a tracked repository
- **THEN** the response is `400` and the saved configuration is unchanged

### Requirement: Integration endpoints

`POST /api/integrations` with `{ path }` SHALL open an integration session for that integratable repository and return
it: the running integration session for that folder if there is one, otherwise a newly started one. The path MUST be an
absolute path that discovery currently reports as integratable; anything else MUST be refused with `404`, including a
path that is already a tracked repository, holds `openspec/config.yaml`, is not a git repository, is a linked worktree
or lies outside the configured roots or below an ignore path. The request MUST be refused with `403` when agent
sessions are disabled, with `400` when the default agent has no `integrate` prompt, and with `503` when the default
agent's executable is not found — each with a reason and without starting a process. It is a mutating request under the
same-origin protection.

`GET /api/sessions` SHALL include integration sessions, marked as such, carrying the folder and no repository id,
change, action or branch; resume, close, delete and the terminal WebSocket SHALL accept an integration session's id
like any other. `POST /api/sessions/<id>/ship`, `POST /api/sessions/<id>/prompt` and
`GET /api/sessions/<id>/worktree` SHALL be refused with `409` for an integration session, and
`POST /api/sessions/<id>/close` SHALL ignore `removeWorktree` for it.

When an integration session ends, the server SHALL re-check its folder for `openspec/config.yaml` and, if it is there,
add the repository to the configuration with `enabled: true` and its default name and start a scan; `GET /api/config`
then returns it and `GET /api/state` shows it once the scan completes. If the marker is absent the configuration MUST
be unchanged.

#### Scenario: Opening an integration
- **WHEN** `POST /api/integrations` is sent with the path of a repository discovery reports as integratable
- **THEN** the response is the integration session, with the folder as its working directory and no branch

#### Scenario: Opening twice
- **WHEN** `POST /api/integrations` is sent for a folder whose integration session is running
- **THEN** the response contains that session and no second process is started

#### Scenario: A path that is not integratable
- **WHEN** `POST /api/integrations` names a directory that already holds `openspec/config.yaml`
- **THEN** the response is `404` and no process is started

#### Scenario: Feature disabled
- **WHEN** agent sessions are disabled and `POST /api/integrations` is called
- **THEN** the response is `403` and no process is started

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/integrations`
- **THEN** the response is `403` and no process is started

#### Scenario: Change-only routes
- **WHEN** `POST /api/sessions/<id>/ship` names an integration session
- **THEN** the response is `409` and nothing is sent to its terminal

#### Scenario: Marker present when the session ends
- **WHEN** an integration session ends and `openspec/config.yaml` now exists in its folder
- **THEN** `GET /api/config` contains that repository with `enabled: true` and a scan has been started

#### Scenario: Marker absent when the session ends
- **WHEN** an integration session ends and its folder holds no `openspec/config.yaml`
- **THEN** `GET /api/config` is unchanged and the next `POST /api/discover` still lists the folder in `integratable`

### Requirement: Dismiss endpoints
`GET /api/repos/<id>/changes/<name>/dismiss` SHALL return what dismissing the change would delete, as specified in the `change-dismissal` capability: whether the repository is a git repository, every file in the change's directory in the main checkout with its relative path and whether it is restorable from git or lost for good, the linked worktrees holding a copy of the change with path and branch, and a `fingerprint` of that content. It MUST NOT write anything. `POST /api/repos/<id>/changes/<name>/dismiss` with `{ "fingerprint": <string> }` SHALL re-check and delete the change directory, stage its removal, trigger a rescan of the repository and return `{ "name", "staged" }`. Both routes SHALL accept only a repository that is configured, enabled and whose last scan succeeded — otherwise `404` (unknown) or `409` (not eligible) — and a name matching the change-name pattern other than `archive` — otherwise `400`; the repository's path MUST come from the config, never from the request. A change without an active directory in the main checkout SHALL be answered with `404`, with a reason naming the linked worktree when one holds it. A missing or malformed `fingerprint` SHALL be refused with `400`; a fingerprint that no longer matches, a running agent session for the change and a dismissal of the same change already running SHALL be refused with `409`; every refusal deletes nothing and runs no writing git command. The `POST` route is subject to the same-origin protection. Neither route depends on agent sessions being enabled.

#### Scenario: Preview
- **WHEN** `GET /api/repos/demo-ops/changes/lint-rules/dismiss` is called for a change with one committed and one untracked file
- **THEN** the response lists both files, the first as restorable and the second as lost for good, with a fingerprint

#### Scenario: Dismiss
- **WHEN** `POST /api/repos/demo-ops/changes/lint-rules/dismiss` is sent with the fingerprint from the preview
- **THEN** the response is `200` with `{ "name": "lint-rules", "staged": true }`, the directory is gone and a rescan is triggered

#### Scenario: Stale fingerprint
- **WHEN** a file of the change was modified between the preview and the `POST`
- **THEN** the response is `409` and the directory is unchanged

#### Scenario: Traversal in the name
- **WHEN** the name is `..` or `archive`
- **THEN** the response is `400` and nothing is read or deleted

#### Scenario: Worktree-only change
- **WHEN** either route is called for a change that exists only in a linked worktree on `feat/cloud-deployment`
- **THEN** the response is `404` with a reason naming `feat/cloud-deployment`, and nothing is deleted

#### Scenario: Disabled repository
- **WHEN** either route is called for a disabled repository
- **THEN** the response is `409` and nothing is read or deleted

#### Scenario: Foreign origin
- **WHEN** a page on another origin posts to `/api/repos/<id>/changes/<name>/dismiss`
- **THEN** the response is `403` and nothing is deleted

### Requirement: Cleanup endpoints
`GET /api/repos/<id>/cleanup` SHALL return the repository's cleanup preview as specified in the `repository-cleanup`
capability: the base branch, and the lists of worktrees, stale worktree records and branches, each item with whether
it is removable and otherwise the reason it is kept; each branch item SHALL carry the commit it points to and, when it
is checked out in a worktree, that worktree's path. `POST /api/repos/<id>/cleanup` with
`{ "worktrees": [<path>, …], "prune": <boolean>, "branches": [{ "name", "commit" }, …] }` SHALL apply that selection
under the cleanup rules and return one outcome per requested item, then trigger a rescan of the repository. Both
routes SHALL accept only a repository that is configured, enabled, a git repository and whose last scan succeeded;
otherwise the response is `404` (unknown) or `409` (not eligible) and no git command is run. The repository's path
MUST come from the config, never from the request. A worktree path in the request that is not a linked worktree of
that repository, and a branch name that is not a valid local branch name of that repository, SHALL be reported as kept
with a reason and never passed to a removal; a malformed body SHALL be refused with `400` and nothing removed. A second
`POST` for a repository whose cleanup is still running SHALL be refused with `409`. The `POST` route is subject to the
same-origin protection. Neither route depends on agent sessions being enabled.

#### Scenario: Preview
- **WHEN** `GET /api/repos/<id>/cleanup` is called for a repository with one merged worktree
- **THEN** the response lists that worktree as removable and its branch as removable with its commit

#### Scenario: Foreign path
- **WHEN** `POST /api/repos/<id>/cleanup` names the worktree path `/tmp/elsewhere`, which is not a worktree of that
  repository
- **THEN** the response reports it as kept because it is not a worktree of the repository, and no git write command is
  run for it

#### Scenario: Option-like branch name
- **WHEN** the request names the branch `--all`
- **THEN** it is reported as kept as an invalid branch name and no branch is deleted

#### Scenario: Disabled repository
- **WHEN** either route is called for a disabled repository
- **THEN** the response is `409` and no git command is run

#### Scenario: Concurrent cleanup
- **WHEN** a second `POST` arrives while a cleanup of the same repository is running
- **THEN** the response is `409` and the first cleanup's outcome is unaffected

#### Scenario: Foreign origin
- **WHEN** a page on another origin posts to `/api/repos/<id>/cleanup`
- **THEN** the response is `403` and nothing is removed

### Requirement: Environment endpoint
`GET /api/environment` SHALL return the environment report as JSON: the time it was computed, the overall status and the
checks in their stable order, each with its identifier, label, status, what was found and, when the status is not `ok`,
its remedy. It SHALL be computed under the rules of the `environment-check` capability: no network, nothing read from or
written to a tracked repository, no credential value in the response, and `git config --get` as the only process it
starts, run with a working directory outside every tracked repository. The report MAY be reused for at most 10 seconds.
The endpoint is a `GET` and therefore adds no mutating route; no other route's behaviour changes, and `GET /api/state`
SHALL remain unchanged.

#### Scenario: Report shape
- **WHEN** `GET /api/environment` is requested
- **THEN** the response is JSON with the time it was computed, an overall status and one entry per check, each with an identifier, a label and a status

#### Scenario: No credential in the response
- **WHEN** `GH_TOKEN` is set and `GET /api/environment` is requested
- **THEN** the response body does not contain that token's value

#### Scenario: The request touches no repository
- **WHEN** `GET /api/environment` is requested while repositories are tracked
- **THEN** no file under any tracked repository, including its git config and index, is created, modified or deleted, and no network connection is opened

#### Scenario: Nothing mutates
- **WHEN** `POST /api/environment` is requested
- **THEN** the response is the same as for any unknown route and no report is computed
