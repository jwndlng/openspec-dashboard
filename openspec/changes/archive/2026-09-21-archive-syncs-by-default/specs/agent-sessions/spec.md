# Spec Delta

## MODIFIED Requirements

### Requirement: Session starters run a fixed prompt for a validated change
The dashboard SHALL offer the starters **Draft artifacts** (while at least one artifact of the change is not done), **Implement** (change in `Ready` or `Implementing`) and **Archive** (change in `Done` or `Synced`), each only when the repository's agent has an opening prompt configured for it, and none for archived changes. A request to start a starter that is not available for the change's current stage SHALL be refused. The opening prompt SHALL be produced from the profile's template, in which `{change}` is the only placeholder, replaced by the change name after it passed change-name validation. The agent MUST be started without a shell from an argument list; the prompt MUST reach it either as exactly one argument (where the command contains `{prompt}`) or by being typed into its terminal after start-up (where it does not). No text from the browser other than the validated change name may become part of the command line.

The preconfigured profile's Archive prompt SHALL instruct the agent to sync the change's delta specs into the main specs and then archive the change, without asking whether to sync, and to archive right away when nothing is left to sync. It SHALL remain an ordinary prompt template the user can edit or remove. A saved configuration whose preconfigured profile still carries the former preconfigured Archive prompt verbatim (`/opsx:archive {change}`) SHALL be read as carrying the current one; any other Archive prompt, and a removed one, SHALL be left as saved. Syncing and archiving are done by the agent in the session's worktree; the dashboard itself MUST NOT write specs or move a change.

#### Scenario: Implement on a ready change
- **WHEN** the user starts **Implement** on change `cache-api-calls` with the preconfigured profile
- **THEN** the agent is started with the argument list `claude`, `/opsx:apply cache-api-calls`

#### Scenario: Shell metacharacters are inert
- **WHEN** a profile's prompt template produces text containing quotes, `;` or `$(…)`
- **THEN** the agent receives that text as one argument and no shell interprets it

#### Scenario: Agent without a prompt for a starter
- **WHEN** a repository's agent has no Archive prompt and a change is in `Done`
- **THEN** no Archive starter is offered for it

#### Scenario: Command without a prompt placeholder
- **WHEN** an agent's command does not contain `{prompt}`
- **THEN** the agent is started as given and the opening prompt is typed into its terminal, followed by Enter

#### Scenario: Invalid change name
- **WHEN** a session is requested for a change name containing characters outside the allowed set
- **THEN** the request is refused, no worktree is created and no process is started

#### Scenario: Archive on a synced change
- **WHEN** change `cache-api-calls` is in `Synced` and the repository's agent has an Archive prompt
- **THEN** the Archive starter is offered for it, and starting it opens an archive session

#### Scenario: Archive is refused before every task is done
- **WHEN** an Archive session is requested for a change in `Implementing`
- **THEN** the request is refused, no worktree is created and no process is started

#### Scenario: Preconfigured Archive prompt syncs without asking
- **WHEN** the user starts **Archive** on change `cache-api-calls` with the preconfigured profile
- **THEN** the agent is started with two arguments, `claude` and one prompt that begins with `/opsx:archive cache-api-calls` and tells it to sync the delta specs before archiving without asking

#### Scenario: Former preconfigured Archive prompt is upgraded
- **WHEN** a saved configuration's `claude` profile has the Archive prompt `/opsx:archive {change}`
- **THEN** the loaded configuration carries the current preconfigured Archive prompt for that profile

#### Scenario: Edited Archive prompt is kept
- **WHEN** a saved configuration's `claude` profile has the Archive prompt `/opsx:archive {change} and ask me before syncing`
- **THEN** the loaded configuration carries exactly that prompt
