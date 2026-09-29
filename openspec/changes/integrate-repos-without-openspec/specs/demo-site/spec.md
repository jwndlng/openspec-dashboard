# Spec Delta

## ADDED Requirements

### Requirement: Integration is listed and simulated in the demo
The demo's Settings SHALL list at least one integratable repository next to its candidates, so that the section, its wording and the **Integrate** action are reachable without a file system. Activating **Integrate** SHALL create a simulated integration session in memory, as the other simulated starters do, and completing it SHALL move that repository into the tracked list with `enabled: true` and show it on the board. The demo MUST NOT start a process, open a network connection or write anywhere for any of this.

#### Scenario: An integratable repository is listed
- **WHEN** the visitor opens Settings in the demo
- **THEN** a repository without OpenSpec is listed under its own heading with an **Integrate** action

#### Scenario: Simulated integration
- **WHEN** the visitor integrates it and the simulated session completes
- **THEN** the repository moves to the tracked list as enabled and its changes appear on the board, with no process started and no network request made

#### Scenario: Integrate with sessions off in the demo
- **WHEN** the visitor switches agent sessions off and opens Settings
- **THEN** the repository is still listed and **Integrate** is disabled with a reason
