## ADDED Requirements

### Requirement: The form opens as a dialog
The New change form SHALL open as a dialog over the page, like the change detail view: a titled panel on a dimmed backdrop, naming where the change will be created (`<repository>/openspec/changes/<name>/`, or `openspec/changes/<name>/` while no project is chosen), never as a strip across the page. The dialog SHALL close on Escape, on a click on the backdrop, with its close control and with **Cancel**, and none of these SHALL close it while the change is being created. Everything the other requirements of this capability say about the form — its fields, validation, focus, refusal and staging — SHALL be unchanged.

#### Scenario: Opening
- **WHEN** the user activates **New change** on the board of `alpha-infra`
- **THEN** a dialog titled `New change` opens over the dimmed board, naming `alpha-infra/openspec/changes/<name>/`, with the change name field focused

#### Scenario: Escape
- **WHEN** the dialog is open and nothing is being created and the user presses Escape
- **THEN** the dialog closes and nothing has been written

#### Scenario: Creating
- **WHEN** the user submits and the request is still running
- **THEN** Escape and a click on the backdrop leave the dialog open until the request finishes
