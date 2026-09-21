# dashboard-api Specification

## Purpose
Defines the single-binary loopback server and its JSON API (state, config, discover, scan), the shared-config endpoints, the cross-site protection of mutating requests, and the guarantee that the dashboard writes to tracked repositories only on an explicit user action and only to enumerated paths.

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
`GET /api/config` SHALL return the config. `PUT /api/config` SHALL validate the body (absolute paths, `pollIntervalSeconds >= 10`, unique repo ids), persist it atomically, and return the saved config; invalid bodies MUST return `400` with a message and leave the config unchanged. If the set of enabled repos changed, a scan MUST be triggered.

#### Scenario: Invalid interval
- **WHEN** `PUT /api/config` is called with `pollIntervalSeconds: 1`
- **THEN** the response is `400` and the stored config is unchanged

### Requirement: Discover endpoint
`POST /api/discover` SHALL run discovery and return `{ candidates: [...], errors: [...] }`. The request MAY carry a JSON body `{ "scanRoots": [...] }`; when present those roots are used instead of the configured scan roots, and each MUST be an absolute path after `~` expansion, otherwise the response MUST be `400` with a message. With no body the configured scan roots are used. `candidates` SHALL contain only repositories found under the roots whose path is not already in the saved config, each with `id`, `path`, default `name` and `enabled: false`, sorted by path. `errors` SHALL list per-root problems. The endpoint MUST NOT persist anything and MUST NOT modify the in-memory config.

#### Scenario: Discover without saving
- **WHEN** `POST /api/discover` finds two new repos and the client never calls `PUT /api/config`
- **THEN** `GET /api/config` does not include the two repos

#### Scenario: Roots from the request body
- **WHEN** the saved config has no scan roots and `POST /api/discover` is called with `{ "scanRoots": ["/abs/workspace"] }`
- **THEN** the response lists the repositories under `/abs/workspace` as candidates and `GET /api/config` still returns empty `scanRoots`

#### Scenario: Configured repos are not candidates
- **WHEN** the config already contains a repository at `/abs/workspace/a` (enabled or disabled) and discovery finds `/abs/workspace/a` and `/abs/workspace/b`
- **THEN** `candidates` contains only `/abs/workspace/b`

#### Scenario: Relative root is rejected
- **WHEN** `POST /api/discover` is called with `{ "scanRoots": ["relative/path"] }`
- **THEN** the response is `400` with a message and no walk is performed

#### Scenario: Missing root is reported, not fatal
- **WHEN** `POST /api/discover` is called with one existing and one non-existent root
- **THEN** the response is `200`, `errors` names the non-existent root, and `candidates` contains the repositories under the existing root

### Requirement: Scan endpoint
`POST /api/scan` SHALL trigger an immediate scan and return `{ started: true }`, or `{ started: false }` if a scan is already in flight.

#### Scenario: Trigger
- **WHEN** no scan is running and `POST /api/scan` is called
- **THEN** the response is `{ started: true }` and a new snapshot is available afterwards

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action, and then only as enumerated here: (1) `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles); (2) for agent sessions, creating a git worktree and its branch for a session (`git worktree add`, preceded by `git worktree prune`), with the worktree's directory placed under `~/.openspec-dashboard/worktrees/` and never inside the repository's working tree, and removing such a worktree with a non-forcing `git worktree remove` after the user confirmed and read-only checks proved that it holds no uncommitted change and no work that exists nowhere else; (3) the pull action: `git fetch` from the repository's own remote followed by a fast-forward-only `git merge` of the main checkout's upstream, with repository hooks disabled, as specified in the `repository-pull` capability. Apart from those worktree commands the dashboard MUST NOT delete or move anything in a tracked repository. Apart from the pull action it MUST NOT change the main checkout's index or working tree and MUST NOT contact a remote, and it MUST NOT change the main checkout's branch at all. The pull action MUST NOT run except on the user's explicit request for that repository (or for all repositories): never on a timer, during a scan, on page load or as a side effect of another operation. All other filesystem writes MUST be confined to `~/.openspec-dashboard/`. Scanning, polling, discovery, previews, reading work statuses and saving any dashboard setting MUST NOT write to a tracked repository. Apart from the worktree commands and the pull action's `fetch` and `merge --ff-only` above, git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `show-ref`, `symbolic-ref`, `for-each-ref`, `rev-list`, `diff`). Because `git status` refreshes the index by default, every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`) so that not even `.git/index` is rewritten. When agent sessions are enabled, the dashboard MAY start the user's configured agent in a session's worktree on the user's explicit request; what that agent changes, commits or pushes is the agent's doing under its own permission prompts and is never done by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

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
The API SHALL provide: `POST /api/sessions` with `{ repoId, change, action }` to open a session (returning the running session for that repository and change if there is one); `GET /api/sessions` returning the sessions and, for each configured agent, whether its executable was found; `GET /api/sessions/<id>`; `GET /api/sessions/<id>/worktree` reporting whether the worktree could be removed safely; `POST /api/sessions/<id>/resume`; `POST /api/sessions/<id>/close` with optional `{ removeWorktree }`, which ends the agent if it is running; and `DELETE /api/sessions/<id>` for a session that is not running. Opening MUST be refused with `403` when agent sessions are disabled or the repository is excluded from them, with `404` for an unknown repository or change, with `409` when the repository is not tracked or its last scan failed, with `400` for an invalid change name, an unknown action, an action not available in the change's stage or an agent without a prompt for it, with `503` when the agent's executable is not found, and with `500` and git's reason when the worktree cannot be created. All session routes other than `GET` are mutating and subject to the same-origin protection that applies to every mutating API request. `GET /api/state` SHALL remain unchanged.

#### Scenario: Duplicate open
- **WHEN** a session for repository `r` and change `c` is running and `POST /api/sessions` is sent again for `r` and `c`
- **THEN** the response contains the existing session and no second process is started

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
`POST /api/repos/<id>/pull` SHALL run the pull action for one repository and return its result; `POST /api/pull` SHALL run it for every eligible repository with bounded concurrency and return one result per repository, a failure in one not affecting the others. A repository is eligible only if it is enabled in the config, its last scan succeeded and it is a git repository; the repository's path MUST come from the config and never from the request. An unknown, disabled or non-git repository SHALL be refused without running git. A second request for a repository whose pull is still running SHALL be refused with `409`. Both endpoints are mutating requests under the same-origin protection. After a pull the repository SHALL be rescanned.

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

#### Scenario: Foreign origin
- **WHEN** a page on another origin posts to a pull endpoint
- **THEN** the response is `403` and nothing is fetched

### Requirement: Prompt endpoint and fresh work status
`POST /api/sessions/<id>/prompt` with `{ action }` SHALL send that starter's prompt to the running session as typed input without Enter and return the session. It MUST be refused with `403` when agent sessions are disabled, `404` for an unknown session or a change that is no longer scanned, `409` when the session is not running, and `400` for an unknown action, `archive`, an action not available in the change's current stage, or an agent without a prompt for it. It is a mutating route under the same-origin protection. `GET /api/sessions/<id>/worktree` SHALL additionally return `work`, the worktree's work status read at the time of the request rather than from a cache.

#### Scenario: Not running
- **WHEN** `POST /api/sessions/<id>/prompt` targets an ended session
- **THEN** the response is `409` and no process is started

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/sessions/<id>/prompt`
- **THEN** the response is `403` and nothing is written to the terminal

#### Scenario: Fresh status for the end dialog
- **WHEN** a file is created in a session's worktree and `GET /api/sessions/<id>/worktree` is requested immediately
- **THEN** `work` is `uncommitted` with a count of 1
