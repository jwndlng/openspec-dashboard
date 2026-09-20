## ADDED Requirements

### Requirement: Change artifact endpoints

The API SHALL provide two read-only endpoints for the artifacts of one change of one tracked repository:

`GET /api/repos/<repoId>/changes/<changeName>/artifacts` SHALL return `{ change, artifacts }`, where `change` names the repository id, the change name, the schema, the absolute change directory and whether the change is archived, and `artifacts` lists, in the schema's artifact order, `{ id, status, files }` with `files` being the artifact's existing files as paths relative to the change directory, sorted, each with its size in bytes. An artifact with no file SHALL appear with an empty `files` list.

`GET /api/repos/<repoId>/changes/<changeName>/file?path=<relative path>` SHALL return `{ path, bytes, text }` for one file of that change, read as UTF-8.

Both endpoints SHALL resolve `<repoId>` against the repositories that are enabled in the dashboard config, and `<changeName>` against that repository's active and archived change directories; the change directory is always derived on the server and never taken from the request. Archived changes SHALL be readable through the same endpoints.

The responses MUST be: `400` when the change name does not match the permitted character set, or when `path` is missing, absolute, or escapes the change directory after normalisation; `404` for an unknown or disabled repository, an unknown change, or a `path` that is not an existing regular file inside the change directory; `413` when the file is larger than 1 MiB, without returning its content. A path whose resolved target — following symbolic links — lies outside the change directory MUST be refused as if it did not exist.

Both endpoints are `GET` and MUST NOT create, modify or delete anything in a tracked repository, and MUST NOT send CORS headers that let another origin read their responses.

#### Scenario: Artifact list

- **WHEN** `GET /api/repos/<id>/changes/cloud-deployment/artifacts` is called for a `spec-driven` change with a proposal and two delta specs
- **THEN** the response lists `proposal` with `proposal.md`, `specs` with both `specs/**/spec.md` paths sorted, and `design` and `tasks` with empty `files`

#### Scenario: File content

- **WHEN** `GET /api/repos/<id>/changes/cloud-deployment/file?path=proposal.md` is called
- **THEN** the response contains the file's text and its size in bytes

#### Scenario: Archived change

- **WHEN** either endpoint is called for a change that lives under `openspec/changes/archive/`
- **THEN** it answers from that archived directory

#### Scenario: Traversal is refused

- **WHEN** `path` is `../../../../etc/passwd`, `/etc/passwd`, or `specs/../../../secrets.md`
- **THEN** the response is `400` or `404` and no file outside the change directory is read

#### Scenario: Symlink out of the change directory

- **WHEN** the change directory contains a symbolic link pointing outside it and that link is requested as `path`
- **THEN** the response is `404` and the link target is not read

#### Scenario: Unknown repository or change

- **WHEN** either endpoint is called with a repository id that is not enabled in the config, or with a change name that repository does not have
- **THEN** the response is `404`

#### Scenario: Invalid change name

- **WHEN** either endpoint is called with a change name containing a path separator or other characters outside the permitted set
- **THEN** the response is `400` and no directory is read

#### Scenario: Oversize file

- **WHEN** the requested file is larger than 1 MiB
- **THEN** the response is `413` with a message and without the file's content

#### Scenario: Reading changes nothing

- **WHEN** both endpoints are called for every change of every tracked repository
- **THEN** no file under any tracked repository is created, modified or deleted
