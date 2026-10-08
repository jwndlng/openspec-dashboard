# Spec Delta

## MODIFIED Requirements

### Requirement: Custom labels are edited on the projects overview

Each managed project on the projects overview, as a table row and as a tile, SHALL offer a **Labels** action in its
project settings dialog (see the `project-overview` capability, "Each managed project carries its own settings on the
overview"). Activating it SHALL replace the settings dialog with a labels dialog for that project. The labels dialog SHALL show the project's custom labels as removable chips and SHALL offer an input
to add one. Adding a label that is empty, too long, contains a comma or already exists on that repository (ignoring
case) SHALL be refused in place with a message, without a request. While labels are typed, the input SHALL suggest
labels already used on other tracked repositories. Each addition, removal or hide/show toggle SHALL take effect at once,
persisting the configuration without a separate save; while one is being saved the dialog SHALL show that it is
working, and when it fails the dialog SHALL show the reason and the labels SHALL stay as they were. Changing only labels
SHALL NOT trigger a scan. Activating Labels MUST NOT open the repository's board. When the labels dialog closes, focus
SHALL return to the settings button of the project's row or tile.

#### Scenario: Adding a label
- **WHEN** the user opens the labels dialog of `alpha-infra`, types `client` and confirms
- **THEN** a `client` chip appears in the dialog and on the `alpha-infra` row, and the configuration carries it without any Save

#### Scenario: Reached from the project settings dialog
- **WHEN** the user opens the settings dialog of `alpha-infra` and activates Labels, then presses Escape
- **THEN** the labels dialog of `alpha-infra` replaces the settings dialog, the board is not opened, and after Escape no
  dialog is open and focus is on the settings button of `alpha-infra`

#### Scenario: Suggesting an existing label
- **WHEN** `beta-soc` carries the label `client` and the user types `cl` into the label input of `demo-ops`
- **THEN** `client` is offered as a suggestion

#### Scenario: Removing a label
- **WHEN** the user removes the `infra` chip of `alpha-infra` in its labels dialog
- **THEN** `alpha-infra` no longer carries `infra` and no scan starts

#### Scenario: Duplicate refused in place
- **WHEN** `alpha-infra` carries `client` and the user adds `Client`
- **THEN** the label is not added, no request is made, and the input says it already exists
