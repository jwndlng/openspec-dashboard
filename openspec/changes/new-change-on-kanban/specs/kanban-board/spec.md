# Spec Delta

## ADDED Requirements

### Requirement: The combined board offers "New change"
The combined board SHALL show a "New change" action at the end of its filter row whenever at least one tracked repository can take a new change, as specified in the `change-creation` capability. Activating it SHALL open the create-change form, with its project dropdown, between the filter row and the columns; the columns, filters and repository groups SHALL keep working while the form is open. The action SHALL be conveyed by its text label, not by an icon alone. The repository board SHALL keep offering its action on its header, not in the filter row.

#### Scenario: Action in the filter row
- **WHEN** the user opens `/board` with two eligible repositories
- **THEN** the filter row ends with a "New change" action

#### Scenario: Form above the columns
- **WHEN** the user activates "New change" on the combined board
- **THEN** the form appears between the filter row and the columns, and the columns are still shown

#### Scenario: Repository board unchanged
- **WHEN** the user opens `/repo/<id>` for an eligible repository
- **THEN** the "New change" action is on the header and the filter row has none
