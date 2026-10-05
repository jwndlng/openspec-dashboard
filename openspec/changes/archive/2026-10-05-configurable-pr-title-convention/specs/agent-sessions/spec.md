# Spec Delta

## MODIFIED Requirements

### Requirement: Ship asks the agent to commit, push and open a pull request
For a session whose worktree has status `uncommitted`, `unpushed` or `pushed` the dashboard SHALL offer a Ship action. It uses the agent profile's Ship prompt, or an agent-neutral default asking to commit with a message that follows the repository's own conventions, push the branch, open a pull request against the default branch if none exists, not to merge it, and to report its URL. When the session is running the prompt SHALL be submitted to its terminal under the rules for text sent on the user's behalf, so that one activation sends it; otherwise the agent SHALL be started in the session's worktree — with its resume command and the prompt submitted after start-up when it has one, else with its command and the prompt as opening prompt — in the same session record, under the same checks as resuming. The result of Ship SHALL state whether the prompt was submitted, and when it was only typed the panel SHALL say so. The dashboard itself MUST NOT commit, push, merge, enable auto-merge or contact a remote.

When the session's repository has auto-merge of docs-only pull requests switched on, the dashboard SHALL decide before composing the prompt whether the session ships **only OpenSpec documents**: that holds when the worktree's base is known and every path that differs between the base and the branch's last commit, and every path reported by the worktree's status — modified, staged, deleted, untracked, and both sides of a rename — lies under `openspec/` at the repository root, and at least one such path exists. It SHALL be decided with read-only git, without contacting a remote, at the moment of the Ship request and never from a cached status or from anything the agent printed. A git command that fails, an unknown base, or any path outside `openspec/` SHALL count as not only OpenSpec documents. Only when the session ships only OpenSpec documents SHALL the dashboard append to the Ship prompt, after the profile's additional Ship instructions, a fixed agent-neutral instruction that: states that this project lets a pull request changing only files under `openspec/` merge without review; asks the agent, once the pull request is open, to enable auto-merge on it so that it merges when its required checks pass, in place of any earlier instruction not to merge it; asks the agent first to confirm that every file the pull request changes is under `openspec/`, and otherwise to leave it unmerged and say why; and asks the agent to say whether auto-merge was enabled. In every other case — the setting off or absent, the check failing — the Ship prompt SHALL be exactly the prompt without this setting. The result of Ship SHALL state whether the instruction was included, and when it was, the panel SHALL say that the agent was asked to enable auto-merge because only OpenSpec documents changed. Enabling auto-merge is the agent's action under its own permission prompts; the dashboard SHALL NOT verify, retry or undo it. An in-place session has no worktree and no branch: it has no work status, Ship MUST NOT be offered for it, and a Ship request for it SHALL be refused.

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

#### Scenario: Shipping an archive branch with auto-merge on
- **WHEN** Ship is used on the archive session of `rotate-keys` in a repository with auto-merge of docs-only pull requests on, and the branch only moves `openspec/changes/rotate-keys/` under `openspec/changes/archive/` and changes `openspec/specs/secrets/spec.md`
- **THEN** the Ship prompt ends with the auto-merge instruction, the result states that it was included, and the panel says the agent was asked to enable auto-merge

#### Scenario: Code in the branch
- **WHEN** Ship is used in a repository with auto-merge on and the branch changes `openspec/changes/rotate-keys/tasks.md` and `src/keys.ts`
- **THEN** the Ship prompt carries no auto-merge instruction and the result states that it was not included

#### Scenario: An uncommitted file outside openspec
- **WHEN** Ship is used in a repository with auto-merge on, every committed change of the branch is under `openspec/`, and the worktree has an untracked `notes.txt` at its root
- **THEN** the Ship prompt carries no auto-merge instruction

#### Scenario: Auto-merge off
- **WHEN** Ship is used on a branch that changes only files under `openspec/` in a repository without auto-merge of docs-only pull requests
- **THEN** the Ship prompt is the profile's Ship prompt with its additional instructions and nothing else, and the result states that no auto-merge instruction was included

#### Scenario: Base unknown
- **WHEN** Ship is used in a repository with auto-merge on and the worktree's base cannot be determined
- **THEN** the Ship prompt carries no auto-merge instruction

#### Scenario: A look-alike path
- **WHEN** Ship is used in a repository with auto-merge on and the branch changes `docs/openspec/notes.md` and `openspec-notes.md`
- **THEN** the Ship prompt carries no auto-merge instruction

#### Scenario: The dashboard still merges nothing
- **WHEN** Ship with the auto-merge instruction is used and the agent enables auto-merge
- **THEN** the dashboard ran no `gh` process, no git command that writes, and contacted no remote for it

#### Scenario: The default prompt prescribes no convention
- **WHEN** Ship is used for a repository without a pull request title convention and the profile has no Ship prompt of its own
- **THEN** the submitted prompt asks for commit messages that follow the repository's own conventions and does not mention Conventional Commits

## ADDED Requirements

### Requirement: A repository can require Conventional Commits pull request titles
Each repository entry in the configuration MAY carry `prTitleConvention`, whose only valid value is `conventional-commits`; absent means the repository has no pull request title convention. A configuration without the field SHALL load unchanged with no convention for any repository, and a configuration carrying any other value SHALL be rejected when saved, leaving the stored configuration unchanged. The setting SHALL be stored only in the dashboard's own configuration and MUST NOT be written to, or read from, any tracked repository.

Whenever the dashboard produces the Ship prompt for a session of a repository whose convention is `conventional-commits`, it SHALL append, separated by one space, a fixed sentence asking the agent to title the pull request as a Conventional Commit — `<type>(<optional scope>): <summary>`, with an example — and to write the commit messages in the same form. The sentence SHALL be appended to the profile's own Ship prompt or, when the profile has none, to the default, and the profile's additional Ship instructions SHALL follow it; the auto-merge instruction for docs-only pull requests, when included, SHALL still come after both. The composed prompt SHALL remain one line and `{change}` SHALL be substituted in it as before. This SHALL apply wherever the Ship prompt is used — typed into a running session or handed to an ended session's agent on start-up. For a repository without a convention the Ship prompt SHALL be exactly what it would be without this requirement. No other prompt — the session starters, Resolve conflicts, Integrate — SHALL carry the sentence. The dashboard MUST NOT title, rename or edit a pull request itself, and the setting MUST NOT change whether Ship is offered.

#### Scenario: Ship for a repository with the convention
- **WHEN** `demo-ops` has `prTitleConvention: conventional-commits`, its agent has no Ship prompt and no additional Ship instructions, and Ship is used on a session whose work is `unpushed`
- **THEN** the submitted prompt is the default Ship prompt followed by one space and the Conventional Commits sentence, on one line

#### Scenario: The convention and additional instructions
- **WHEN** the repository has the convention and the profile has its own Ship prompt and additional Ship instructions `Add the checklist from CONTRIBUTING.md.`
- **THEN** the submitted prompt is the profile's Ship prompt, then the Conventional Commits sentence, then `Add the checklist from CONTRIBUTING.md.`, each separated by one space

#### Scenario: The convention and auto-merge of docs-only pull requests
- **WHEN** the repository has the convention and auto-merge of docs-only pull requests on, and Ship is used on a session that ships only OpenSpec documents
- **THEN** the submitted prompt is the Ship prompt, then the Conventional Commits sentence, then the profile's additional Ship instructions if any, then the auto-merge instruction

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
