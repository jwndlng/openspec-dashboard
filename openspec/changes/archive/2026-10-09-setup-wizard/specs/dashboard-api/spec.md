# Spec Delta

## MODIFIED Requirements

### Requirement: Config endpoints

`GET /api/config` SHALL return the config. `PUT /api/config` SHALL validate the body (absolute paths for `scanRoots`, `ignorePaths` and `repos[].path`, `pollIntervalSeconds >= 10`, unique repo ids, each repo `id` matching its canonical path), canonicalise all paths, persist it atomically, and return the saved config; invalid bodies MUST return `400` with a message and leave the config unchanged. A body without `ignorePaths` SHALL be accepted and saved with `ignorePaths: []`. If the set of enabled repos changed, a scan MUST be triggered. `PUT /api/config` SHALL keep the stored `setup` value whatever the body carries for it, so that a client holding an older copy of the configuration can neither end nor restart setup; only `POST /api/setup/done` clears it, and nothing sets it again.

#### Scenario: Invalid interval
- **WHEN** `PUT /api/config` is called with `pollIntervalSeconds: 1`
- **THEN** the response is `400` and the stored config is unchanged

#### Scenario: Relative ignore path is rejected
- **WHEN** `PUT /api/config` is called with `ignorePaths: ["relative/dir"]`
- **THEN** the response is `400` naming `ignorePaths.0` and the stored config is unchanged

#### Scenario: Paths are stored canonically
- **WHEN** `PUT /api/config` is called with a scan root given as `~/Workspace/alpha/` or through a symlink
- **THEN** the returned and stored config contain the canonical absolute path without a trailing separator

#### Scenario: Duplicate directory is rejected
- **WHEN** `PUT /api/config` is called with two repos whose paths resolve to the same directory
- **THEN** the response is `400` reporting a duplicate repo id

#### Scenario: Saving Settings does not change setup
- **WHEN** the stored config has `setup: "pending"` and `PUT /api/config` is called with a body without `setup`
- **THEN** the saved config still has `setup: "pending"`

#### Scenario: An old copy cannot restart setup
- **WHEN** setup was marked done and a client sends `PUT /api/config` with `setup: "pending"`
- **THEN** the saved config has no `setup` key

## ADDED Requirements

### Requirement: Setup endpoints
`GET /api/setup` SHALL return `{ pending, home, suggestedRoots, platform }`: whether the configuration has
`setup: "pending"`, the user's home directory, the platform the server runs on (`darwin`, `linux` or `win32`, any other
reading as `linux`), which decides the install instructions the wizard shows, and the canonical paths of the folders from a fixed list of common workspace folder names —
`Workspace`, `workspace`, `Projects`, `projects`, `Developer`, `Code`, `code`, `src`, `dev`, `repos`, `git` and `GitHub`
— that exist as directories directly in the home directory, are not a configured scan root and lie neither at nor below
an ignore path, each at most once, in the list's order. It SHALL establish this with one status lookup per name and MUST
NOT list the home directory, descend into any folder, read a file or start a process. `POST /api/setup/done` SHALL
remove `setup` from the configuration, persist it atomically under the same one-write-at-a-time rule as the other
configuration writes, and return the saved configuration; when setup is not pending it SHALL succeed without writing. It
is a mutating request under the same-origin protection and changes nothing else in the configuration.

#### Scenario: Suggestions
- **WHEN** the home directory holds the folders `Workspace` and `Developer` and a file named `code`, and `~/Workspace` is a configured root
- **THEN** `suggestedRoots` is `[<home>/Developer]`

#### Scenario: Case-insensitive file system
- **WHEN** the file system is case-insensitive and the home directory holds `Projects`
- **THEN** `suggestedRoots` lists it once, with its on-disk spelling

#### Scenario: Done
- **WHEN** the config has `setup: "pending"` and `POST /api/setup/done` is sent
- **THEN** the response is the config without `setup`, `GET /api/setup` returns `pending: false`, and scan roots, repositories and agent settings are unchanged

#### Scenario: Done twice
- **WHEN** `POST /api/setup/done` is sent while setup is not pending
- **THEN** the response is `200` and `config.json` is not rewritten

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/setup/done`
- **THEN** the response is `403` and the config is unchanged
