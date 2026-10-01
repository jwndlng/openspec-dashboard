# Spec Delta

## Purpose

Lets the user group tracked repositories with labels — their own custom labels and technology labels the dashboard
detects from the repository's files — see those labels on the projects overview and the repository board, and narrow
the overview to the repositories carrying them.

## ADDED Requirements

### Requirement: A tracked repository can carry custom labels

Each repository entry in the dashboard configuration SHALL accept an optional list of custom labels, stored in
`~/.openspec-dashboard/config.json` with that entry and never in the repository. A label SHALL be trimmed, SHALL be 1 to
32 characters long, MUST NOT contain a control character or a comma, and SHALL be unique within its repository
ignoring case. A repository SHALL carry at most 20 custom labels. A configuration that breaks one of these rules SHALL
be refused on save with an error naming the repository and the label, and nothing SHALL be saved. A configuration
without labels SHALL load unchanged, and saving it SHALL NOT add an empty list. Labels SHALL keep the case the user
typed; comparisons between labels SHALL ignore case. Renaming a repository SHALL keep its labels.

#### Scenario: Labels persist with the repository entry
- **WHEN** the user gives `alpha-infra` the labels `client` and `infra` in Settings and saves
- **THEN** the `alpha-infra` entry in `config.json` carries `["client", "infra"]` and no file in `alpha-infra` changes

#### Scenario: Duplicate label refused
- **WHEN** a save would give `beta-soc` the labels `Infra` and `infra`
- **THEN** the save is refused with an error naming `beta-soc` and `infra`, and the stored configuration is unchanged

#### Scenario: Over-long label refused
- **WHEN** a save would give a repository a 40-character label
- **THEN** the save is refused and the stored configuration is unchanged

#### Scenario: Older configuration
- **WHEN** a configuration written before labels existed is loaded and saved again without edits
- **THEN** no repository entry gains a `labels` or `hiddenLabels` key

### Requirement: Custom labels are edited in Settings

The Tracked repositories section of Settings SHALL show each repository's custom labels as removable chips and SHALL
offer an input to add one. Adding a label that is empty, too long, contains a comma or already exists on that
repository (ignoring case) SHALL be refused in place with a message, without changing the draft. While labels are
typed, the input SHALL suggest labels already used on other tracked repositories. Label edits SHALL be part of the
draft configuration and SHALL be persisted only when the user saves, like every other Settings edit. Changing only
labels SHALL NOT trigger a scan.

#### Scenario: Adding a label
- **WHEN** the user types `client` into the label input of `alpha-infra` and confirms
- **THEN** a `client` chip appears on `alpha-infra` and the unsaved-changes indicator is shown

#### Scenario: Suggesting an existing label
- **WHEN** `beta-soc` carries the label `client` and the user types `cl` into the label input of `demo-ops`
- **THEN** `client` is offered as a suggestion

#### Scenario: Removing a label
- **WHEN** the user removes the `infra` chip of `alpha-infra` and saves
- **THEN** `alpha-infra` no longer carries `infra` and no scan starts

#### Scenario: Duplicate refused in place
- **WHEN** `alpha-infra` carries `client` and the user adds `Client`
- **THEN** the label is not added and the input says it already exists

### Requirement: Technology labels are detected from marker files

During every scan of a repository whose project folder exists, the dashboard SHALL derive detected labels from a
built-in rule table that maps the names of marker files and directories to labels. At least these rules SHALL exist:

| Marker | Label |
|---|---|
| a file ending in `.tf` | `terraform` |
| `go.mod` | `go` |
| `Cargo.toml` | `rust` |
| `package.json` | `javascript` |
| `tsconfig.json` | `typescript` |
| `pyproject.toml`, `requirements.txt`, `setup.py` or `Pipfile` | `python` |
| `Gemfile` | `ruby` |
| `pom.xml`, `build.gradle` or `build.gradle.kts` | `java` |
| a file ending in `.csproj` or `.sln` | `dotnet` |
| `composer.json` | `php` |
| `Package.swift` | `swift` |
| `Dockerfile`, `compose.yaml` or `docker-compose.yml` | `docker` |
| `Chart.yaml` | `helm` |
| `ansible.cfg` | `ansible` |

Detection SHALL look at the names of the entries of the project folder of the main checkout and of its immediate
subdirectories, and nothing deeper. It SHALL skip directories whose name starts with `.` and the directories
`node_modules`, `vendor`, `dist`, `build`, `target` and `openspec`, SHALL read at most 64 subdirectories and at most 500
entries per directory, and SHALL NOT follow symbolic links. Detection MUST NOT open or read any file, MUST NOT run a
git command, MUST NOT write anything and MUST NOT contact a network. Matching SHALL be case-sensitive on file names.
Detected labels SHALL be part of the repository's snapshot, sorted by name and without duplicates, and SHALL change
with the next scan after the repository's files change. A repository whose scan fails SHALL have no detected labels.
A non-git folder SHALL be detected exactly like a git repository.

