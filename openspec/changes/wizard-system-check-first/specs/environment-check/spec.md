# Spec Delta

## ADDED Requirements

### Requirement: The setup view leaves agents out
The environment report SHALL also be available in a **setup view**, used by the setup wizard's System check step before
the user has chosen agents or a workspace. It SHALL contain the same checks as the report, computed
under the same rules, except the per-agent checks, which it SHALL leave out because the wizard's Agents step checks each
agent itself. Because setup is about to use them, it SHALL NOT derive whether a check matters from the current
configuration: a missing `git` SHALL be `problem`, because every agent session's worktree needs it; a missing
committer identity, a missing GitHub CLI or GitHub credentials not found, and a missing `openspec` CLI SHALL be
`warning`; a `dashboard-home` failure SHALL be `problem`. No check in the setup view SHALL be `not-needed`. Its overall
status SHALL be derived from those checks alone. The Settings view of the report is unchanged.

#### Scenario: Fresh installation without gh
- **WHEN** agent sessions are off, no repository is tracked, `git` is found and `gh` is not
- **THEN** the setup view lists `git` as `ok` and `github-cli` as `warning` with its install instructions, while the Settings view lists `github-cli` as `not-needed`

#### Scenario: git missing before anything is tracked
- **WHEN** no repository is tracked and `git` is not found
- **THEN** the setup view lists `git` as `problem`, while the Settings view lists it as `warning`

#### Scenario: No agent checks
- **WHEN** the Claude Code and Codex profiles are configured
- **THEN** the setup view contains no `agent:` check, and the Settings view still contains both
