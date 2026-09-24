## ADDED Requirements

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
