# Spec Delta

## MODIFIED Requirements

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
