# agent-sessions Specification

## Purpose
Defines agent sessions: starting a user-configured agent CLI for a change from the dashboard, in a terminal shown in the dashboard and inside a git worktree of its own — when sessions are available, how agents are configured and started, what a session is and how long it lives, what the dashboard may claim about its state, where its records are kept, and when its worktree may be removed.

## Requirements

### Requirement: Agent sessions are off until enabled, then apply to every tracked repository
Agent sessions SHALL be available only when the global `agentSessions.enabled` setting is true. Once it is, they apply to every tracked (enabled) repository by default; a repository MAY be excluded individually, and an excluded or untracked repository MUST NOT show session starters and MUST be refused by the API. A fresh or migrated configuration MUST have the feature disabled. A repository entry without agent settings counts as included.

#### Scenario: Default configuration
- **WHEN** the dashboard starts with a configuration that predates this feature
- **THEN** agent sessions are disabled and no card shows a session starter

#### Scenario: One switch enables all tracked repositories
- **WHEN** the user turns agent sessions on and has not changed any per-repository setting
- **THEN** cards of every tracked repository offer the starters their stage and agent allow

#### Scenario: Repository switched off
- **WHEN** agent sessions are enabled and repository `alpha-infra` is switched off for agent sessions
- **THEN** cards of `alpha-infra` show no session starter and opening a session for it is refused, while other repositories are unaffected

### Requirement: An agent is a configurable profile, not a built-in integration
The dashboard SHALL start agents from user-configurable profiles. A profile consists of an id, a display name, a command given as an argument list, an opening prompt per session starter, an optional resume command and an optional list of environment variables to remove. The dashboard MUST NOT depend on any vendor-specific protocol or output format of an agent: any program that runs interactively in a terminal SHALL be usable. One profile is the default; a repository MAY select a different one. A profile for Claude Code SHALL be preconfigured. The dashboard MUST NOT read, store, log or transmit an agent's credentials and MUST NOT offer a login flow; an agent uses its own login and its own settings.

#### Scenario: A second agent
- **WHEN** the user adds a profile with command `my-agent-cli`, `{prompt}` and an Implement prompt, and selects it for repository `demo-ops`
- **THEN** Implement on a `demo-ops` card starts `my-agent-cli` and other repositories keep using the default agent

#### Scenario: Agent not installed
- **WHEN** the executable of a repository's agent cannot be found on this machine
- **THEN** that repository's starters are disabled with an explanation, and opening a session is refused with that reason

#### Scenario: API key variables are removed for the preconfigured agent
- **WHEN** the dashboard was started from a shell that exports `ANTHROPIC_API_KEY` and a Claude Code session is opened with the default profile
- **THEN** the agent's environment does not contain `ANTHROPIC_API_KEY`, so its own login is used

### Requirement: Session starters run a fixed prompt for a validated change
The dashboard SHALL offer the starters **Draft artifacts** (while at least one artifact of the change is not done), **Implement** (change in `Ready` or `Implementing`) and **Archive** (change in `Done`), each only when the repository's agent has an opening prompt configured for it, and none for archived changes. The opening prompt SHALL be produced from the profile's template, in which `{change}` is the only placeholder, replaced by the change name after it passed change-name validation. The agent MUST be started without a shell from an argument list; the prompt MUST reach it either as exactly one argument (where the command contains `{prompt}`) or by being typed into its terminal after start-up (where it does not). No text from the browser other than the validated change name may become part of the command line.

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

### Requirement: A session is the agent's own terminal
A session SHALL run the agent attached to a pseudo-terminal, and the session panel SHALL show that terminal: what the agent prints is displayed as the agent rendered it, and what the user types is delivered to the agent unchanged. The dashboard MUST NOT parse, summarise or filter the agent's output, and the agent's own prompts — including its permission and trust questions — SHALL be answered by the user in the terminal. The terminal SHALL follow the size of the panel. Several viewers MAY be attached to one session at once; a viewer that attaches later SHALL first receive what the terminal has shown so far (bounded), then follow live. Closing the panel MUST NOT end the session.

#### Scenario: Typing reaches the agent
- **WHEN** the user types a follow-up instruction into the session's terminal and presses Enter
- **THEN** the agent receives exactly those keystrokes and its response appears in the terminal

