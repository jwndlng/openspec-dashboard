## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action, and then only as enumerated here: (1) `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles); (2) for agent sessions, creating a git worktree and its branch for a session (`git worktree add`, preceded by `git worktree prune`), with the worktree's directory placed under `~/.openspec-dashboard/worktrees/` and never inside the repository's working tree, and removing such a worktree with a non-forcing `git worktree remove` after the user confirmed and read-only checks proved that it holds no uncommitted change and no commit that exists nowhere else. Apart from those worktree commands the dashboard MUST NOT delete or move anything in a tracked repository, MUST NOT change the main checkout's branch, index or working tree, and MUST NOT contact a remote. All other filesystem writes MUST be confined to `~/.openspec-dashboard/`. Scanning, polling, discovery, previews and saving any dashboard setting MUST NOT write to a tracked repository. Apart from the worktree commands above, git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `show-ref`, `symbolic-ref`, `for-each-ref`, `rev-list`). Because `git status` refreshes the index by default, every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`) so that not even `.git/index` is rewritten. When agent sessions are enabled, the dashboard MAY start the user's configured agent in a session's worktree on the user's explicit request; what that agent changes is the agent's doing under its own permission prompts and is never done by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

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

#### Scenario: A refused session creates nothing
- **WHEN** opening a session is refused
- **THEN** no worktree and no branch is created

#### Scenario: Feature disabled means no processes
- **WHEN** agent sessions are disabled and any API request is made
- **THEN** no agent process is started and no repository is touched

## ADDED Requirements

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
