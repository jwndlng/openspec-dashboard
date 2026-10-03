# Spec Delta

## ADDED Requirements

### Requirement: Labels are shown in a label colour

Every displayed label — custom or detected — SHALL be painted in a label colour wherever it is shown: on the overview
row and tile, in the repository board header, in the overview's label filter and in the labels dialog. A label's colour
SHALL be decided by its name ignoring case, so a label has the same colour on every repository and in every view. When
the user has chosen a colour for the label, that colour SHALL be used; otherwise the colour SHALL be derived
deterministically from the label's name, without configuration, and SHALL stay the same across reloads, scans, filter
changes and machines.

Every hue a label can be shown in, derived or chosen, SHALL be one of the hues assignable to repository colours
(kanban-board: "Each repository has its own stable colour"), so it keeps at least 12° from every status role hue and from the
brand accent. The theme SHALL supply the colour's lightness and chroma, so that a label's text keeps a contrast ratio
of at least 4.5:1 against its chip, laid over the row, tile, board header, filter bar and dialog backgrounds, in both
themes.

Colour MUST NOT be the only cue. A label SHALL always show its text; a detected label SHALL keep its icon and its
tooltip naming the marker; and a label that is active in the overview's label filter SHALL show a check mark and the
brand-coloured border in addition to its own colour, so that active and inactive chips of the same label differ by more
than colour.

#### Scenario: Same label, same colour
- **WHEN** `alpha-infra` and `beta-soc` both carry the custom label `client`, and `demo-ops` carries `Client`
- **THEN** the `client` chips on all three rows, their tiles and the label filter are painted in one colour

#### Scenario: Derived colour is stable
- **WHEN** nobody chose a colour for `terraform` and the dashboard is reloaded, rescanned or opened on another machine
- **THEN** `terraform` is shown in the same colour each time

#### Scenario: A label never looks like a status
- **WHEN** any label is shown in either theme
- **THEN** its hue is at least 12° from the `info`, `branch`, `success`, `warning` and `danger` hues and from the brand
  accent

#### Scenario: Legible in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** every label's text keeps a contrast ratio of at least 4.5:1 against its chip on every background it is shown on

#### Scenario: Active filter chip
- **WHEN** the user activates `terraform` in the label filter
- **THEN** the `terraform` chips show a check mark and the brand border while keeping their label colour, and the other
  chips show neither

### Requirement: The user can choose a label's colour

The labels dialog of a managed project on the projects overview SHALL offer, for each custom label and each detected
label it lists, a control that chooses that label's colour from the assignable hues, plus **Auto**, which returns the
label to its derived colour. A choice SHALL apply to the label's name ignoring case on every repository, SHALL take
effect at once without a separate save, and SHALL persist in `~/.openspec-dashboard/config.json` in a top-level
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
