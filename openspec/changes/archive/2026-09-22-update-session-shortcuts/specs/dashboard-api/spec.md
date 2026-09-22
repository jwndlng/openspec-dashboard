# Spec Delta

## MODIFIED Requirements

### Requirement: Prompt endpoint and fresh work status

`POST /api/sessions/<id>/prompt` with `{ action }` SHALL submit that starter's prompt to the running session under the rules for text sent on the user's behalf and return the session together with whether the prompt was submitted. It MUST be refused with `403` when agent sessions are disabled, `404` for an unknown session or a change that is no longer scanned, `409` when the session is not running, and `400` for an unknown action, `archive`, an action not available in the change's current stage, or an agent without a prompt for it. It is a mutating route under the same-origin protection. `GET /api/sessions/<id>/worktree` SHALL additionally return `work`, the worktree's work status read at the time of the request rather than from a cache.

#### Scenario: Prompt submitted
- **WHEN** `POST /api/sessions/<id>/prompt` targets a running session whose agent shows a text prompt
- **THEN** the response carries the session with `submitted` true and the agent received the prompt

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
