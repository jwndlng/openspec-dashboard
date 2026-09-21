# change-creation Specification

## Purpose
Lets users start a new OpenSpec change in a tracked repository from that repository's Kanban board — creating the change directory, its schema marker and an optional free-text prompt — without leaving the dashboard.

## Requirements

### Requirement: The repository board offers a "New change" action
The repository board header SHALL offer a "New change" action that opens a form with two fields: a change name and an optional free-text prompt. Activating the action MUST NOT write anything. The action SHALL be shown on the header of every enabled, successfully scanned repository, and SHALL be absent for a repository whose last scan failed or that has no `openspec/changes/` parent to create into.

#### Scenario: Action on the header
- **WHEN** a user opens the board for an enabled, successfully scanned repository
- **THEN** the header shows a "New change" action

#### Scenario: Failed scan
- **WHEN** the repository's last scan failed
- **THEN** the header does not show the "New change" action

#### Scenario: No openspec directory
- **WHEN** the repository has no `openspec/changes/` parent (its `openspec/` directory is missing)
- **THEN** the header does not show the "New change" action

### Requirement: The form validates the change name live
The form SHALL validate the change name against the same `^[A-Za-z0-9._-]+$` pattern the scanner and CHANGE_NAME validation enforce, refuse an empty or whitespace-only value, and MUST NOT allow submission while the value is invalid. The refusal reason SHALL be presented as text, next to the field.

#### Scenario: Invalid character
- **WHEN** the user types `foo/bar` into the change name field
- **THEN** the submit action is disabled and a message names the allowed characters

#### Scenario: Empty name
- **WHEN** the user clears the change name field
- **THEN** the submit action is disabled and a message says the name is required

#### Scenario: Valid name
- **WHEN** the user types `add-audit-trail`
- **THEN** no error is shown and the submit action is enabled

### Requirement: Submitting the form creates the change directory
On submit the dashboard SHALL send `POST /api/repos/<id>/changes` with `{ name, prompt? }` and, on success, close the form. The server SHALL create `openspec/changes/<name>/` in the repository, atomically (exclusive create so two concurrent requests cannot both succeed), and SHALL write into it:
- `.openspec.yaml` — a marker with `schema:` taken from the repository's `openspec/config.yaml` (falling back to `spec-driven` when the repository has no `schema` set) and `created:` set to today's date in the server's local time zone. This is the same marker that `openspec new change` writes; the dashboard writes it directly and MUST NOT invoke the `openspec` CLI or any other external command.
- `prompt.md` — only when a non-empty prompt was submitted, containing the text as written under a short fixed heading. The heading SHALL be `# Prompt`. `prompt.md` is not a schema artifact and does not affect the change's artifact status.

After a successful create the repository SHALL be rescanned and the new change SHALL appear on the board without a page reload. The response SHALL be `201` with `{ name }`.

#### Scenario: Create without prompt
- **WHEN** the user submits `add-audit-trail` with no prompt
- **THEN** `openspec/changes/add-audit-trail/` exists with a `.openspec.yaml` and no `prompt.md`, and the change appears in the `New` column after the rescan

#### Scenario: Create with prompt
- **WHEN** the user submits `add-audit-trail` with the prompt "Log every mutation to the audit table"
- **THEN** the change directory contains `.openspec.yaml` and `prompt.md` starting with `# Prompt` followed by the text as written

#### Scenario: Schema from the repository's config
- **WHEN** the repository's `openspec/config.yaml` sets `schema: alpha` and the user submits `add-audit-trail`
- **THEN** the new `.openspec.yaml` sets `schema: alpha`

#### Scenario: Default schema
- **WHEN** the repository's `openspec/config.yaml` has no `schema` key and the user submits `add-audit-trail`
- **THEN** the new `.openspec.yaml` sets `schema: spec-driven`

### Requirement: Creation is refused with a reason
The server SHALL refuse `POST /api/repos/<id>/changes` without touching the disk when: the name is not a valid change name (`400`); a change with that name already exists at `openspec/changes/<name>/`, active or under `openspec/changes/archive/YYYY-MM-DD-<name>/` (`409`); the repository is not an enabled, successfully scanned repository from the config (`409`); or the repository has no `openspec/changes/` parent directory to create into (`409`). The response body SHALL name the reason as text. The refusal MUST leave the repository untouched — no directory, file, git command or `openspec` invocation.

#### Scenario: Duplicate active name
- **WHEN** a change `add-audit-trail` already exists in `openspec/changes/`
- **THEN** the response is `409` with a message naming the clash, and no new directory is created

#### Scenario: Duplicate archived name
- **WHEN** an archived change `openspec/changes/archive/2026-08-12-add-audit-trail/` exists
- **THEN** the response is `409` with a message naming the archived clash, and no new directory is created

#### Scenario: Unknown repository
- **WHEN** the id does not match a configured repository
- **THEN** the response is `404` and nothing is written

#### Scenario: Disabled or failed repository
- **WHEN** the repository is disabled in the config, or its last scan failed
- **THEN** the response is `409` and nothing is written

#### Scenario: No openspec directory
- **WHEN** the repository has no `openspec/` directory to create into
- **THEN** the response is `409` and nothing is written

#### Scenario: Concurrent creates
- **WHEN** two `POST /api/repos/<id>/changes` requests for the same name arrive at once
- **THEN** exactly one succeeds with `201` and the other returns `409` with a message naming the clash

### Requirement: The dashboard never executes anything in the repository
Creating a change MUST NOT run any process in the repository, MUST NOT invoke git, and MUST NOT invoke the `openspec` CLI. The only side effects allowed are (a) the new directory and its files as described above, and (b) the subsequent rescan (which is read-only as specified in the change-scanner capability).

#### Scenario: No processes
- **WHEN** any `POST /api/repos/<id>/changes` is handled — accepted or refused
- **THEN** no child process is spawned for the repository (neither git nor the `openspec` CLI is executed)
