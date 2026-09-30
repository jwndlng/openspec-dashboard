# Spec Delta

## ADDED Requirements

### Requirement: The environment report is simulated in the demo
The demo's mock API SHALL serve a fixed environment report in which every check is `ok`, or `not-needed` for a check the
demo's configuration switches off, so that the Environment section and its navigation count can be explored while the
hero shows no environment indicator. The demo MUST NOT start a process, look at the visitor's PATH, read any file of
theirs or open a network connection for the report; the report SHALL be part of the synthetic sample data, with paths
that are made up. **Re-check** SHALL return the same fixed report and SHALL behave as in the dashboard from the UI's
point of view. When the visitor switches agent sessions off in the demo's Settings, the checks that the configuration
makes unnecessary SHALL read as `not-needed`, as in the dashboard.

#### Scenario: The section is explorable
- **WHEN** the visitor opens the demo's Settings and goes to the Environment section
- **THEN** every check is listed as `ok` or `not-needed` with a made-up path, the navigation entry shows `0` without emphasis, and the hero shows no environment indicator

#### Scenario: Nothing is inspected
- **WHEN** the demo serves the environment report
- **THEN** no process is started, no file of the visitor's is read and no network connection is opened

#### Scenario: Re-check in the demo
- **WHEN** the visitor presses **Re-check**
- **THEN** the control shows that it is working and the same report is shown again

#### Scenario: Agent sessions off in the demo
- **WHEN** the visitor switches agent sessions off in the demo's Settings and saves
- **THEN** the agent, committer-identity and GitHub CLI checks read as not needed while agent sessions are off
