## MODIFIED Requirements

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
`POST /api/discover` SHALL run discovery and return `{ candidates: [...], errors: [...] }`. The request MAY carry a JSON body with `scanRoots` and/or `ignorePaths`; when present they are used instead of the configured values, and each entry MUST be an absolute path after `~` expansion, otherwise the response MUST be `400` with a message. With no body the configured values are used. `candidates` SHALL contain only repositories found under the roots, outside the ignore paths, whose canonical path is not already in the saved config, each with `id`, canonical `path`, default `name` and `enabled: false`, sorted by path, and never the same directory twice. A candidate that shares its normalised `origin` remote with other known repositories SHALL carry `sameRemoteAs`, a list of `{ name, path, tracked }` for those repositories; otherwise the field is absent. `errors` SHALL list per-root problems. The endpoint MUST NOT persist anything and MUST NOT modify the in-memory config.

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

### Requirement: The dashboard never writes to tracked repositories
All filesystem writes MUST be confined to `~/.openspec-dashboard/`. Git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `config --get`).

#### Scenario: No side effects
- **WHEN** a full scan runs across all tracked repos
- **THEN** no file under any tracked repository is created, modified or deleted

#### Scenario: Discovery has no side effects
- **WHEN** discovery looks up the `origin` remote of candidates and configured repositories
- **THEN** no file under any of those repositories, including their git config, is created, modified or deleted
