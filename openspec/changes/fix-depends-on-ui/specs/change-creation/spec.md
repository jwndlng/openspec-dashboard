## MODIFIED Requirements

### Requirement: The form can declare the change's dependencies
When the form targets exactly one repository — the repository header's form, or the combined board's form once a
project is chosen — it SHALL offer an optional **Depends on** field: a multi-select of that repository's active
changes as the latest snapshot reports them, by name, sorted by name, each with its column. Each choice SHALL be shown
as one row: its checkbox, then its name, then its column, on one line, the column at the row's end; a name too long for
the row MAY wrap within itself, but the checkbox, the name and the column MUST NOT be stacked under each other.
Activating the name or the column SHALL toggle the choice's checkbox. Nothing SHALL be selected
when the form opens. Changing the chosen project SHALL clear the selection. When the form targets repositories by label
(several repositories at once), it SHALL NOT offer the field and SHALL send no dependencies. The selected names SHALL be
sent as `dependsOn` in the order the user selected them; with nothing selected the form SHALL send no `dependsOn`.
Selecting dependencies MUST NOT write anything before submit, and MUST NOT change the existing changes in any way: the
new change declares what it waits for, the changes it names are left as they are.

#### Scenario: Picking dependencies
- **WHEN** the user opens **New change** on `alpha-infra`'s board, types `add-billing-ui` and selects `add-billing-schema` and `add-billing-api`
- **THEN** the form sends `{ "name": "add-billing-ui", "dependsOn": ["add-billing-schema", "add-billing-api"] }`

#### Scenario: One line per choice
- **WHEN** the **Depends on** field offers `add-billing-api`, in the column `Ready`
- **THEN** its checkbox, the name `add-billing-api` and `Ready` appear on one line, `Ready` at the end of the row, and clicking the name checks the box

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
