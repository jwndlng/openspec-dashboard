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
- **THEN** the agent is started with two arguments, `agy` and one argument `--prompt-interactive=` followed by a prompt that names `cache-api-calls`, and resuming that session starts `agy --continue`

#### Scenario: Antigravity preset starts without a prompt
- **WHEN** the Antigravity preset is the agent of a main console or a project console
- **THEN** `agy` is started alone, with no option left over that expects a value

#### Scenario: Codex preset takes its prompt as one argument
- **WHEN** the user has added the Codex preset and starts **Implement** on change `cache-api-calls` with it
- **THEN** the agent is started with two arguments, `codex` and one prompt that names `cache-api-calls`

#### Scenario: Every preset is a valid profile
- **WHEN** a configuration listing every preset unchanged is validated
- **THEN** it is accepted, including the rule against permission-bypass modes and flags

#### Scenario: A saved profile from before additional instructions existed
- **WHEN** a configuration saved without any additional instructions is loaded
- **THEN** every prompt of every profile is composed exactly as it was, and the profile carries no additional instructions

### Requirement: Every session works in its own git worktree, created by the dashboard
In a git repository a session MUST NOT run in the repository's main checkout. Before starting the agent, the dashboard SHALL ensure a git worktree for the session under `~/.openspec-dashboard/worktrees/<repository id>/`, outside the repository's working tree, on branch `feat/<change>` — or, for **Archive**, in a worktree and branch of its own (`archive-<change>`, `chore/archive-<change>`). An existing worktree for that name SHALL be reused; an existing branch SHALL be checked out; otherwise the branch SHALL be created from the repository's default branch as currently known locally (`origin/HEAD`, else `HEAD`). When that branch would be created from `HEAD` and the repository has no commit yet, so that `HEAD` names no commit, starting the session SHALL be refused before any worktree or branch is created and before any agent is started, with a reason that says the repository has no commit yet and that a session needs a first commit — which the user can make, for example, in the project console, since that runs in the checkout — rather than git's own error. That check SHALL be read-only. As the one exception, when a Draft or Implement session's branch `feat/<change>` is already checked out in another linked worktree of the repository, the session SHALL adopt that worktree — run the agent there instead of creating one — and SHALL record and show that the worktree was adopted. The dashboard MUST NOT contact a remote for this. If the change's directory is missing from the session's worktree, the dashboard SHALL copy it from the checkout the change's data comes from (the main checkout or a linked worktree), including when it exists there only uncommitted. The main checkout's branch, index and working tree MUST NOT be changed. The session record and panel SHALL show the worktree path and branch.

A tracked folder that holds an `openspec/` tree but is **not a git repository** is a supported repository, and its sessions SHALL run **in place**: the agent's working directory SHALL be the repository folder itself, no worktree SHALL be created, no branch SHALL be made, and no git command SHALL be run for the session. Whether a session runs in place SHALL be decided from the repository's own scan result, never by attempting a git command and reacting to its failure. An in-place session SHALL be recorded as such and MUST NOT carry a branch. The panel SHALL name the folder the agent runs in and SHALL state plainly that the agent edits the tracked folder directly, with no branch, no commit and no undo. Session starters MUST NOT be hidden or disabled because a repository is not a git repository.

An **integration session** — the session started by **Integrate** for a repository that is not tracked and has no `openspec/` tree — is the second in-place case and the first one in a git repository. It SHALL run in place under exactly the rules of the paragraph above: the repository folder is the working directory, no worktree, no branch, no git command for the session, recorded as in place, with the same panel wording. The reason it does not get a worktree is that its whole purpose is to leave `openspec/config.yaml` in the checkout the user works in; on a branch in a worktree the marker would never appear where discovery looks. Whether a session runs in place SHALL still be decided from what the dashboard already knows about the folder, never by attempting a git command and reacting to its failure.

A **project console** — the one session per tracked project for general project tasks, specified in the `project-console` capability — is the third in-place case and the second one in a git repository's main checkout. It SHALL run in place under the same rules: the tracked folder is the working directory, no worktree, no branch, no git command for the session, recorded as in place, with the same panel wording. It runs there because it belongs to no change and so to no branch, and because work on the project as the user sees it — including a project with no commit yet, where no worktree can be made — happens in that checkout. These two kinds are the only sessions that MAY run in a git repository's main checkout. A change session never does.

