# Spec Delta

## MODIFIED Requirements

### Requirement: An agent is a configurable profile, not a built-in integration
The dashboard SHALL start agents from user-configurable profiles. A profile consists of an id, a display name, a command given as an argument list, an opening prompt per session starter, optional additional instructions per prompt, an optional resume command and an optional list of environment variables to remove. The dashboard MUST NOT depend on any vendor-specific protocol or output format of an agent: any program that runs interactively in a terminal SHALL be usable. One profile is the default; a repository MAY select a different one with its agent picker on the projects overview. Removing a profile in Settings SHALL return every repository that selected it to the default agent. The dashboard SHALL ship **presets** — ready-made profiles — for Claude Code (`claude`), Codex (`codex`) and Antigravity (`agy`). A preset SHALL be an ordinary profile with nothing a user-written profile could not express, and once added it SHALL be edited, made the default or removed like any other profile. Only the Claude Code preset SHALL be configured by default; another preset SHALL become a profile only when the user adds it in Settings, never because its executable was found on this machine. No preset SHALL carry additional instructions for any of its prompts, and no preset's command, resume command or prompt SHALL contain a permission-bypass mode or flag. The dashboard MUST NOT read, store, log or transmit an agent's credentials and MUST NOT offer a login flow; an agent uses its own login and its own settings.

#### Scenario: A second agent
- **WHEN** the user adds a profile with command `my-agent-cli`, `{prompt}` and an Implement prompt, and selects it for repository `demo-ops` on the projects overview
- **THEN** Implement on a `demo-ops` card starts `my-agent-cli` and other repositories keep using the default agent

#### Scenario: Removing a selected profile
- **WHEN** `demo-ops` uses the profile `my-agent` and the user removes `my-agent` in Settings and saves
- **THEN** `demo-ops` uses the default agent and the configuration is saved without an "unknown agent" error

#### Scenario: Agent not installed
- **WHEN** the executable of a repository's agent cannot be found on this machine
- **THEN** that repository's starters are disabled with an explanation, and opening a session is refused with that reason

#### Scenario: API key variables are removed for the preconfigured agent
- **WHEN** the dashboard was started from a shell that exports `ANTHROPIC_API_KEY` and a Claude Code session is opened with the default profile
- **THEN** the agent's environment does not contain `ANTHROPIC_API_KEY`, so its own login is used

#### Scenario: An installed agent is not added on its own
- **WHEN** `agy` and `codex` are found on this machine and the configuration has never listed them
- **THEN** the loaded configuration still has the Claude Code profile as its only agent

#### Scenario: Antigravity preset takes its prompt as one argument
- **WHEN** the user has added the Antigravity preset and starts **Implement** on change `cache-api-calls` with it
- **THEN** the agent is started with three arguments, `agy`, `-i` and one prompt that names `cache-api-calls`, and resuming that session starts `agy --continue`

#### Scenario: Codex preset takes its prompt as one argument
- **WHEN** the user has added the Codex preset and starts **Implement** on change `cache-api-calls` with it
- **THEN** the agent is started with two arguments, `codex` and one prompt that names `cache-api-calls`

#### Scenario: Every preset is a valid profile
- **WHEN** a configuration listing every preset unchanged is validated
- **THEN** it is accepted, including the rule against permission-bypass modes and flags

#### Scenario: A saved profile from before additional instructions existed
- **WHEN** a configuration saved without any additional instructions is loaded
- **THEN** every prompt of every profile is composed exactly as it was, and the profile carries no additional instructions
### Requirement: Session starters run a fixed prompt for a validated change
The dashboard SHALL offer the starters **Draft artifacts** (while at least one artifact of the change is not done), **Implement** (change in `Ready` or `Implementing`), **Validate** (change in `Done` with the sub-state `validate`) and **Archive** (change in `Done`, in either sub-state), each only when the repository's agent has an opening prompt configured for it, and none for archived changes. **Implement** SHALL NOT be offered for a change in `Done`: nothing is left to implement there, and offering it is what sends an agent back into finished code. A request to start a starter that is not available for the change's current stage and sub-state SHALL be refused. The opening prompt SHALL be produced from the profile's template, in which `{change}` is the only placeholder, replaced by the change name after it passed change-name validation. The agent MUST be started without a shell from an argument list; the prompt MUST reach it either as exactly one argument (where the command contains `{prompt}`) or by being submitted to its terminal after start-up under the rules for text sent on the user's behalf (where it does not). No text from the browser other than the validated change name may become part of the command line.

