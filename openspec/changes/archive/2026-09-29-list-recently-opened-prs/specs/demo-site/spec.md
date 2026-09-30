# Spec Delta

## ADDED Requirements

### Requirement: Pull requests are simulated in the demo
The demo's mock API SHALL serve pull requests from synthetic sample data, in memory, without any network access or process: the sample SHALL contain open pull requests (at least one draft, one approved with passing checks, one with failing checks, and one whose review is requested from the visitor's simulated login) and at least one merged within the last 7 days, spread over several sample repositories, and at least one sample repository shown as not on GitHub. Ages SHALL be relative to the time the demo is opened so the sample stays recent. A refresh SHALL complete after a short delay with the same data. Nothing SHALL persist across a reload.

#### Scenario: Pull requests in the demo
- **WHEN** the visitor opens Pull requests in the demo
- **THEN** open and recently merged sample pull requests are listed with their statuses, and no request leaves the page

#### Scenario: Refresh in the demo
- **WHEN** the visitor activates Refresh
- **THEN** the control shows that it is running and then the same list with a new fetch time
