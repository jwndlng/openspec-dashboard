## ADDED Requirements

### Requirement: Per-repository settings endpoints
Four mutating endpoints SHALL each change one configured repository in the saved configuration, persist it atomically and return the saved config, under the same validation and canonicalisation as `PUT /api/config`, and applied one at a time with every other configuration write against the configuration as the previous write left it:

- `POST /api/repos/<id>/name` with `{ name }`: SHALL set that repository's name to the trimmed `name`, keeping everything else. A `name` that is not a string, or is empty after trimming, MUST be refused with `400`.
- `POST /api/repos/<id>/agent` with `{ enabled?, agentId? }`: SHALL set that repository's agent-session settings. A boolean `enabled` SHALL switch the repository's agent sessions on or off. A string `agentId` SHALL select that agent profile for the repository, and `agentId: null` SHALL clear the selection so that the default agent is used. A field that is absent SHALL leave that part of the setting unchanged. An `enabled` that is neither absent nor boolean, an `agentId` that is neither absent, `null` nor a string, an `agentId` that names no configured profile, and a body with neither field MUST be refused with `400`.
- `POST /api/repos/<id>/labels` with `{ labels?, hiddenLabels? }`: SHALL replace that repository's custom labels and/or hidden detected labels with the given lists, under the label rules of the `project-labels` capability. An empty list SHALL remove the key, so a configuration never gains an empty list. A field that is absent SHALL leave that list unchanged. A field that is not a list of strings, a list that breaks the label rules, and a body with neither field MUST be refused with `400`.
- `POST /api/repos/<id>/forget` with an empty JSON body: SHALL remove that repository from the configuration. A repository that is enabled MUST be refused with `409`, so that only a repository the user has disabled can be forgotten.

An unknown id MUST be refused with `404` by all four. A refused request MUST leave the configuration unchanged. None of these endpoints changes the set of enabled repositories, so none of them triggers a scan. These endpoints are mutating requests under the same-origin protection, and none of them reads or writes anything inside a repository.

#### Scenario: Renaming
- **WHEN** `POST /api/repos/<id>/name` is sent with `{ "name": "  Beta SOC " }` for a configured repository
- **THEN** the saved config has that repository named `Beta SOC` with its `enabled` and agent settings unchanged

#### Scenario: Empty name
- **WHEN** `POST /api/repos/<id>/name` is sent with `{ "name": "   " }`
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Switching agent sessions off for one repository
- **WHEN** `POST /api/repos/<id>/agent` is sent with `{ "enabled": false }` for a repository with no agent settings
- **THEN** the saved config has agent sessions switched off for that repository, and opening a session for one of its changes is refused

#### Scenario: Selecting and clearing an agent
- **WHEN** `POST /api/repos/<id>/agent` is sent with `{ "agentId": "my-agent" }` and later with `{ "agentId": null }`
- **THEN** after the first the repository uses `my-agent`, and after the second it uses the default agent, with its on/off setting unchanged both times

#### Scenario: Unknown agent
- **WHEN** `POST /api/repos/<id>/agent` is sent with `{ "agentId": "nope" }` and no profile has that id
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Setting labels
- **WHEN** `POST /api/repos/<id>/labels` is sent with `{ "labels": ["client"] }` and later with `{ "labels": [] }`
- **THEN** after the first the repository carries `["client"]` with its hidden labels unchanged, and after the second it has no `labels` key; no scan was triggered

#### Scenario: Invalid labels
- **WHEN** `POST /api/repos/<id>/labels` is sent with `{ "labels": ["Infra", "infra"] }`
- **THEN** the response is `400` naming the label and the config is unchanged

#### Scenario: Forgetting a disabled repository
- **WHEN** `POST /api/repos/<id>/forget` is sent for a repository with `enabled: false`
- **THEN** the saved config no longer contains it and no scan was triggered

#### Scenario: Forgetting an enabled repository
- **WHEN** `POST /api/repos/<id>/forget` is sent for a repository with `enabled: true`
- **THEN** the response is `409` and the config is unchanged

#### Scenario: Unknown repository
- **WHEN** any of the four endpoints names an id that is not in the config
- **THEN** the response is `404` and the config is unchanged

#### Scenario: Concurrent settings
- **WHEN** `POST /api/repos/<a>/name` and `POST /api/repos/<b>/agent` with `{ "enabled": false }` arrive concurrently
- **THEN** the saved config has both changes

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/repos/<id>/forget`
- **THEN** the response is `403` and the config is unchanged