#### Scenario: Two sessions in one repository
- **WHEN** sessions are open for changes `audit-trail` and `upgrade-runtime` of the same repository
- **THEN** they run in two different worktrees on two different branches and the main checkout's branch and `git status` are unchanged

#### Scenario: Uncommitted change directory
- **WHEN** a session is opened for a change whose directory exists only uncommitted in the main checkout
- **THEN** the worktree contains a copy of that directory before the agent starts

#### Scenario: Change lives only in another worktree on another branch
- **WHEN** a session is opened for change `audit-trail`, which exists only in a worktree on branch `wip/compliance`
- **THEN** a session worktree on `feat/audit-trail` is created and contains a copy of the change directory from that worktree before the agent starts

#### Scenario: The change's branch is already checked out
- **WHEN** an Implement session is opened for change `audit-trail` and branch `feat/audit-trail` is checked out in a linked worktree that the user created
- **THEN** the agent runs in that worktree, no new worktree is created, and the panel shows the worktree as adopted

#### Scenario: Archiving does not reuse the implementation worktree
- **WHEN** a change was implemented in a session whose worktree still exists, and the user later starts **Archive** for it
- **THEN** the archive session runs in a separate worktree on a `chore/archive-<change>` branch

#### Scenario: Worktree cannot be created
- **WHEN** git refuses to create the worktree in a git repository
- **THEN** the request fails with git's reason and no agent is started

#### Scenario: Repository without a commit
- **WHEN** the user starts **Draft artifacts** for change `first-feature` in the tracked git repository `/w/acme/fresh-app`, which was initialised but has no commit, and has no `origin/HEAD`
- **THEN** the request is refused with a reason saying the repository has no commit yet and that a first commit is needed, the card shows that reason, no worktree, branch or file is created, and no agent is started

#### Scenario: Archiving a change in a folder that is not a git repository
- **WHEN** the user starts **Archive** for a completed change in a tracked folder that has an `openspec/` tree but no `.git`
- **THEN** the agent starts with the tracked folder as its working directory, no worktree and no branch are created, and no git command is run for the session

#### Scenario: The panel names the folder for an in-place session
- **WHEN** the panel of an in-place session is open
- **THEN** it names the repository folder the agent runs in, shows no branch, and states that the agent edits that folder directly with no branch, no commit and no undo

#### Scenario: An integration session runs in the checkout
- **WHEN** the user activates **Integrate** for a git repository that has no `openspec/config.yaml`
- **THEN** the agent starts with that repository folder as its working directory, no worktree and no branch are created, and the dashboard runs no git command for the session

#### Scenario: The integration panel states the risk
- **WHEN** the panel of an integration session is open
- **THEN** it names the repository folder, shows no branch, and states that the agent edits that folder directly with no branch, no commit and no undo

#### Scenario: A project console runs in the checkout
- **WHEN** the user opens the project console of the tracked git repository `/w/acme/demo-ops`
- **THEN** the agent starts with `/w/acme/demo-ops` as its working directory, no worktree and no branch are created, and the dashboard runs no git command for the session

#### Scenario: Change sessions still never run in the main checkout
- **WHEN** a project console runs in `/w/acme/demo-ops` and the user starts Implement for a change of `demo-ops`
- **THEN** the Implement session runs in its own worktree on its own branch, not in the main checkout

## ADDED Requirements

### Requirement: A former preset command is read as the current one
A saved profile whose id is a preset's and whose command is, argument for argument, one of that preset's former
commands SHALL be loaded with the preset's current command. Any other command — edited, of a profile with no preset's
id, or another preset's former command — is the user's and SHALL be loaded as saved. Loading SHALL NOT write the
configuration file; the upgraded command reaches it with the next save. The Antigravity preset's former command is
`agy`, `-i`, `{prompt}`.

#### Scenario: The former Antigravity command is upgraded
- **WHEN** a configuration whose `agy` profile has the command `agy`, `-i`, `{prompt}` is loaded
- **THEN** the loaded profile's command is `agy`, `--prompt-interactive={prompt}`, its prompts and resume command are unchanged, and the file on disk is unchanged until the next save

#### Scenario: An edited command is the user's
- **WHEN** a configuration whose `agy` profile has the command `agy`, `-i`, `{prompt}`, `--model`, `fast` is loaded
- **THEN** the loaded profile's command is exactly that

#### Scenario: Another profile with the same command is the user's
- **WHEN** a configuration has a profile with id `my-agy` and the command `agy`, `-i`, `{prompt}`
- **THEN** the loaded profile's command is exactly that
