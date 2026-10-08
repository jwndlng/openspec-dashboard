## ADDED Requirements

### Requirement: Version endpoint
`GET /api/version` SHALL return `{ "name": "spec-control", "version": <version> }`, where `<version>` is exactly what `--version` prints for the same binary. It SHALL be answered while the server is still starting, SHALL read no configuration, start no process, touch no tracked repository and contact no network, and SHALL carry no credential, path or repository name.

#### Scenario: Release binary
- **WHEN** a binary built as `v0.9.0` is running and `GET /api/version` is requested
- **THEN** the response is `200` with `{ "name": "spec-control", "version": "v0.9.0" }`

#### Scenario: During startup
- **WHEN** `GET /api/version` is requested before the scanner and sessions are ready
- **THEN** it is answered with the same body instead of the "starting" response

#### Scenario: No side effects
- **WHEN** `GET /api/version` is requested
- **THEN** no process is started and no file under a tracked repository or under `~/.spec-control/` is written
