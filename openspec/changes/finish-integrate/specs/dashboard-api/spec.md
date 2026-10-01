# Spec Delta

## MODIFIED Requirements

### Requirement: Integration endpoints

`POST /api/integrations` with `{ path }` SHALL open an integration session for that integratable repository and return
it: the running integration session for that folder if there is one, otherwise a newly started one. The path MUST be an
absolute path that discovery currently reports as integratable; anything else MUST be refused with `404`, including a
path that is already a tracked repository, holds `openspec/config.yaml`, is not a git repository, is a linked worktree
or lies outside the configured roots or below an ignore path. The request MUST be refused with `403` when agent
sessions are disabled, and with `503` when no default agent is configured or the default agent's executable is not
found — each with a reason and without starting a process. A default agent without an `integrate` prompt of its own
MUST NOT be refused: the session is started with the agent-neutral default Integrate prompt. It is a mutating request
under the same-origin protection.

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

#### Scenario: Opening with an agent that has no Integrate prompt
- **WHEN** `POST /api/integrations` is sent for an integratable repository and the default agent's profile carries no `integrate` prompt
- **THEN** the response is the integration session, and the agent was started with the agent-neutral default Integrate prompt

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

### Requirement: Create-project endpoint

`POST /api/projects` with `{ root, name }` SHALL create a new project as specified in the `project-creation` capability
and return `201` with the new folder's canonical `path` and the integration session started in it. It is a mutating
request under the same-origin protection. Before anything is written the request MUST be refused, each with a reason and
without creating a folder, running git or starting a process: with `403` when agent sessions are disabled; with `400`
when `name` is not a valid folder name; with `404` when `root` is not a configured workspace root or is not an existing
directory; with `409` when the target path exists or lies in or below a tracked repository, an ignore path or the
dashboard's home directory; and with `503` when no default agent is configured or the default agent's executable or
`git` is not found. A default agent without an `integrate` prompt of its own MUST NOT be refused. When the folder was
created but `git init` failed, the response SHALL be `500` with git's error and the folder's path, and no process SHALL
have been started.

#### Scenario: Creating a project
- **WHEN** `POST /api/projects` is sent with `{ "root": "/w/acme", "name": "gamma-tools" }`, `/w/acme` is a workspace root and agent sessions are on
- **THEN** the response is `201` with `path` `/w/acme/gamma-tools` and a running integration session whose folder is that path

#### Scenario: Creating a project with an agent that has no Integrate prompt
- **WHEN** `POST /api/projects` is sent with a valid root and name and the default agent's profile carries no `integrate` prompt
- **THEN** the response is `201` and the integration session was started with the agent-neutral default Integrate prompt

#### Scenario: Existing folder
- **WHEN** `POST /api/projects` names a folder that already exists
- **THEN** the response is `409` and the existing folder is unchanged

#### Scenario: Feature disabled
- **WHEN** agent sessions are disabled and `POST /api/projects` is called
- **THEN** the response is `403`, no folder is created and no process is started

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/projects`
- **THEN** the response is `403`, no folder is created and no process is started
