# Spec Delta

## MODIFIED Requirements

### Requirement: Which checks are needed follows the configuration
Whether a check matters SHALL be derived from the current configuration and the last scan, never hardcoded:
- While agent sessions are disabled, the per-agent checks, the `git-identity` check and the `github-cli` check SHALL be
  `not-needed`, and SHALL say which setting makes them so.
- While agent sessions are enabled, a missing executable SHALL be `problem` for the default agent, for the agent the main
  console runs and for any agent selected by an enabled repository, and `warning` for a configured agent that none of
  them uses. A missing
  committer identity or missing GitHub credentials SHALL be `warning`, because only an agent's own commit or pull
  request needs them.
- A missing `git` SHALL be `problem` when at least one enabled repository was scanned as a git repository, and
  `warning` otherwise, because a tracked folder without git is supported.
- A missing `openspec` CLI SHALL be `warning`.
- A `dashboard-home` failure SHALL be `problem`.

#### Scenario: Agent sessions off
- **WHEN** agent sessions are disabled and neither an agent executable nor `gh` is installed
- **THEN** the per-agent checks, `git-identity` and `github-cli` are `not-needed` and say that agent sessions are off, and the overall status is not `problem` because of them

#### Scenario: The default agent is missing
- **WHEN** agent sessions are enabled and the default agent's executable is not found
- **THEN** its check is `problem`

#### Scenario: An unused agent is missing
- **WHEN** agent sessions are enabled, a second agent profile is configured that neither the main console nor any enabled repository selects, and its executable is not found
- **THEN** its check is `warning`, not `problem`

#### Scenario: The console agent is missing
- **WHEN** agent sessions are enabled, the main console uses a second agent profile that no enabled repository selects, and its executable is not found
- **THEN** its check is `problem`

#### Scenario: Only folders without git are tracked
- **WHEN** `git` is not installed and every enabled repository was scanned as a folder without git
- **THEN** the `git` check is `warning`

#### Scenario: A git repository is tracked
- **WHEN** `git` is not installed and an enabled repository was scanned as a git repository
- **THEN** the `git` check is `problem`
