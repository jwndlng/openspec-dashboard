# Spec Delta

## MODIFIED Requirements

### Requirement: Submitting the form creates the change directory
On submit the dashboard SHALL send `POST /api/repos/<id>/changes` with `{ name, prompt?, dependsOn?, issue? }` and, on success, close the form. The server SHALL create `openspec/changes/<name>/` in the repository, atomically (exclusive create so two concurrent requests cannot both succeed), and SHALL write into it:
- `.openspec.yaml` — a marker with `schema:` taken from the repository's `openspec/config.yaml` (falling back to `spec-driven` when the repository has no `schema` set) and `created:` set to today's date in the server's local time zone. This is the same marker that `openspec new change` writes; the dashboard writes it directly and MUST NOT invoke the `openspec` CLI or any other external command for it.
- `prompt.md` — only when a non-empty prompt was submitted, containing the text as written under a short fixed heading. The heading SHALL be `# Prompt`. `prompt.md` is not a schema artifact and does not affect the change's artifact status.
- `depends-on.yaml` — only when at least one dependency was submitted, holding a `depends_on:` list of the submitted change names in the order given, under a one-line comment saying what the file means. It is the file the change-dependencies capability reads; it is not a schema artifact either.
- `issue.yaml` — only when the request carries the issue the change is imported from (`issue: { number, title }`, sent by the Import from issues dialog of the `issue-import` capability, never by the New change form), recording the repository's GitHub `owner/name` as the server derives it from the repository's `origin` remote — never taken from the request — the issue number and its title, under a one-line comment saying what the file means. It is the file the `issue-import` capability reads; it is not a schema artifact either.

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

#### Scenario: Create from an issue
- **WHEN** the request for `retry-webhooks` carries `issue: { number: 42, title: "Retry webhook delivery" }` and the repository's `origin` is `git@github.com:acme/alpha-infra.git`
- **THEN** the change directory contains `.openspec.yaml`, `prompt.md` and an `issue.yaml` recording `acme/alpha-infra`, `42` and `Retry webhook delivery`, and after the rescan the change reports that source issue

#### Scenario: Create without dependencies writes no file
- **WHEN** the user submits `add-audit-trail` without picking a dependency
- **THEN** the change directory has no `depends-on.yaml` and no `issue.yaml`

### Requirement: Creation is refused with a reason
The server SHALL refuse `POST /api/repos/<id>/changes` without touching the disk when: the name is not a valid change name (`400`); the request carries an `issue` whose `number` is not a positive integer or whose `title` is not a string of at most 256 characters (`400`); the request carries an `issue` and the repository's `origin` remote is not on `github.com` (`409`); a change with that name already exists at `openspec/changes/<name>/`, active or under `openspec/changes/archive/YYYY-MM-DD-<name>/` (`409`); the repository is not an enabled, successfully scanned repository from the config (`409`); or the repository has no `openspec/changes/` parent directory to create into (`409`). The response body SHALL name the reason as text. The refusal MUST leave the repository untouched — no directory, file, git command or `openspec` invocation.

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

#### Scenario: Issue for a repository off GitHub
- **WHEN** the request carries an `issue` and the repository's `origin` is on `gitlab.example.test` or it has no `origin`
- **THEN** the response is `409` with a message saying the repository is not on GitHub, and nothing is written

#### Scenario: Invalid issue
- **WHEN** the request carries `issue: { number: 0 }` or `issue: { number: "42" }`
- **THEN** the response is `400` and nothing is written

#### Scenario: Concurrent creates
- **WHEN** two `POST /api/repos/<id>/changes` requests for the same name arrive at once
- **THEN** exactly one succeeds with `201` and the other returns `409` with a message naming the clash

### Requirement: Creating a change stages the new directory
After `.openspec.yaml` and any `prompt.md`, `depends-on.yaml` and `issue.yaml` have been written, the dashboard SHALL stage the new change directory by invoking git exactly once, as `git add -- openspec/changes/<name>/`, run in the repository the change was created in, with terminal prompting disabled and optional locks disabled. The path passed after `--` SHALL be the directory the dashboard has just created and nothing else, so that files the user had already modified or left untracked elsewhere in the repository are not staged.

That invocation is the only git command creating a change may run and the only write the dashboard makes outside the new directory. Creating a change MUST NOT commit, push, stash, reset, switch a branch, create or delete a ref, contact a remote or run a repository hook, and MUST NOT invoke the `openspec` CLI or any other external command. Reading the `origin` remote to learn the GitHub repository for `issue.yaml` SHALL use only the read-only `git config --get`, and SHALL happen before anything is written.

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

#### Scenario: The source issue is staged with the change
- **WHEN** a change is created from an issue in a git repository
- **THEN** `git status` reports its `.openspec.yaml`, `prompt.md` and `issue.yaml` as added, staged paths, and no git command that writes other than the single `git add` was run
