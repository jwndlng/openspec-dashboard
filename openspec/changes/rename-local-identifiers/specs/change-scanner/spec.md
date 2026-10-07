## MODIFIED Requirements

### Requirement: Per-repository failure isolation and snapshot caching
A failure in one repository MUST NOT fail the scan; the repository is reported with `ok: false` and an `error`, retaining the changes from its last successful scan. After each scan the full snapshot SHALL be written to `~/.spec-control/cache/snapshot.json`, and on startup the cached snapshot SHALL be served until the first scan completes.

#### Scenario: One repo path was deleted
- **WHEN** an enabled repo's path no longer exists
- **THEN** that repo shows `ok: false` with an error and other repos are scanned normally

#### Scenario: Startup serves cache
- **WHEN** the dashboard starts and a cached snapshot exists
- **THEN** `GET /api/state` returns the cached snapshot immediately, and the fresh one once the first scan finishes
