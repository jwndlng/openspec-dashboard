# Spec Delta

## ADDED Requirements

### Requirement: The hero warns about environment problems
When the latest environment report has at least one check whose status is neither `ok` nor `not-needed`, the hero's
status corner SHALL show an environment indicator beside the scan-failure badges: the number of such checks and a short
label, conveyed by text and an icon and not by colour alone, describing in its tooltip or accessible description what is
wrong. The indicator SHALL be a real link to the Environment section of Settings, so it can be opened in a new tab, and
activating it SHALL navigate there without a page reload. When every check is `ok` or `not-needed`, while no report has
been loaded yet, and when the report could not be loaded, the indicator MUST NOT be shown: a failed check of the
environment is not itself something to warn about on the board. The indicator SHALL appear on every view, because the
hero does, and MUST NOT change any count, filter or card.

#### Scenario: A missing tool is visible from the board
- **WHEN** the default agent's executable is not found and the user opens the combined board
- **THEN** the hero's status corner shows an environment indicator with the number of failing checks and a label saying what area is wrong, and its tooltip names the missing agent

#### Scenario: Following the indicator
- **WHEN** the user activates the environment indicator
- **THEN** Settings is shown with the Environment section at the top of the visible area, without a page reload

#### Scenario: A healthy machine shows nothing
- **WHEN** every check in the latest report is `ok` or `not-needed`
- **THEN** the hero's status corner shows no environment indicator

#### Scenario: Nothing is claimed before the report is in
- **WHEN** the dashboard has just loaded and the report has not arrived yet, or the request for it failed
- **THEN** no environment indicator is shown

#### Scenario: The indicator is not a filter
- **WHEN** the environment indicator is shown on the combined board
- **THEN** the columns, counts and cards are exactly what they would be without it