#### Scenario: Terraform repository
- **WHEN** `alpha-infra` has `main.tf` and `modules/network/` at its top level
- **THEN** its snapshot's detected labels are `["terraform"]`

#### Scenario: Marker in an immediate subdirectory
- **WHEN** `demo-ops` has `infra/main.tf` and `service/go.mod`
- **THEN** its detected labels are `["go", "terraform"]`

#### Scenario: Too deep
- **WHEN** a repository's only `.tf` file is `deploy/env/prod/main.tf`
- **THEN** `terraform` is not detected

#### Scenario: Dependency folders are skipped
- **WHEN** a repository has `package.json` and `node_modules/some-lib/Cargo.toml`
- **THEN** its detected labels are `["javascript"]`

#### Scenario: Detection follows the repository
- **WHEN** a `Dockerfile` is added to `beta-soc` and the next scan runs
- **THEN** `docker` is among `beta-soc`'s detected labels

#### Scenario: Read-only
- **WHEN** a scan detects labels in every fixture repository
- **THEN** every fixture repository is byte-for-byte unchanged and no git process was started for detection

### Requirement: A detected label can be hidden per repository

Each repository entry SHALL accept an optional list of hidden detected labels, stored in the dashboard configuration
under the same rules as custom labels. A detected label whose name is in that list (ignoring case) SHALL NOT be shown
or used for filtering for that repository. Settings SHALL list each tracked repository's detected labels, as last
scanned, with a control to hide or show each one, as a draft edit that is persisted only on save. A hidden name that
is no longer detected SHALL have no effect and SHALL be kept.

#### Scenario: Hiding a wrong guess
- **WHEN** `demo-ops` is detected as `go` and `docker`, and the user hides `docker` in Settings and saves
- **THEN** `demo-ops` shows only `go`, and filtering the overview by `docker` does not list it

#### Scenario: Showing it again
- **WHEN** the user shows `docker` again for `demo-ops` and saves
- **THEN** `demo-ops` shows `docker` and `go`

### Requirement: Labels are shown on the overview and the board header

The labels displayed for a repository SHALL be its custom labels in the order the user gave them, followed by its
detected labels that are not hidden and not equal (ignoring case) to one of its custom labels, sorted by name. They
SHALL be shown on the repository's overview row, on its overview tile and in its repository board header. A detected
label SHALL be distinguishable from a custom label by an icon and by a tooltip naming the marker that produced it, not
by colour alone. When labels do not fit, the row SHALL show as many as fit and a `+<n>` indicator whose tooltip lists
the rest; the tile and the board header SHALL wrap. A repository with no label SHALL show nothing in their place.

#### Scenario: Custom and detected labels together
- **WHEN** `alpha-infra` carries the custom label `client` and is detected as `terraform`
- **THEN** its row, tile and board header show `client` followed by `terraform`, and `terraform` carries the detected
  icon and a tooltip naming `.tf` files

#### Scenario: Custom label shadows a detected one
- **WHEN** `beta-soc` carries the custom label `Go` and is detected as `go`
- **THEN** one label `Go` is shown, as a custom label

#### Scenario: No labels
- **WHEN** a repository has no custom labels and nothing is detected
- **THEN** its row shows no label chips and no `+0` indicator

### Requirement: The overview can be filtered by label

The projects overview SHALL offer a label filter listing every label displayed on at least one listed repository,
ignoring case. Activating a label in the filter, on a row or on a tile SHALL add it to the filter, and activating an
active label SHALL remove it. Activating a label on a row or tile MUST NOT open the repository's board. With several
labels in the filter, only repositories displaying all of them SHALL be listed. The label filter SHALL combine with the
search and the work-in-progress filter, SHALL apply instantly on the client, SHALL be the same in the table and the
tiles layout, and SHALL persist in the URL query string as one `label=<name>` parameter per label, omitted when empty.
A `label` value that matches no displayed label SHALL stay in the filter and list no repository, and the filter SHALL
show it so it can be removed. Sorting SHALL be unaffected by the label filter.

#### Scenario: Filter by one label
- **WHEN** `alpha-infra` and `demo-ops` display `terraform`, `beta-soc` does not, and the user activates `terraform`
- **THEN** only `alpha-infra` and `demo-ops` are listed and the URL contains `label=terraform`

#### Scenario: Several labels combine with AND
- **WHEN** the user opens `/?label=terraform&label=client` and only `alpha-infra` displays both
- **THEN** only `alpha-infra` is listed

#### Scenario: Activating a label on a row
- **WHEN** the user activates the `client` chip on the `alpha-infra` row
- **THEN** `client` is added to the filter and the overview stays open

#### Scenario: Combines with search and layout
- **WHEN** the user opens `/?label=go&q=demo&view=tiles`
- **THEN** the tiles layout lists only repositories whose name contains `demo` and that display `go`

#### Scenario: Unknown label in the URL
- **WHEN** the user opens `/?label=cobol` and no repository displays `cobol`
- **THEN** no repository is listed, the filter shows `cobol` as active, and removing it lists every repository again
