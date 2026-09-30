# Spec Delta

## ADDED Requirements

### Requirement: Integrating a repository is simulated in the demo

The demo's sample SHALL include at least one integratable repository — a fictional git repository without OpenSpec —
listed in Settings below the candidates, under the same heading and with the same **Integrate** and Ignore actions the
dashboard shows. Activating **Integrate** SHALL create an integration session in memory whose terminal plays a short
hand-written, vendor-neutral transcript under the same rules as every demo transcript: labelled as a recording,
continuing on a line of input, and ending as an exited agent. When that transcript ends, the demo SHALL do what the
marker appearing does in the dashboard: the repository becomes a tracked, enabled repository with its default name, it
leaves the integratable list, and it appears on the board with a small sample of changes. The result SHALL NOT persist
across a reload. The demo MUST NOT start a process, open a network connection or write anywhere for any of this.

#### Scenario: The integratable repository is listed
- **WHEN** the visitor opens Settings in the demo
- **THEN** an integratable repository is listed below the candidates, in its own list, with **Integrate** and Ignore

#### Scenario: Integrating in the demo
- **WHEN** the visitor activates **Integrate** for it
- **THEN** a session panel opens whose terminal starts with the line saying it is a demo recording, and the repository is not yet on the board

#### Scenario: The integration finishes
- **WHEN** the integration transcript reaches its end
- **THEN** the session is shown as ended, the repository is listed as a tracked enabled repository, it is gone from the integratable list, and it appears on the board

#### Scenario: Sessions switched off
- **WHEN** the visitor switches agent sessions off in the demo's Settings
- **THEN** the integratable repository is still listed and **Integrate** is inactive with the reason given

#### Scenario: Nothing leaves the page
- **WHEN** the demo's integration is started, played and ended
- **THEN** no process is started and no network request is made

#### Scenario: Not persisted
- **WHEN** the visitor integrates the repository in the demo and reloads the page
- **THEN** the repository is an integratable repository again