Every preset's prompts SHALL carry the meaning of the `- [~]` task marker, which OpenSpec itself does not define: the **Implement** prompt SHALL instruct the agent to leave a task only a person can verify as `- [~]` rather than ticking it; the **Validate** prompt SHALL instruct the agent to take the change's `- [~]` tasks one at a time, say what to check, and tick off only those the user confirms, leaving the rest; and the **Archive** prompt SHALL instruct the agent to sync the change's delta specs into the main specs and then archive the change, without asking whether to sync, to archive right away when nothing is left to sync, and to tick off the tasks left for the user to validate once the user has confirmed them. Each preset's prompts SHALL invoke the OpenSpec workflow in the form that `openspec init --tools <tool>` installs for that agent — Claude Code's `/opsx:<workflow>` commands, Antigravity's `/opsx-<workflow>` workflows, and, for Codex, which gets skills and no commands, a plain-language instruction that names the OpenSpec skill and `{change}`. Each SHALL remain an ordinary prompt template the user can edit or remove, and each SHALL be a single line, so that it can be typed into a terminal.

A saved configuration in which a profile whose id is a preset's id still carries one of that preset's former prompts for a starter verbatim SHALL be read as carrying that preset's current prompt for that starter; any other prompt, a removed one, and every prompt of a profile whose id is no preset's SHALL be left as saved. This SHALL apply per preset and per starter, so upgrading one prompt never rewrites another and one preset's former prompts never upgrade another preset's profile.

Syncing, archiving and ticking off a validated task are done by the agent in the session's working directory; the dashboard itself MUST NOT write specs, move a change or change a checkbox in `tasks.md`.

A starter that does not result in a session MUST NOT fail silently. When starting is refused or fails, the dashboard SHALL show the reason to the user in the place the starter was activated from, without requiring a session panel to be open — a session that could not be created has no panel to report itself in. The message SHALL be the reason the request was refused with. It SHALL be cleared once a later start from the same place succeeds.

#### Scenario: Implement on a ready change
- **WHEN** the user starts **Implement** on change `cache-api-calls` with the preconfigured profile
- **THEN** the agent is started with two arguments, `claude` and one prompt that begins with `/opsx:apply cache-api-calls` and tells it to leave a task only the user can verify as `- [~]` instead of ticking it

#### Scenario: Validate on a change awaiting validation
- **WHEN** change `cache-api-calls` is in `Done` with `tasks.awaiting` `2` and the repository's agent has a Validate prompt
- **THEN** the **Validate** starter is offered for it, and starting it opens a session whose prompt names the change and asks the agent to walk the user through its `- [~]` tasks

#### Scenario: Implement is not offered next to Validate
- **WHEN** a change is in `Done` with the sub-state `validate`
- **THEN** its starters are **Validate** and **Archive**, and **Implement** is not among them

#### Scenario: Validate is refused while tasks are open
- **WHEN** a Validate session is requested for a change in `Implementing`
- **THEN** the request is refused, no worktree is created and no process is started

#### Scenario: Archive on a change awaiting validation
- **WHEN** change `cache-api-calls` is in `Done` with `tasks.awaiting` `2` and the repository's agent has an Archive prompt
- **THEN** the **Archive** starter is offered for it, and starting it opens an archive session

#### Scenario: Preconfigured Archive prompt syncs without asking
- **WHEN** the user starts **Archive** on change `cache-api-calls` with the preconfigured profile
- **THEN** the agent is started with two arguments, `claude` and one prompt that begins with `/opsx:archive cache-api-calls`, tells it to sync the delta specs before archiving without asking, and tells it to tick off the tasks left for the user to validate once the user has confirmed them

