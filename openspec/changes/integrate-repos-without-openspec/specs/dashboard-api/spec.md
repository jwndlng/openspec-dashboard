# Spec Delta

## ADDED Requirements

### Requirement: Integration endpoints
The discovery response SHALL carry the integratable repositories alongside the candidates, each with its canonical path and default name, so no extra request is needed to list them. `POST /api/integrations` SHALL start an integration session for a directory named in the body, re-checking eligibility server-side, and SHALL answer `409` when agent sessions are off, when the chosen agent has no Integrate prompt, when an integration session for that directory is running, or when the directory is not integratable, `400` for a malformed body or a path that is not canonical, and the created session otherwise. It SHALL be subject to the same same-origin guard as every other mutating route. There SHALL be no route that writes to the repository being integrated.

#### Scenario: Discovery carries both lists
- **WHEN** the client requests discovery
- **THEN** the response carries the candidates and the integratable repositories as separate lists

#### Scenario: Starting an integration
- **WHEN** `POST /api/integrations` names an integratable directory and agent sessions are on
- **THEN** it answers with the created integration session

#### Scenario: Not integratable
- **WHEN** `POST /api/integrations` names a directory that already has `openspec/config.yaml`
- **THEN** it answers `409` with that reason and starts nothing

#### Scenario: Sessions off
- **WHEN** `POST /api/integrations` is called while agent sessions are off
- **THEN** it answers `409` and starts nothing

#### Scenario: Cross-site request
- **WHEN** `POST /api/integrations` arrives without the dashboard's own origin
- **THEN** it is refused by the same-origin guard before anything is read from disk
