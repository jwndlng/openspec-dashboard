# Spec Delta

## MODIFIED Requirements

### Requirement: The tour starts on the first visit in a browser
When the dashboard is loaded in a browser that has no record of the tour having been finished or skipped, the tour
SHALL start by itself once the hero and the main navigation are rendered, on whatever route was opened. It SHALL NOT
start while the change detail view, the main console, an integration terminal or the setup wizard is open, nor while
the configuration has `setup: "pending"`; it SHALL then start once none of them is open and setup is no longer pending. It SHALL start at most once per page load by itself. Starting, showing and ending the tour
MUST NOT make any server request, start any process, or write to any repository or to the server configuration.

#### Scenario: First visit
- **WHEN** a user opens the dashboard for the first time in a browser
- **THEN** the tour starts at its first step

#### Scenario: Returning visitor
- **WHEN** a user who finished or skipped the tour reloads the dashboard
- **THEN** the tour does not start

#### Scenario: First visit straight into a change
- **WHEN** a first-time visitor opens a link to a change's detail view
- **THEN** the tour does not start until the detail view is closed

#### Scenario: Tour makes no requests
- **WHEN** the tour is started, stepped through and finished
- **THEN** no API request is made because of it

#### Scenario: Setup comes first
- **WHEN** a first-time visitor opens the dashboard on a fresh installation, so setup is pending
- **THEN** the setup wizard opens and the tour starts only after the wizard was finished or skipped

#### Scenario: Running setup again does not replay the tour
- **WHEN** a user who has seen the tour runs setup again from Help and finishes it
- **THEN** the tour does not start
