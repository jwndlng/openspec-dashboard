## MODIFIED Requirements

### Requirement: A tracked repository can carry custom labels

Each repository entry in the dashboard configuration SHALL accept an optional list of custom labels, stored in
`~/.spec-control/config.json` with that entry and never in the repository. A label SHALL be trimmed, SHALL be 1 to
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

### Requirement: The user can choose a label's colour

The labels dialog of a managed project on the projects overview SHALL offer, for each custom label and each detected
label it lists, a control that chooses that label's colour from the assignable hues, plus **Auto**, which returns the
label to its derived colour. A choice SHALL apply to the label's name ignoring case on every repository, SHALL take
effect at once without a separate save, and SHALL persist in `~/.spec-control/config.json` in a top-level
`labelColors` map from the label's name in lower case to the chosen hue, never in a repository. **Auto** SHALL remove
the label's entry, so the map never holds a derived colour. While a choice is being saved the dialog SHALL show that it
is working; when it fails the dialog SHALL show the reason and the label's colour SHALL stay as it was. Choosing a
colour SHALL NOT trigger a scan.

The configuration SHALL accept `labelColors` only as an optional map whose keys follow the label rules and are in lower
case, whose values are whole numbers from 0 to 359, and which holds at most 200 entries; a configuration that breaks
one of these rules SHALL be refused on save with an error naming the label, and nothing SHALL be saved. A stored hue
that is not one of the assignable hues SHALL be shown as the nearest assignable hue, so retuning the palette never makes
a saved configuration unreadable. A configuration without `labelColors` SHALL load unchanged, and saving it SHALL NOT
add an empty map. An entry for a label no repository displays any longer SHALL have no effect and SHALL be kept.

#### Scenario: Choosing a colour
- **WHEN** the user opens the labels dialog of `alpha-infra` and chooses a colour for `client`
- **THEN** `client` takes that colour on `alpha-infra`, on `beta-soc` and in the label filter without any Save, the
  configuration's `labelColors` carries `client`, no scan starts and no file in any repository changes

#### Scenario: Back to Auto
- **WHEN** the user chooses **Auto** for `client`
- **THEN** `client` returns to its derived colour and `labelColors` no longer has a `client` entry

#### Scenario: Recolouring a detected label
- **WHEN** the user chooses a colour for the detected label `go` in the labels dialog of `demo-ops`
- **THEN** every repository that displays `go` shows it in that colour

#### Scenario: Failed save
- **WHEN** saving a colour choice fails
- **THEN** the dialog shows the reason and the label keeps the colour it had

#### Scenario: Older configuration
- **WHEN** a configuration written before label colours existed is loaded and saved again without edits
- **THEN** it gains no `labelColors` key

#### Scenario: Invalid hue refused
- **WHEN** a save would store the hue `400` for `client`
- **THEN** the save is refused with an error naming `client` and the stored configuration is unchanged
