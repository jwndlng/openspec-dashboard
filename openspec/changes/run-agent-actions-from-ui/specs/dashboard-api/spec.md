## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
The dashboard's own code MUST confine its filesystem writes to `~/.openspec-dashboard/`, with one exception: on explicit user confirmation it MAY remove an agent session's worktree with `git worktree unlock` followed by a non-forcing `git worktree remove`, after verifying that the worktree holds no uncommitted or unpushed work. Apart from those two commands, git MUST only be invoked by the dashboard with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`, `rev-list`). Because `git status` refreshes the index by default, every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`) so that not even `.git/index` is rewritten. When agent sessions are enabled and the repository has opted in, the dashboard MAY start the user's agent CLI in a dedicated worktree on the user's explicit request; changes made by that agent are the agent's, are confined to its worktree by instruction, and are never made by the dashboard's own code. With agent sessions disabled the dashboard MUST NOT start any process that can modify a repository.

#### Scenario: No side effects
- **WHEN** a full scan runs across all tracked repos
- **THEN** no file under any tracked repository is created, modified or deleted

#### Scenario: Status does not refresh the index
- **WHEN** a scan runs `git status` in a repository whose index has stale stat information
- **THEN** the repository's `.git/index` file is byte-for-byte unchanged afterwards

#### Scenario: Feature disabled means no processes
- **WHEN** agent sessions are disabled and any API request is made
- **THEN** no agent process is started and no repository file changes

#### Scenario: Worktree removal needs confirmation and a clean worktree
- **WHEN** a session is closed without the remove-worktree confirmation, or its worktree has uncommitted or unpushed work
- **THEN** the dashboard runs no git write command

## ADDED Requirements

### Requirement: Session endpoints
The API SHALL provide: `POST /api/sessions` with `{ repoId, change, action }` to open a session (returning the existing open session for that repository and change if there is one); `GET /api/sessions` to list sessions; `GET /api/sessions/<id>` for one session's metadata; `GET /api/sessions/<id>/events?after=<seq>` streaming transcript events as Server-Sent Events in sequence order and honouring `Last-Event-ID`; `POST /api/sessions/<id>/messages` with `{ text }`; `POST /api/sessions/<id>/stop`; `POST /api/sessions/<id>/close` with optional `{ removeWorktree }`; `POST /api/sessions/<id>/cancel`; and `DELETE /api/sessions/<id>` for an ended session. Opening MUST be refused with `403` when agent sessions are disabled or the repository has not opted in, with `404` for an unknown repository or change, with `409` when the repository is disabled or its last scan failed, with `400` for an invalid change name, unknown action or an action not available in the change's stage, and with `503` when the agent CLI is unavailable. All session routes other than `GET` are mutating and therefore subject to the same-origin protection that applies to every mutating API request. `GET /api/state` SHALL remain unchanged.

#### Scenario: Open and stream
- **WHEN** `POST /api/sessions` succeeds and the client then requests the events stream
- **THEN** the client receives the opening user message and subsequent events in increasing `seq` order

#### Scenario: Reconnect without loss
- **WHEN** the events stream is reconnected with `Last-Event-ID: 41`
- **THEN** the stream continues with the event whose `seq` is 42

#### Scenario: Duplicate open
- **WHEN** a session for repository `r` and change `c` is open and `POST /api/sessions` is sent again for `r` and `c`
- **THEN** the response contains the existing session and no second process is started

#### Scenario: Session routes are same-origin only
- **WHEN** a page from another origin sends `POST /api/sessions` or `POST /api/sessions/<id>/messages`
- **THEN** the response is `403`, no session is opened and no message is delivered

#### Scenario: Feature disabled
- **WHEN** agent sessions are disabled and `POST /api/sessions` is called
- **THEN** the response is `403` and no process is started

#### Scenario: Message to an ended session
- **WHEN** `POST /api/sessions/<id>/messages` targets a `closed`, `cancelled` or `failed` session
- **THEN** the response is `409` and nothing is sent
