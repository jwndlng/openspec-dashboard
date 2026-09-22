# Spec Delta

## MODIFIED Requirements

### Requirement: The repository board offers a "New change" action
The repository board header SHALL offer a "New change" action that opens a form with two fields: a change name and an optional free-text prompt. The combined board SHALL offer a "New change" action as well, opening the same form with a third field, a project dropdown, as specified in the "The combined board's form asks for the project" requirement. Activating either action MUST NOT write anything. A repository is **eligible** for a new change when it is enabled, its last scan succeeded and it has an `openspec/changes/` parent to create into. The repository header SHALL show the action for every eligible repository and SHALL NOT show it for a repository that is not eligible. The combined board SHALL show the action when at least one tracked repository is eligible and SHALL NOT show it when none is.

#### Scenario: Action on the header
- **WHEN** a user opens the board for an enabled, successfully scanned repository
- **THEN** the header shows a "New change" action

#### Scenario: Failed scan
- **WHEN** the repository's last scan failed
- **THEN** the header does not show the "New change" action

#### Scenario: No openspec directory
- **WHEN** the repository has no `openspec/changes/` parent (its `openspec/` directory is missing)
- **THEN** the header does not show the "New change" action

#### Scenario: Action on the combined board
- **WHEN** a user opens the combined board and at least one tracked repository is eligible
- **THEN** the board shows a "New change" action, and activating it opens the form without writing anything

#### Scenario: No eligible repository
- **WHEN** every tracked repository's last scan failed
- **THEN** the combined board does not show the "New change" action

### Requirement: The form takes the keyboard focus once
When the "New change" form opens, the keyboard focus SHALL move to the first field the user has to fill: the project dropdown when the form has one and no project is pre-selected, otherwise the change name field. From then on, for as long as that form stays open, the form MUST NOT move the keyboard focus: choosing a project, typing in either text field, the change name's live validation, a failed submission and any re-render of the board around the open form — a background poll, for example — SHALL leave the focus, the selection and the caret exactly where the user put them. Closing the form and opening it again SHALL apply the same rule again.

#### Scenario: Focus on open
- **WHEN** the user activates the "New change" action on a repository header
- **THEN** the keyboard focus is in the change name field, so the name can be typed without clicking

#### Scenario: Focus on open with a project to choose
- **WHEN** the user activates the "New change" action on the combined board and no project is pre-selected
- **THEN** the keyboard focus is on the project dropdown

#### Scenario: Focus on open with a pre-selected project
- **WHEN** the user activates the "New change" action on the combined board and a project is pre-selected
- **THEN** the keyboard focus is in the change name field

#### Scenario: Choosing a project keeps the focus
- **WHEN** the focus is on the project dropdown and the user chooses `alpha-infra`
- **THEN** the focus stays on the project dropdown

#### Scenario: Typing in the prompt field
- **WHEN** the user clicks into the prompt field and types "Log every mutation"
- **THEN** every character reaches the prompt field and the focus stays there

#### Scenario: The board refreshes while the form is open
- **WHEN** the board re-renders while the form is open and the focus is in the prompt field
- **THEN** the focus is still in the prompt field and the caret has not moved

#### Scenario: Reopening the form
- **WHEN** the user closes the form and activates the same "New change" action again
- **THEN** the keyboard focus is again on the first field the user has to fill

## ADDED Requirements

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
- **THEN** `POST /api/repos/<beta-soc id>/changes` is sent with `{ "name": "add-audit-trail" }`, the form closes, and after the rescan the change appears in `beta-soc`'s group of the `New` column without a page reload

#### Scenario: Refusal keeps the choice
- **WHEN** the user submits `add-audit-trail` into `beta-soc` and a change with that name already exists there
- **THEN** the form stays open, shows the message naming the clash, and `beta-soc` is still chosen
