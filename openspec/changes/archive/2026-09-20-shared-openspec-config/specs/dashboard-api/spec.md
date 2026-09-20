## MODIFIED Requirements

### Requirement: The dashboard never writes to tracked repositories
The dashboard MUST NOT write to a tracked repository except in response to an explicit user action, and then only to the paths enumerated here: `openspec/config.yaml`, where only the managed sections of the `context` and `rules` keys are modified (applying shared OpenSpec config profiles). It MUST NOT delete or move anything in a tracked repository. All other filesystem writes MUST be confined to `~/.openspec-dashboard/`. Scanning, polling, discovery, previews and saving any dashboard setting MUST NOT write to a tracked repository. Git MUST only be invoked with read-only subcommands (`rev-parse`, `log`, `worktree list`, `status`). Because `git status` refreshes the index by default, every git invocation MUST run with optional locks disabled (`GIT_OPTIONAL_LOCKS=0`) so that not even `.git/index` is rewritten.

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

## ADDED Requirements

### Requirement: Shared config endpoints
`GET /api/shared-config` SHALL return the stored profiles as `{ profiles: [...] }`, with an empty list when none has been saved. `PUT /api/shared-config` SHALL validate and persist them and return what was saved; invalid bodies MUST return `400` with a message and leave the stored profiles unchanged. `POST /api/shared-config/preview` with `{ "assignments": [{ "repoId", "profileIds": [...] }] }` SHALL return, per repository id, the profiles it carries now, the current file text, the text that apply would write, and a refusal reason when apply would refuse it, without writing anything. `POST /api/shared-config/apply` with the same body SHALL apply to each repository independently, where `profileIds` is the complete set of profiles that repository is to carry, return per repository `written`, `unchanged` or `refused` with a reason, and trigger a scan.

#### Scenario: Nothing saved yet
- **WHEN** `GET /api/shared-config` is called on a fresh install
- **THEN** the response is `{ profiles: [] }`

#### Scenario: Malformed assignments
- **WHEN** preview or apply is called without an `assignments` list of `{ repoId, profileIds }`
- **THEN** the response is `400` and nothing is written

#### Scenario: Partial success
- **WHEN** apply is requested for one healthy repository and one whose config is invalid YAML
- **THEN** the response is `200` with `written` for the first and `refused` with a reason for the second

### Requirement: Mutating requests are protected against cross-site requests
Every API request with a method other than `GET` SHALL be rejected with `403` unless its `Content-Type` is `application/json` and, when an `Origin` header is present, the origin is the dashboard's own (`http://127.0.0.1:<port>` or `http://localhost:<port>`). A request whose `Sec-Fetch-Site` header is `cross-site` SHALL be rejected. The server MUST NOT send CORS headers that would approve another origin. Rejected requests MUST have no side effects.

#### Scenario: Request from another web page
- **WHEN** a page on `https://example.com` sends `POST /api/shared-config/apply` to the dashboard
- **THEN** the response is `403` and no file is written

#### Scenario: Form post
- **WHEN** a `POST` arrives with `Content-Type: application/x-www-form-urlencoded`
- **THEN** the response is `403`

#### Scenario: The dashboard's own UI
- **WHEN** the UI served from `http://127.0.0.1:4711` sends `PUT /api/config` with a JSON body
- **THEN** the request is processed as before

#### Scenario: Command-line client
- **WHEN** `curl -X POST -H 'content-type: application/json'` calls `/api/scan` without an `Origin` header
- **THEN** the request is processed
