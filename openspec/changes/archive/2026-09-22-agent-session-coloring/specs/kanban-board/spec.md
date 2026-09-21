# Spec Delta

## MODIFIED Requirements

### Requirement: Each repository has its own stable colour
The board SHALL assign every repository in the snapshot a colour derived deterministically from its repository id, without any configuration. The assignment SHALL be computed over all repositories in the snapshot, independent of the active filters, so that the same set of tracked repositories always yields the same colours across reloads, scans and filter changes. Repositories tracked at the same time SHALL receive distinct colours for up to 24 repositories. The repository colour SHALL be shown on the repository's group header, as an accent on each of its cards including the card's repository label, on its repository filter chip, and on each agent session tab in the dock's tab strip — as an accent on the tab and on the repository name it shows. A session tab whose repository is not in the current snapshot SHALL be shown without a repository colour. The repository colour on a tab MUST NOT replace or obscure the marks that say which sessions are shown and which tab is focused; those marks SHALL stay distinguishable from every assignable repository colour. The colour SHALL adapt to the active theme so that repository-coloured text keeps a contrast ratio of at least 4.5:1 against its background in every supported theme, including the background of the dock's tab strip and of a tab whose session is shown. Colour MUST NOT be the only cue: wherever a repository colour is shown, the repository name SHALL be shown with it. The error styling of a repository filter chip SHALL take precedence over its repository colour.

#### Scenario: Distinct colours
- **WHEN** 17 repositories are tracked
- **THEN** no two of them have the same colour

#### Scenario: Stable across reload and rescan
- **WHEN** the page is reloaded or a scan completes and the set of tracked repositories is unchanged
- **THEN** every repository has the same colour as before

#### Scenario: Filters do not change colours
- **WHEN** the user filters the board to repository `vcs-admin` only
- **THEN** `vcs-admin` cards, group headers and filter chip keep the colour they had with no filter applied

#### Scenario: Colour is consistent across the board
- **WHEN** repository `beta-soc` has cards in three columns
- **THEN** its group headers, the accent and repository label on all of its cards, and its filter chip all use the same colour, each alongside the name `beta-soc`

#### Scenario: Session tabs carry the repository colour
- **WHEN** the dock shows tabs for sessions of `beta-soc` and of `alpha-infra`
- **THEN** each tab shows its repository's accent and its repository name in that repository's colour, the same colour that repository's cards and group headers use, and both tabs still show the repository name as text

#### Scenario: Filtering the board does not recolour a tab
- **WHEN** the user filters the board to `alpha-infra` only while a `beta-soc` session is in the tab strip
- **THEN** the `beta-soc` tab keeps the colour it had with no filter applied

#### Scenario: Shown and focused marks survive the tint
- **WHEN** a tinted tab's session has a pane in the dock and its tab is the focused one
- **THEN** the tab still shows the mark that says its session is shown and the marking of the focused tab, both distinguishable from the repository colour

#### Scenario: Session of an untracked repository
- **WHEN** a session's repository is switched off in Settings while its tab is in the strip
- **THEN** that tab is shown without a repository colour and stays readable

#### Scenario: Theme change
- **WHEN** the user switches from the dark to the light theme
- **THEN** each repository keeps the same hue, and repository-coloured text remains legible (contrast ≥ 4.5:1) on the light backgrounds, on the board and in the dock's tab strip

#### Scenario: Repository in error
- **WHEN** a tracked repository failed to scan
- **THEN** its filter chip shows the error styling rather than its repository colour
