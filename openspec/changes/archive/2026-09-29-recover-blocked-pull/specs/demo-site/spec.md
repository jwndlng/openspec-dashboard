# Spec Delta

## MODIFIED Requirements

### Requirement: Pull is simulated in the demo
The demo's mock API SHALL implement the pull operations in memory without any network access or process: a pull SHALL complete after a short delay with a canned outcome derived from the sample — a fast-forward for repositories on their default branch, "fetched only" for repositories whose main checkout is on another branch — and "Pull all" SHALL return one outcome per git repository in the sample. The sample SHALL contain at least one repository whose main checkout is not on its default branch, so that the notice is shown on first load, and at least one repository whose first pull is refused because of change leftovers — one identical and one differing — so that Resolve and pull can be tried; confirming it SHALL answer with a simulated fast-forward naming the replaced files and a made-up location for the copy. Outcomes SHALL NOT persist across a reload.

#### Scenario: Pull in the demo
- **WHEN** the visitor activates Pull for a sample repository on its default branch that is not blocked
- **THEN** the control shows that it is running and then a fast-forward outcome, and no network request is made

#### Scenario: Notice in the demo
- **WHEN** the demo is opened
- **THEN** the sample repository whose main checkout is on a feature branch shows the not-on-default-branch notice, and pulling it reports that it was only fetched

#### Scenario: Blocked pull in the demo
- **WHEN** the visitor pulls the sample repository blocked by change leftovers and confirms Resolve and pull
- **THEN** the outcome first lists the two leftovers and offers the resolution, then reports a fast-forward naming both files and the copy of the differing one, and no network request is made
