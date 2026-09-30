# Spec Delta

## ADDED Requirements

### Requirement: A conflicting branch is simulated in the demo
The demo's sample SHALL contain at least one session worktree whose work status reports a conflict with its base,
naming a small number of conflicting files, so that the conflict badge and the Resolve conflicts control are visible on
first load without any git command, process or network request. Activating Resolve conflicts in the demo SHALL behave
like the real action from the UI's point of view — the panel reports that the prompt was submitted and the scripted
terminal shows it — for the current page session only, and the sample SHALL be back after a reload.

#### Scenario: A conflict is visible in the demo
- **WHEN** the visitor opens the sample repository's conflicting session
- **THEN** the panel shows the conflict with its base and the named files, says it is as of the last fetch, and offers
  Resolve conflicts, with no network request and no git command

#### Scenario: Resolving in the demo
- **WHEN** the visitor activates Resolve conflicts in the demo
- **THEN** the panel reports the prompt as submitted and no network request is made

#### Scenario: Not persisted
- **WHEN** the visitor reloads the page afterwards
- **THEN** the sample's conflicting worktree is back as it was
