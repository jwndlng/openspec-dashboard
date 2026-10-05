# Spec Delta

## ADDED Requirements

### Requirement: The form can declare the change's dependencies
When the form targets exactly one repository — the repository header's form, or the combined board's form once a
project is chosen — it SHALL offer an optional **Depends on** field: a multi-select of that repository's active
changes as the latest snapshot reports them, by name, sorted by name, each with its column. Nothing SHALL be selected
when the form opens. Changing the chosen project SHALL clear the selection. When the form targets repositories by label
(several repositories at once), it SHALL NOT offer the field and SHALL send no dependencies. The selected names SHALL be
sent as `dependsOn` in the order the user selected them; with nothing selected the form SHALL send no `dependsOn`.
Selecting dependencies MUST NOT write anything before submit, and MUST NOT change the existing changes in any way: the
new change declares what it waits for, the changes it names are left as they are.

#### Scenario: Picking dependencies
- **WHEN** the user opens **New change** on `alpha-infra`'s board, types `add-billing-ui` and selects `add-billing-schema` and `add-billing-api`
- **THEN** the form sends `{ "name": "add-billing-ui", "dependsOn": ["add-billing-schema", "add-billing-api"] }`

#### Scenario: Only active changes are offered
- **WHEN** `alpha-infra` has the active changes `add-billing-schema` and `add-billing-api` and the archived change `add-audit-log`
- **THEN** the **Depends on** field offers `add-billing-api` and `add-billing-schema`, and not `add-audit-log`

#### Scenario: The project changes
- **WHEN** on the combined board the user chose `alpha-infra`, selected `add-billing-schema`, then chooses `beta-soc`
- **THEN** the selection is empty and the field offers `beta-soc`'s active changes

#### Scenario: Label targeting
- **WHEN** the form targets every repository carrying the label `billing`
- **THEN** the form offers no **Depends on** field and sends no `dependsOn`

#### Scenario: No active changes
- **WHEN** the target repository has no active change
- **THEN** the **Depends on** field says there is nothing to depend on, and the form can still be submitted

## MODIFIED Requirements

### Requirement: Submitting the form creates the change directory
On submit the dashboard SHALL send `POST /api/repos/<id>/changes` with `{ name, prompt?, dependsOn? }` and, on success, close the form. The server SHALL create `openspec/changes/<name>/` in the repository, atomically (exclusive create so two concurrent requests cannot both succeed), and SHALL write into it:
- `.openspec.yaml` — a marker with `schema:` taken from the repository's `openspec/config.yaml` (falling back to `spec-driven` when the repository has no `schema` set) and `created:` set to today's date in the server's local time zone. This is the same marker that `openspec new change` writes; the dashboard writes it directly and MUST NOT invoke the `openspec` CLI or any other external command for it.
- `prompt.md` — only when a non-empty prompt was submitted, containing the text as written under a short fixed heading. The heading SHALL be `# Prompt`. `prompt.md` is not a schema artifact and does not affect the change's artifact status.
- `depends-on.yaml` — only when at least one dependency was submitted, holding a `depends_on:` list of the submitted change names in the order given, under a one-line comment saying what the file means. It is the file the change-dependencies capability reads; it is not a schema artifact either.

Once every one of these writes has succeeded, and only then, the dashboard SHALL stage the new directory in the repository's index so that git tracks the change from the moment it exists, as specified in the "Creating a change stages the new directory" requirement.

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

#### Scenario: Create with dependencies
- **WHEN** the user submits `add-billing-ui` with the dependencies `add-billing-schema` and `add-billing-api`
- **THEN** the change directory contains `.openspec.yaml` and a `depends-on.yaml` whose `depends_on` lists `add-billing-schema` then `add-billing-api`, and after the rescan the change reports both dependencies

#### Scenario: Create without dependencies writes no file
- **WHEN** the user submits `add-audit-trail` without picking a dependency
- **THEN** the change directory has no `depends-on.yaml`

### Requirement: Creating a change stages the new directory
After `.openspec.yaml` and any `prompt.md` and `depends-on.yaml` have been written, the dashboard SHALL stage the new change directory by invoking git exactly once, as `git add -- openspec/changes/<name>/`, run in the repository the change was created in, with terminal prompting disabled and optional locks disabled. The path passed after `--` SHALL be the directory the dashboard has just created and nothing else, so that files the user had already modified or left untracked elsewhere in the repository are not staged.

That invocation is the only git command creating a change may run and the only write the dashboard makes outside the new directory. Creating a change MUST NOT commit, push, stash, reset, switch a branch, create or delete a ref, contact a remote or run a repository hook, and MUST NOT invoke the `openspec` CLI or any other external command.

Staging is best-effort: the change already exists on disk, so if git is unavailable, the repository is not a git repository, its index is locked, git exits non-zero or the invocation times out, the dashboard SHALL leave the change in place and still answer `201`, reporting `staged` as false. Nothing about the change's validity, its column or its appearance on the board depends on whether it was staged. Git MUST NOT be invoked at all for a create that is refused.

#### Scenario: The new change is tracked
- **WHEN** a change `add-audit-trail` is created in a git repository
- **THEN** `git status` reports `openspec/changes/add-audit-trail/.openspec.yaml` as an added, staged path rather than as untracked

#### Scenario: Only the new directory is staged
- **WHEN** a change is created in a repository that already has an unrelated modified file and an unrelated untracked file
- **THEN** those two files are left exactly as they were — neither is staged — and only the new change directory's files are added to the index

#### Scenario: Nothing is committed
- **WHEN** a change is created in a git repository
- **THEN** `HEAD`, the checked-out branch and every ref are unchanged, no commit is created and no remote is contacted

#### Scenario: Not a git repository
- **WHEN** a change is created in a repository that is not a git repository
- **THEN** the response is `201` with `staged` false, the change directory and its files exist, and the change appears on the board

#### Scenario: Staging fails
- **WHEN** the new directory is written but the `git add` fails or times out
- **THEN** the response is still `201`, with `staged` false, and the change directory and its files are left in place

#### Scenario: A refused create runs no git
- **WHEN** `POST /api/repos/<id>/changes` is refused for any reason
- **THEN** no git command is run for that repository and its index is byte-for-byte unchanged

#### Scenario: Dependencies are staged with the change
- **WHEN** a change is created in a git repository with dependencies
- **THEN** `git status` reports its `.openspec.yaml` and `depends-on.yaml` as added, staged paths, and the single `git add` is the only git command run