#### Scenario: Agent without a Validate prompt
- **WHEN** a repository's agent has no Validate prompt and a change is in `Done` with the sub-state `validate`
- **THEN** no Validate starter is offered for it, and **Archive** still is

#### Scenario: Former preconfigured Archive prompt is upgraded
- **WHEN** a saved configuration's `claude` profile has the Archive prompt `/opsx:archive {change}`
- **THEN** the loaded configuration carries the current preconfigured Archive prompt for that profile

#### Scenario: Edited Archive prompt is kept
- **WHEN** a saved configuration's `claude` profile has the Archive prompt `/opsx:archive {change} and ask me before syncing`
- **THEN** the loaded configuration carries exactly that prompt

#### Scenario: Shell metacharacters are inert
- **WHEN** a profile's prompt template produces text containing quotes, `;` or `$(…)`
- **THEN** the agent receives that text as one argument and no shell interprets it

#### Scenario: Invalid change name
- **WHEN** a session is requested for a change name containing characters outside the allowed set
- **THEN** the request is refused, no worktree is created and no process is started

#### Scenario: A refused start is reported on the card
- **WHEN** the user activates a starter and the request is refused, so that no session is created
- **THEN** the card that starter belongs to shows the reason, and no session panel is required for it to be visible

#### Scenario: Former preconfigured prompts upgrade per starter
- **WHEN** a saved configuration's `claude` profile has a former preconfigured Archive prompt verbatim and an edited Implement prompt
- **THEN** the loaded configuration carries the current preconfigured Archive prompt and exactly the edited Implement prompt

#### Scenario: Antigravity preset uses its installed workflows
- **WHEN** the user starts **Archive** on change `cache-api-calls` with the Antigravity preset
- **THEN** the prompt begins with `/opsx-archive cache-api-calls`, tells the agent to sync the delta specs before archiving without asking, and tells it to tick off the tasks left for the user to validate once the user has confirmed them

#### Scenario: Codex preset names the skill in plain language
- **WHEN** the user starts **Implement** on change `cache-api-calls` with the Codex preset
- **THEN** the prompt contains no slash command, names the OpenSpec apply skill and `cache-api-calls`, and tells the agent to leave a task only the user can verify as `- [~]` instead of ticking it

#### Scenario: Former prompts do not cross presets
- **WHEN** a saved configuration's `agy` profile carries, verbatim, a former prompt of the Claude Code preset that was never one of the Antigravity preset's
- **THEN** the loaded configuration carries exactly that prompt for the `agy` profile

#### Scenario: Agent without a prompt for a starter
- **WHEN** a repository's agent has no Archive prompt and a change is in `Done`
- **THEN** no Archive starter is offered for it

#### Scenario: Command without a prompt placeholder
- **WHEN** an agent's command does not contain `{prompt}` and the agent shows its text prompt after start-up
- **THEN** the agent is started as given and the opening prompt is typed into its terminal and submitted with a separate Enter once the agent shows it

#### Scenario: Agent starts with a dialog instead of a prompt
- **WHEN** an agent whose opening prompt is typed shows a first-run dialog with a highlighted option after start-up
- **THEN** no Enter is pressed and the dialog is left for the user to answer in the terminal

#### Scenario: Archive on a synced change
- **WHEN** change `cache-api-calls` is in `Done` with its delta specs already synced and the repository's agent has an Archive prompt
- **THEN** the Archive starter is offered for it, and starting it opens an archive session

#### Scenario: Archive is refused before every task is done
- **WHEN** an Archive session is requested for a change in `Implementing`
- **THEN** the request is refused, no worktree is created and no process is started

#### Scenario: The reason goes away on the next successful start
- **WHEN** a starter was refused, its reason is shown, and a later start from the same card succeeds
- **THEN** the reason is no longer shown

