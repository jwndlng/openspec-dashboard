## ADDED Requirements

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
`POST /api/discover` SHALL run discovery over the configured scan roots and return `{ repos: [...], errors: [...] }` where `repos` is the merged list of known and newly found repositories (new ones `enabled: false`), without persisting until the client saves via `PUT /api/config`.

#### Scenario: Discover without saving
- **WHEN** `POST /api/discover` finds two new repos and the client never calls `PUT /api/config`
- **THEN** `GET /api/config` does not include the two repos

### Requirement: Scan endpoint
`POST /api/scan` SHALL trigger an immediate scan and return `{ started: true }`, or `{ started: false }` if a scan is already in flight.

#### Scenario: Trigger
- **WHEN** no scan is running and `POST /api/scan` is called
- **THEN** the response is `{ started: true }` and a new snapshot is available afterwards

### Requirement: The dashboard never writes to tracked repositories
All filesystem writes MUST be confined to `~/.openspec-dashboard/`. Git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`).

#### Scenario: No side effects
- **WHEN** a full scan runs across all tracked repos
- **THEN** no file under any tracked repository is created, modified or deleted