#### Scenario: The agent asks for permission
- **WHEN** the agent asks whether it may run a command
- **THEN** its question appears in the terminal as it would in any terminal and the user's keystroke answers it

#### Scenario: Reattaching
- **WHEN** the user closes the session panel and opens it again, or opens the same session in a second tab
- **THEN** the terminal shows the earlier output and continues live; the agent was not interrupted

### Requirement: Every session works in its own git worktree, created by the dashboard
A session MUST NOT run in the repository's main checkout. Before starting the agent, the dashboard SHALL ensure a git worktree for the session under `~/.openspec-dashboard/worktrees/<repository id>/`, outside the repository's working tree, on branch `feat/<change>` — or, for **Archive**, in a worktree and branch of its own (`archive-<change>`, `chore/archive-<change>`). An existing worktree for that name SHALL be reused; an existing branch SHALL be checked out; otherwise the branch SHALL be created from the repository's default branch as currently known locally (`origin/HEAD`, else `HEAD`). As the one exception, when a Draft or Implement session's branch `feat/<change>` is already checked out in another linked worktree of the repository, the session SHALL adopt that worktree — run the agent there instead of creating one — and SHALL record and show that the worktree was adopted. The dashboard MUST NOT contact a remote for this. If the change's directory is missing from the session's worktree, the dashboard SHALL copy it from the checkout the change's data comes from (the main checkout or a linked worktree), including when it exists there only uncommitted. The main checkout's branch, index and working tree MUST NOT be changed. The session record and panel SHALL show the worktree path and branch.

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
- **WHEN** git refuses to create the worktree
- **THEN** the request fails with git's reason and no agent is started

### Requirement: Session lifecycle and control
A session SHALL be `running` while its agent process lives, `exited` with the process's exit code once it has ended, or `failed` when the agent could not be started. At most one session per repository and change may be running; a request to open another SHALL return the running one. **End session** SHALL terminate the agent as closing its terminal window would (hang-up, then a forced kill if it does not exit). When the agent's profile has a resume command, an ended session SHALL offer **Resume**, which starts that command in the same worktree within the same session. Because a terminal cannot outlive the process that owns it, stopping the dashboard MUST end every agent, and sessions recorded as running at start-up MUST be shown as ended with that reason.

#### Scenario: Duplicate open
- **WHEN** a session for a change is running and the same starter is used again
- **THEN** the existing session is returned and no second process is started

#### Scenario: Agent exits
- **WHEN** the user quits the agent from within the terminal
- **THEN** the session becomes `exited` with the exit code, every attached viewer is told, and the terminal's output remains viewable

#### Scenario: Resume
- **WHEN** an ended session's agent has the resume command `claude`, `--continue` and the user presses Resume
- **THEN** that command is started in the session's worktree and the session is `running` again

#### Scenario: Dashboard stopped
- **WHEN** the dashboard receives a termination signal while a session is running
- **THEN** the agent is ended and the session is recorded as ended because the dashboard was stopped

### Requirement: Status shown for a session is limited to what a terminal can tell
The dashboard SHALL show a session as running, ended (with a non-zero exit code or an error highlighted) or failed, and SHALL record when the terminal last produced output. While a session is running and its terminal has been silent for more than a minute, the dashboard SHALL show it as quiet together with the duration, as a hint that the agent may be waiting for the user. The dashboard MUST NOT claim to know that an agent is waiting, working, or how much it has cost.

#### Scenario: Quiet terminal
- **WHEN** a running session's terminal has printed nothing for ten minutes
- **THEN** its badge reads quiet for 10 minutes and explains that the agent is probably waiting

### Requirement: Session records live outside repositories
Session metadata SHALL be stored only under `~/.openspec-dashboard/sessions/<session-id>/`, written atomically and readable by the user only; when a session ends, the bounded tail of its terminal output SHALL be stored there too, so that an ended session still shows what happened. The dashboard SHALL keep the newest 50 ended sessions, and a session's record SHALL be deletable from the UI once it has ended.

#### Scenario: Looking at an ended session
- **WHEN** the user opens the panel of a session that ended before the dashboard was restarted
- **THEN** the stored terminal output is shown and no input is accepted

