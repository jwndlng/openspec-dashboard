# Spec Delta

## MODIFIED Requirements

### Requirement: Ship asks the agent to commit, push and open a pull request
For a session whose worktree has status `uncommitted`, `unpushed` or `pushed` the dashboard SHALL offer a Ship action. It uses the agent profile's Ship prompt, or an agent-neutral default asking to commit with a message that follows the repository's own conventions, push the branch, open a pull request against the default branch if none exists, not to merge it, and to report its URL. When the session is running the prompt SHALL be submitted to its terminal under the rules for text sent on the user's behalf, so that one activation sends it; otherwise the agent SHALL be started in the session's worktree — with its resume command and the prompt submitted after start-up when it has one, else with its command and the prompt as opening prompt — in the same session record, under the same checks as resuming. The result of Ship SHALL state whether the prompt was submitted, and when it was only typed the panel SHALL say so. The dashboard itself MUST NOT commit, push, or contact a remote. An in-place session has no worktree and no branch: it has no work status, Ship MUST NOT be offered for it, and a Ship request for it SHALL be refused.

#### Scenario: Ship in a running session
- **WHEN** Ship is used on a running session whose agent waits at its text prompt
- **THEN** the Ship prompt is typed, shown by the agent, submitted with a separate Enter, the agent starts working on it, and no process is started

#### Scenario: Ship while the agent shows a menu
- **WHEN** Ship is used on a running session whose agent shows a selection menu
- **THEN** no Enter is pressed, nothing is confirmed, and the panel says that the Ship prompt was typed but not sent

#### Scenario: Ship after the session ended
- **WHEN** Ship is used on an ended session of an agent with a resume command
- **THEN** the agent is started with the resume command in the session's worktree, the prompt is submitted to it after start-up, and the session is `running` again

#### Scenario: Nothing to ship
- **WHEN** Ship is requested for a session whose worktree is `merged`, `clean` or `missing`
- **THEN** the request is refused and nothing is started

#### Scenario: Ship is not offered without git
- **WHEN** the panel of an in-place session is open
- **THEN** no Ship control is shown, no work status is shown for it, and a Ship request for that session is refused

#### Scenario: The default prompt prescribes no convention
- **WHEN** Ship is used for a repository without a pull request title convention and the profile has no Ship prompt of its own
- **THEN** the submitted prompt asks for commit messages that follow the repository's own conventions and does not mention Conventional Commits

## ADDED Requirements

### Requirement: A repository can require Conventional Commits pull request titles
Each repository entry in the configuration MAY carry `prTitleConvention`, whose only valid value is `conventional-commits`; absent means the repository has no pull request title convention. A configuration without the field SHALL load unchanged with no convention for any repository, and a configuration carrying any other value SHALL be rejected when saved, leaving the stored configuration unchanged. The setting SHALL be stored only in the dashboard's own configuration and MUST NOT be written to, or read from, any tracked repository.

Whenever the dashboard produces the Ship prompt for a session of a repository whose convention is `conventional-commits`, it SHALL append, separated by one space, a fixed sentence asking the agent to title the pull request as a Conventional Commit — `<type>(<optional scope>): <summary>`, with an example — and to write the commit messages in the same form. The sentence SHALL be appended to the profile's own Ship prompt or, when the profile has none, to the default, and the profile's additional Ship instructions SHALL follow it, so that they still come last. The composed prompt SHALL remain one line and `{change}` SHALL be substituted in it as before. This SHALL apply wherever the Ship prompt is used — typed into a running session or handed to an ended session's agent on start-up. For a repository without a convention the Ship prompt SHALL be exactly what it would be without this requirement. No other prompt — the session starters, Resolve conflicts, Integrate — SHALL carry the sentence. The dashboard MUST NOT title, rename or edit a pull request itself, and the setting MUST NOT change whether Ship is offered.

#### Scenario: Ship for a repository with the convention
- **WHEN** `demo-ops` has `prTitleConvention: conventional-commits`, its agent has no Ship prompt and no additional Ship instructions, and Ship is used on a session whose work is `unpushed`
- **THEN** the submitted prompt is the default Ship prompt followed by one space and the Conventional Commits sentence, on one line

#### Scenario: The convention and additional instructions
- **WHEN** the repository has the convention and the profile has its own Ship prompt and additional Ship instructions `Add the checklist from CONTRIBUTING.md.`
- **THEN** the submitted prompt is the profile's Ship prompt, then the Conventional Commits sentence, then `Add the checklist from CONTRIBUTING.md.`, each separated by one space

#### Scenario: Ship after the session ended
- **WHEN** the repository has the convention and Ship is used on an ended session of an agent with a resume command
- **THEN** the prompt submitted to the resumed agent carries the Conventional Commits sentence

#### Scenario: Repository without the convention
- **WHEN** a repository has no `prTitleConvention` and Ship is used
- **THEN** the submitted prompt contains no Conventional Commits sentence

#### Scenario: Other prompts are unaffected
- **WHEN** the repository has the convention and Implement or Resolve conflicts is started for one of its changes
- **THEN** that prompt is sent exactly as it would be without the convention

#### Scenario: Unknown convention is refused
- **WHEN** a configuration is saved in which a repository carries `prTitleConvention: angular`
- **THEN** it is rejected naming the field and the stored configuration is unchanged

#### Scenario: Older configuration loads
- **WHEN** a configuration whose repository entries carry no `prTitleConvention` is loaded
- **THEN** it loads unchanged and no repository has a convention
