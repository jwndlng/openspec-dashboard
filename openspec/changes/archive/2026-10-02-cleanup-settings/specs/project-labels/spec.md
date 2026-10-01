## MODIFIED Requirements

### Requirement: A tracked repository can carry custom labels

Each repository entry in the dashboard configuration SHALL accept an optional list of custom labels, stored in
`~/.openspec-dashboard/config.json` with that entry and never in the repository. A label SHALL be trimmed, SHALL be 1 to
32 characters long, MUST NOT contain a control character or a comma, and SHALL be unique within its repository
ignoring case. A repository SHALL carry at most 20 custom labels. A configuration that breaks one of these rules SHALL
be refused on save with an error naming the repository and the label, and nothing SHALL be saved. A configuration
without labels SHALL load unchanged, and saving it SHALL NOT add an empty list. Labels SHALL keep the case the user
typed; comparisons between labels SHALL ignore case. Renaming a repository SHALL keep its labels.

#### Scenario: Labels persist with the repository entry
- **WHEN** the user gives `alpha-infra` the labels `client` and `infra` on the projects overview
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

### Requirement: A detected label can be hidden per repository

Each repository entry SHALL accept an optional list of hidden detected labels, stored in the dashboard configuration
under the same rules as custom labels. A detected label whose name is in that list (ignoring case) SHALL NOT be shown
or used for filtering for that repository. The labels dialog of a managed project on the projects overview SHALL list
that repository's detected labels, as last scanned, with a control to hide or show each one, taking effect at once. A
hidden name that is no longer detected SHALL have no effect and SHALL be kept.

#### Scenario: Hiding a wrong guess
- **WHEN** `demo-ops` is detected as `go` and `docker`, and the user hides `docker` in its labels dialog on the overview
- **THEN** `demo-ops` shows only `go` without any Save, and filtering the overview by `docker` does not list it

#### Scenario: Showing it again
- **WHEN** the user shows `docker` again for `demo-ops` in its labels dialog
- **THEN** `demo-ops` shows `docker` and `go`

## REMOVED Requirements

### Requirement: Custom labels are edited in Settings
**Reason**: Settings no longer has a Tracked repositories section; everything about one project is edited on the projects overview.
**Migration**: Use the **Labels** action on the project's row or tile on the projects overview (requirement "Custom labels are edited on the projects overview").

## ADDED Requirements

### Requirement: Custom labels are edited on the projects overview

Each managed project on the projects overview, as a table row and as a tile, SHALL offer a **Labels** action that opens
a dialog for that project. The dialog SHALL show the project's custom labels as removable chips and SHALL offer an input
to add one. Adding a label that is empty, too long, contains a comma or already exists on that repository (ignoring
case) SHALL be refused in place with a message, without a request. While labels are typed, the input SHALL suggest
labels already used on other tracked repositories. Each addition, removal or hide/show toggle SHALL take effect at once,
persisting the configuration without a separate save; while one is being saved the dialog SHALL show that it is
working, and when it fails the dialog SHALL show the reason and the labels SHALL stay as they were. Changing only labels
SHALL NOT trigger a scan. Activating Labels MUST NOT open the repository's board.

#### Scenario: Adding a label
- **WHEN** the user opens the labels dialog of `alpha-infra`, types `client` and confirms
- **THEN** a `client` chip appears in the dialog and on the `alpha-infra` row, and the configuration carries it without any Save

#### Scenario: Suggesting an existing label
- **WHEN** `beta-soc` carries the label `client` and the user types `cl` into the label input of `demo-ops`
- **THEN** `client` is offered as a suggestion

#### Scenario: Removing a label
- **WHEN** the user removes the `infra` chip of `alpha-infra` in its labels dialog
- **THEN** `alpha-infra` no longer carries `infra` and no scan starts

#### Scenario: Duplicate refused in place
- **WHEN** `alpha-infra` carries `client` and the user adds `Client`
- **THEN** the label is not added, no request is made, and the input says it already exists