### Requirement: Worktree clean-up is offered only when safe
When ending or cleaning up a session, or for a worktree that has no session record, the dashboard SHALL offer to remove the worktree only if the dashboard created it, it has no uncommitted changes, and either its work status is `merged` or it has no commits that exist nowhere else (nothing ahead of its upstream, or, without an upstream, no commit that is unreachable from every other local or remote-tracking branch). Removal SHALL happen only after the user confirms, by a non-forcing `git worktree remove`; the branch is never deleted. Otherwise the worktree MUST be kept and the reason shown. A worktree MUST NOT be removed while a session is running in it. A worktree that a session adopted MUST NOT be offered for removal and MUST NOT be removed by the dashboard.

#### Scenario: Unpushed work
- **WHEN** the user ends a session whose worktree has commits that exist only on its branch
- **THEN** removal is not offered, the worktree is kept, and the panel explains why

#### Scenario: Clean worktree
- **WHEN** the worktree is clean, its commits exist elsewhere, and the user confirms removal
- **THEN** the worktree is removed

#### Scenario: Squash-merged and the remote branch is gone
- **WHEN** the worktree is clean, its work status is `merged`, its upstream no longer exists, and the user confirms removal
- **THEN** the worktree is removed and its local branch still exists

#### Scenario: Adopted worktree
- **WHEN** the user ends a session that adopted a worktree the user had created, and that worktree is clean
- **THEN** removal is not offered and the worktree is kept

### Requirement: Every session worktree has a work status
For every directory under `~/.openspec-dashboard/worktrees/<repoId>/` of a configured repository the dashboard SHALL derive a work status from local git, using read-only commands and without contacting a remote. The base is the repository's default branch as locally known (`origin/HEAD`), or the main checkout's `HEAD` when there is none. The status SHALL be the first that applies: `missing` when the directory is not a git worktree; `uncommitted` with the number of changed or untracked files; `merged` when the branch has no commit that the base lacks and a remote-tracking branch of the same name exists, or when every file the branch changed has the same content in the base (which also recognises squash and rebase merges); `clean` when the branch has no commit that the base lacks; `unpushed` with the number of commits ahead of its upstream, or all commits the base lacks when it has no upstream; otherwise `pushed`. Statuses MAY be cached for up to 15 seconds and MUST be recomputed after a session ends, a Ship action or a worktree removal. Because nothing is fetched, `merged` reflects the user's last fetch; the UI MUST say so.

#### Scenario: Uncommitted files
- **WHEN** a session's worktree contains two modified files and one untracked file
- **THEN** its work status is `uncommitted` with a count of 3

#### Scenario: Committed but not pushed
- **WHEN** the worktree is clean and its branch has two commits and no upstream
- **THEN** its work status is `unpushed` with a count of 2

#### Scenario: Pushed
- **WHEN** the worktree is clean and its branch equals its upstream but the base lacks its commits and content
- **THEN** its work status is `pushed`

#### Scenario: Squash-merged
- **WHEN** the base contains one commit with the same file content as the branch's three commits
- **THEN** its work status is `merged`

#### Scenario: Worktree without a session record
- **WHEN** a session's record is deleted while its worktree holds uncommitted files
- **THEN** the worktree is still listed with status `uncommitted`

#### Scenario: No network
- **WHEN** work statuses are computed
- **THEN** no git command that contacts a remote is run

### Requirement: Ship asks the agent to commit, push and open a pull request
For a session whose worktree has status `uncommitted`, `unpushed` or `pushed` the dashboard SHALL offer a Ship action. It uses the agent profile's Ship prompt, or an agent-neutral default asking to commit with a conventional message, push the branch, open a pull request against the default branch if none exists, not to merge it, and to report its URL. When the session is running the prompt SHALL be typed into its terminal; otherwise the agent SHALL be started in the session's worktree — with its resume command and the prompt typed after start-up when it has one, else with its command and the prompt as opening prompt — in the same session record, under the same checks as resuming. The dashboard itself MUST NOT commit, push, or contact a remote.

#### Scenario: Ship in a running session
- **WHEN** Ship is used on a running session
- **THEN** the Ship prompt followed by Enter is written to the terminal and no process is started

#### Scenario: Ship after the session ended
- **WHEN** Ship is used on an ended session of an agent with a resume command
- **THEN** the agent is started with the resume command in the session's worktree, the prompt is typed into it, and the session is `running` again

#### Scenario: Nothing to ship
- **WHEN** Ship is requested for a session whose worktree is `merged`, `clean` or `missing`
- **THEN** the request is refused and nothing is started
