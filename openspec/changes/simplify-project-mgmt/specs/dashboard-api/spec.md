## ADDED Requirements

### Requirement: Tracking endpoints

Three mutating endpoints SHALL each change one thing in the saved configuration, persist it atomically and return the saved config, under the same validation, canonicalisation and scan rules as `PUT /api/config`:

- `POST /api/repos/track` with `{ path }`: when the canonical path is a repository in the configuration, it SHALL be set `enabled: true`, keeping its name. Otherwise the path MUST be one that discovery over the saved roots and ignore paths currently reports as a candidate, and it SHALL be added with `enabled: true` and its default name, disambiguated against the configured names as for any enabled candidate. Any other path, including an integratable repository, a linked worktree, a path below an ignore path or outside the roots, MUST be refused with `404`.
- `POST /api/repos/<id>/enabled` with `{ enabled }`: SHALL set that configured repository's `enabled`, keeping its name. An unknown id MUST be refused with `404`, and an `enabled` that is not a boolean with `400`.
- `POST /api/ignore-paths` with `{ path }`: SHALL add the canonical path to `ignorePaths` unless it is there already. A path that is not absolute after `~` expansion MUST be refused with `400`. Repositories already in the configuration are not changed.

A scan SHALL be triggered whenever the set of enabled repositories changed. A refused request MUST leave the configuration unchanged. Every write to the configuration — these endpoints, `PUT /api/config` and the configuration change of a confirmed integration — SHALL be applied one at a time against the configuration as the previous write left it, so that concurrent requests cannot undo each other. These endpoints are mutating requests under the same-origin protection, and none of them reads or writes anything inside a repository apart from the read-only discovery walk.

#### Scenario: Tracking a candidate
- **WHEN** discovery reports `/abs/workspace/b` as a candidate and `POST /api/repos/track` is sent with `{ "path": "/abs/workspace/b" }`
- **THEN** the response is the config containing `/abs/workspace/b` with `enabled: true` and its default name, and a scan has been triggered

#### Scenario: Re-enabling a configured repository
- **WHEN** the config contains `/abs/workspace/a` named "Alpha" with `enabled: false` and `POST /api/repos/track` names it
- **THEN** it is `enabled: true` with the name "Alpha"

#### Scenario: Tracking something that is not a candidate
- **WHEN** `POST /api/repos/track` names a git repository without `openspec/config.yaml`
- **THEN** the response is `404` and the config is unchanged

#### Scenario: Disabling
- **WHEN** `POST /api/repos/<id>/enabled` is sent with `{ "enabled": false }` for an enabled repository
- **THEN** the repository stays in the config with `enabled: false` and its name, and a scan has been triggered

#### Scenario: Unknown repository
- **WHEN** `POST /api/repos/<id>/enabled` names an id that is not in the config
- **THEN** the response is `404` and the config is unchanged

#### Scenario: Ignoring a path
- **WHEN** `POST /api/ignore-paths` is sent with `{ "path": "~/Workspace/mirror/" }`
- **THEN** the saved `ignorePaths` contains the canonical path once, and sending it again leaves `ignorePaths` unchanged

#### Scenario: Relative ignore path
- **WHEN** `POST /api/ignore-paths` is sent with `{ "path": "mirror" }`
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Two clicks at once
- **WHEN** `POST /api/repos/track` for `/abs/workspace/b` and `POST /api/repos/<id>/enabled` disabling `/abs/workspace/a` arrive concurrently
- **THEN** the saved config has `/abs/workspace/b` enabled and `/abs/workspace/a` disabled

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/repos/track`
- **THEN** the response is `403` and the config is unchanged
