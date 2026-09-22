## ADDED Requirements

### Requirement: Pull is simulated in the demo
The demo's mock API SHALL implement the pull operations in memory without any network access or process: a pull SHALL complete after a short delay with a canned outcome derived from the sample — a fast-forward for repositories on their default branch, "fetched only" for repositories whose main checkout is on another branch — and "Pull all" SHALL return one outcome per git repository in the sample. The sample SHALL contain at least one repository whose main checkout is not on its default branch, so that the notice is shown on first load. Outcomes SHALL NOT persist across a reload.

#### Scenario: Pull in the demo
- **WHEN** the visitor activates Pull for a sample repository on its default branch
- **THEN** the control shows that it is running and then a fast-forward outcome, and no network request is made

#### Scenario: Notice in the demo
- **WHEN** the demo is opened
- **THEN** the sample repository whose main checkout is on a feature branch shows the not-on-default-branch notice, and pulling it reports that it was only fetched
