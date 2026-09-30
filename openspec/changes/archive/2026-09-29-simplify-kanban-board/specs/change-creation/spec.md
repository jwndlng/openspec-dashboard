## MODIFIED Requirements

### Requirement: Submitting the form creates the change directory
On submit the dashboard SHALL send `POST /api/repos/<id>/changes` with `{ name, prompt? }` and, on success, close the form. The server SHALL create `openspec/changes/<name>/` in the repository, atomically (exclusive create so two concurrent requests cannot both succeed), and SHALL write into it:
- `.openspec.yaml` — a marker with `schema:` taken from the repository's `openspec/config.yaml` (falling back to `spec-driven` when the repository has no `schema` set) and `created:` set to today's date in the server's local time zone. This is the same marker that `openspec new change` writes; the dashboard writes it directly and MUST NOT invoke the `openspec` CLI or any other external command for it.
- `prompt.md` — only when a non-empty prompt was submitted, containing the text as written under a short fixed heading. The heading SHALL be `# Prompt`. `prompt.md` is not a schema artifact and does not affect the change's artifact status.

Once both writes have succeeded, and only then, the dashboard SHALL stage the new directory in the repository's index so that git tracks the change from the moment it exists, as specified in the "Creating a change stages the new directory" requirement.

After a successful create the repository SHALL be rescanned and the new change SHALL appear on the board without a page reload. The response SHALL be `201` with `{ name, staged }`, where `staged` says whether the new directory was staged.

#### Scenario: Create without prompt
- **WHEN** the user submits `add-audit-trail` with no prompt
- **THEN** `openspec/changes/add-audit-trail/` exists with a `.openspec.yaml` and no `prompt.md`, and the change appears in the `Backlog` column after the rescan

#### Scenario: Create with prompt
- **WHEN** the user submits `add-audit-trail` with the prompt "Log every mutation to the audit table"
- **THEN** the change directory contains `.openspec.yaml` and `prompt.md` starting with `# Prompt` followed by the text as written

#### Scenario: Schema from the repository's config
- **WHEN** the repository's `openspec/config.yaml` sets `schema: alpha` and the user submits `add-audit-trail`
- **THEN** the new `.openspec.yaml` sets `schema: alpha`

#### Scenario: Default schema
- **WHEN** the repository's `openspec/config.yaml` has no `schema` key and the user submits `add-audit-trail`
- **THEN** the new `.openspec.yaml` sets `schema: spec-driven`

#### Scenario: Staging is reported
- **WHEN** the user submits `add-audit-trail` into a git repository and the directory is staged
- **THEN** the `201` body reports `staged` as true

### Requirement: The combined board's form asks for the project
The form opened from the combined board SHALL show a project dropdown before the change name. The dropdown SHALL list, by repository name, every eligible repository and no other, in the order the board lists repositories. It SHALL be pre-selected when the choice is unambiguous: when exactly one repository is eligible, or when the board's repository filter selects exactly one eligible repository. Otherwise it SHALL start on an empty "Choose a project" entry, and the form MUST NOT allow submission until a project is chosen, saying so as text next to the dropdown. On submit the form SHALL send `POST /api/repos/<id>/changes` for the chosen repository, exactly as the repository header's form does; everything the server does and refuses is unchanged. A refusal SHALL be shown in the form as it is for the header's form, with the chosen project kept. If the chosen repository stops being eligible while the form is open, the form SHALL clear the choice rather than submit to it.

#### Scenario: Only eligible repositories are offered
- **WHEN** `alpha-infra` and `beta-soc` are eligible and `gamma-web`'s last scan failed
- **THEN** the dropdown offers `alpha-infra` and `beta-soc` and not `gamma-web`

#### Scenario: Nothing pre-selected with several projects
- **WHEN** two repositories are eligible and the repository filter is empty
- **THEN** the dropdown shows "Choose a project", the submit action is disabled, and a message says a project is required

#### Scenario: Pre-selected from the repository filter
- **WHEN** the repository filter selects only `beta-soc` and the user activates "New change"
- **THEN** the dropdown is pre-selected on `beta-soc`

#### Scenario: Pre-selected when only one is eligible
- **WHEN** `alpha-infra` is the only eligible repository
- **THEN** the dropdown is pre-selected on `alpha-infra`

#### Scenario: Create in the chosen project
- **WHEN** the user chooses `beta-soc`, types `add-audit-trail` and submits
- **THEN** `POST /api/repos/<beta-soc id>/changes` is sent with `{ "name": "add-audit-trail" }`, the form closes, and after the rescan the change appears in `beta-soc`'s group of the `Backlog` column without a page reload

#### Scenario: Refusal keeps the choice
- **WHEN** the user submits `add-audit-trail` into `beta-soc` and a change with that name already exists there
- **THEN** the form stays open, shows the message naming the clash, and `beta-soc` is still chosen
