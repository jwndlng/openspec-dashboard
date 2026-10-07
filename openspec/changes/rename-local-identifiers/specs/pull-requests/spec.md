## MODIFIED Requirements

### Requirement: Fetched lists are cached and are never an input
The last successful list per GitHub repository and its fetch time SHALL be kept in memory and in the dashboard home (`~/.spec-control/`), so that they are shown after a restart without contacting GitHub. The cache SHALL only be displayed: it MUST NOT be an input to scanning, columns, counts of changes, the activity log or any action, and deleting it SHALL lose nothing but the cached lists. Lists of repositories that are no longer enabled SHALL not be shown.

#### Scenario: After a restart
- **WHEN** the dashboard is restarted and the projects overview is opened
- **THEN** the open pull-request counts of the last fetch are shown with no `gh` process started

#### Scenario: Cache deleted
- **WHEN** the cache file is deleted and the dashboard restarted
- **THEN** repositories show that pull requests were not fetched yet, and everything else is unchanged
