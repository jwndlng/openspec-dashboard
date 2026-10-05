# Spec Delta

## MODIFIED Requirements

### Requirement: An integration session runs in place, in the main checkout

An integration session SHALL run **in place**: the agent's working directory is the repository folder itself, no
worktree is created, no branch is made, and the dashboard SHALL run no git command for the session. It is one of the
two kinds of session that run in a git repository's main checkout. The other is the project console of the
`project-console` capability. Integration runs there because the point of the action is to set up the repository the
user works in: scaffolding created on a branch in a worktree would leave no marker in the checkout, so the repository
would stay integratable and nothing would be visible until someone merged that branch.

Once the folder is a tracked repository, its integration sessions, running or ended, SHALL be shown as that project's
console, as the `project-console` capability specifies. This SHALL NOT make an integration session change work: it
stays out of Open work, cards, the activity log, work status, Ship, pull and worktree clean-up.

The decision to run in place SHALL follow from the discovery result — a git repository, not tracked, without the marker
— and never from attempting a git command and reacting to its failure. The session SHALL be recorded as in place and
MUST NOT carry a branch. Its panel SHALL name the folder the agent runs in and SHALL state plainly that the agent edits
that folder directly, with no branch, no commit and no undo.

#### Scenario: No worktree and no branch
- **WHEN** an integration session is started for a git repository
- **THEN** the agent's working directory is the repository folder, no worktree is created, no branch is made and no git command is run for the session

#### Scenario: The main checkout is left alone by the dashboard
- **WHEN** an integration session starts
- **THEN** the repository's branch, index and working tree are exactly as they were; whatever changes afterwards is what the agent did with the user's approval

#### Scenario: The panel states the risk
- **WHEN** the panel of an integration session is open
- **THEN** it names the repository folder, shows no branch, and states that the agent edits that folder directly with no branch, no commit and no undo

#### Scenario: The setup session stays reachable after tracking
- **WHEN** an integration session for `/w/acme/gamma-tools` is running, the user closed its overlay, and discovery adds `gamma-tools` to the configuration
- **THEN** that session is shown when the user opens `gamma-tools`'s project console, and it does not appear in Open work
