# Spec Delta

## ADDED Requirements

### Requirement: Fast-forward warning endpoint
`POST /api/agent-sessions/fast-forward-warning` with `{ show }` SHALL set `agentSessions.confirmFastForward` to the
boolean `show`, persist the configuration atomically and return the saved config, under the same validation as
`PUT /api/config` and applied one at a time with every other configuration write against the configuration as the
previous write left it. A body whose `show` is missing or not a boolean MUST be refused with `400` and leave the
configuration unchanged. The endpoint does not change the set of enabled repositories, so it SHALL NOT trigger a scan.
It is a mutating request under the same-origin protection, and it reads or writes nothing inside a repository.
`POST /api/sessions` and the prompt endpoint SHALL accept the action `fastForward` under the availability rules of the
agent-sessions capability; the confirmation is the UI's and the API SHALL NOT require it.

#### Scenario: Switching the warning off
- **WHEN** `POST /api/agent-sessions/fast-forward-warning` is sent with `{ "show": false }`
- **THEN** the saved config's `agentSessions.confirmFastForward` is `false`, every other setting is unchanged and no scan was triggered

#### Scenario: Invalid body
- **WHEN** `POST /api/agent-sessions/fast-forward-warning` is sent with `{ "show": "no" }`
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/agent-sessions/fast-forward-warning`
- **THEN** the response is `403` and the config is unchanged
