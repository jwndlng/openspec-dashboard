# dashboard-api Specification

## Purpose
Defines the single-binary loopback server and its JSON API (state, config, discover, scan), and the guarantee that the dashboard never writes to tracked repositories.
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
All filesystem writes MUST be confined to `~/.openspec-dashboard/`. Git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`). Because `git status` refreshes the index by default, every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`) so that not even `.git/index` is rewritten.

#### Scenario: No side effects
- **WHEN** a full scan runs across all tracked repos
- **THEN** no file under any tracked repository is created, modified or deleted

#### Scenario: Status does not refresh the index
- **WHEN** a scan runs `git status` in a repository whose index has stale stat information
- **THEN** the repository's `.git/index` file is byte-for-byte unchanged afterwards

