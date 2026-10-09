# Spec Delta

## MODIFIED Requirements

### Requirement: Dashboard configuration is persisted in the user's home directory

The dashboard SHALL store its configuration in `~/.spec-control/config.json` containing `scanRoots`, `ignorePaths`, `repos` (each with `id`, `path`, `name`, `enabled`), `pollIntervalSeconds` and `port`, and optionally `setup`, whose only value is `"pending"` and which, when present, means the setup wizard of the `setup-wizard` capability has not been finished or skipped yet. The dashboard MUST create the directory and a default config on first start and MUST write config atomically (temp file + rename). All stored paths (`scanRoots`, `ignorePaths`, `repos[].path`) MUST be canonical: `~` expanded, symlinks resolved and spelled with their on-disk casing; a path that does not exist is stored normalised as given. When loading a config written by an earlier version, the dashboard MUST default a missing `ignorePaths` to an empty list, canonicalise stored paths, recompute repository ids, and merge repositories that resolve to the same directory — keeping the enabled entry, otherwise the first, together with that entry's name — and MUST NOT reset the config because of such entries. A configuration created because none existed, or because the stored one was invalid and was reset to defaults, SHALL carry `setup: "pending"`; a configuration loaded from disk without `setup` SHALL load without it and MUST NOT gain it, and any other value of `setup` SHALL be dropped.

#### Scenario: First start creates default config
- **WHEN** the dashboard starts and `~/.spec-control/config.json` does not exist
- **THEN** it creates the directory and a config with empty `scanRoots`, empty `ignorePaths`, empty `repos`, `pollIntervalSeconds: 60`, `port: 4711` and `setup: "pending"`

#### Scenario: Config survives restart
- **WHEN** a user enables a repo and restarts the dashboard
- **THEN** the repo is still listed as enabled after restart

#### Scenario: Config without ignorePaths loads
- **WHEN** the stored config has no `ignorePaths` key
- **THEN** it loads with `ignorePaths: []` and all other values unchanged

#### Scenario: Legacy duplicate entries are merged
- **WHEN** the stored config contains the same directory twice under different spellings, one disabled and one enabled and renamed to "Beta SOC"
- **THEN** after loading, the config contains that directory once, with its canonical path, `enabled: true` and name "Beta SOC"

#### Scenario: An earlier configuration is not set up again
- **WHEN** the stored config was written by an earlier version and has no `setup` key
- **THEN** it loads without `setup` and is not rewritten to add it

#### Scenario: A reset configuration asks for setup
- **WHEN** the stored config is invalid and is moved aside and reset to defaults
- **THEN** the new config carries `setup: "pending"`
