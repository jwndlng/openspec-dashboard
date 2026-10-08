## MODIFIED Requirements

### Requirement: Single binary serves UI and API on loopback

The dashboard SHALL be built with `bun build --compile` into one executable named `spec-control` that serves the embedded SPA and the JSON API bound to `127.0.0.1` on the configured port (default 4711). Starting the binary SHALL print the URL and open the default browser unless `--no-open` is passed.

#### Scenario: Start
- **WHEN** the user runs `spec-control`
- **THEN** the server listens on `http://127.0.0.1:4711`, prints that URL, and the browser opens it

#### Scenario: Not reachable from the network
- **WHEN** another host on the LAN requests port 4711
- **THEN** the connection is refused

#### Scenario: Existing state carries over
- **WHEN** a user who ran an earlier `openspec-dashboard` binary starts `spec-control`
- **THEN** it uses the same configuration, sessions and worktrees as before, with nothing to migrate
