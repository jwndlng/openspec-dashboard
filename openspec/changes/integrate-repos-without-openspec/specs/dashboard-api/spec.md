# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
