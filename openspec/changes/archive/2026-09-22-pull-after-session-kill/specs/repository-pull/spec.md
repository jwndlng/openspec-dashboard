# Spec Delta

## MODIFIED Requirements

### Requirement: Pull is offered where repositories are shown, and only runs on request
The repository board header and each git repository's row in the projects overview SHALL offer a Pull action, and the overview SHALL offer "Pull all". The dialog that ends an agent session SHALL offer a pull for that session's repository as part of confirming it, under the rules of the `agent-sessions` capability. While a pull runs the control SHALL show that it is running and SHALL NOT start a second one, nor SHALL a second one be started for the same repository from another of these places. The outcome SHALL be shown next to the control as text — up to date, fast-forwarded with the number of commits, fetched only, refused, or failed — with the reason available, and the view SHALL update from the rescan without a page reload. Using the control in an overview row MUST NOT navigate into the repository. Nothing SHALL pull without the user activating one of these controls.

#### Scenario: From the overview
- **WHEN** the user activates Pull in the row of a repository that is three commits behind
- **THEN** the row shows that it is running, then `+3 commits`, the overview stays where it is, and the repository's data refreshes

#### Scenario: Pull all
- **WHEN** the user activates "Pull all" with five git repositories tracked
- **THEN** each repository's outcome is listed, including any that were only fetched or failed, with their reasons

#### Scenario: Non-git repository
- **WHEN** a tracked repository is not a git repository
- **THEN** no Pull action is offered for it

#### Scenario: From the end-session dialog
- **WHEN** the user confirms the end-session dialog with its pull offer selected
- **THEN** that repository is pulled once, and the outcome is reported both in the dialog and next to the repository's Pull control

#### Scenario: Already running elsewhere
- **WHEN** a pull for a repository is still running and the user confirms an end-session dialog for that repository with the pull offer selected
- **THEN** no second pull is started and the running pull's outcome is the one reported
