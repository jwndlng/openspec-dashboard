# Spec Delta

## ADDED Requirements

### Requirement: Checks that are not ok carry instructions for this platform
A check whose status is `warning` or `problem` SHALL carry, besides its one-line remedy, **instructions**: an ordered
list of steps, each a short text and optionally one command to run in a terminal. The instructions SHALL be chosen for
the operating system the server runs on — macOS, Linux and Windows at least — and SHALL name only commands the user runs
themselves; the dashboard MUST NOT run them. For `git`, `openspec-cli` and `github-cli` the instructions SHALL name an
install command for the platform (for `github-cli` with no credentials found, `gh auth login` instead); for
`git-identity`, the `git config --global` commands for whichever of `user.name` and `user.email` is missing. For an agent
check, the instructions SHALL come from the agent's preset when its id is a preset's, and otherwise SHALL say to install
the program named by the profile's command or to change that command in Settings. A check that is `ok` or `not-needed`
SHALL carry no instructions. Wherever the report is shown — Settings' Environment section and the setup wizard — the
instructions SHALL be shown with the check, each command in a form that can be copied with one action. Instructions
MUST NOT contain a credential.

#### Scenario: openspec missing on macOS
- **WHEN** the server runs on macOS and `openspec` is not on the PATH
- **THEN** the `openspec-cli` check carries a step with an install command for the OpenSpec CLI

#### Scenario: gh installed without credentials
- **WHEN** `gh` is on the PATH and no credentials were found
- **THEN** the `github-cli` check's instructions name `gh auth login` and do not name an install command

#### Scenario: Only the name is missing
- **WHEN** `user.email` is configured but `user.name` is not
- **THEN** the `git-identity` instructions name `git config --global user.name` and not `user.email`

#### Scenario: A preset agent is missing
- **WHEN** the Codex profile is configured and `codex` is not found
- **THEN** its check carries the Codex preset's install command

#### Scenario: A custom agent is missing
- **WHEN** a profile with command `my-agent-cli` is configured and not found
- **THEN** its check says to install `my-agent-cli` or change the command in Settings, with no command to copy

#### Scenario: Shown in Settings
- **WHEN** the `git` check is `problem` and the user opens Settings' Environment section
- **THEN** the check shows its instructions with a copy control for the install command

#### Scenario: Nothing for a healthy check
- **WHEN** the `git` check is `ok`
- **THEN** it carries no instructions
