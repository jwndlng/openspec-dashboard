## ADDED Requirements

### Requirement: Agent sessions are disabled unless enabled globally and per repository
Agent sessions SHALL be available only when the global `agentSessions.enabled` setting is true AND the repository has opted in. When either is false the UI MUST NOT show session starters for that repository and the API MUST refuse to open a session for it. A fresh or migrated configuration MUST have the feature disabled and no repository opted in.

#### Scenario: Default configuration
- **WHEN** the dashboard starts with a configuration that predates this feature
- **THEN** agent sessions are disabled, no repository is opted in, and no card shows a session starter

#### Scenario: Repository not opted in
- **WHEN** agent sessions are enabled globally but repository `alpha-infra` has not opted in
- **THEN** cards of `alpha-infra` show no session starter and opening a session for it is refused

### Requirement: Sessions run the user's installed agent CLI on the user's own login
A session SHALL be conducted by the locally installed `claude` command-line program, started by the dashboard server without a shell from an argument array. The dashboard MUST NOT read, store, log or transmit credentials and MUST NOT offer a login flow. By default the child process environment MUST NOT contain `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`, so that the CLI uses its stored subscription login; a setting MAY opt in to passing them through. When the CLI cannot be found, session starters SHALL be disabled with an explanation.

#### Scenario: API key in the environment is not used
- **WHEN** the dashboard was started from a shell that exports `ANTHROPIC_API_KEY` and a session is opened with default settings
- **THEN** the child process environment does not contain `ANTHROPIC_API_KEY`

#### Scenario: CLI not installed
- **WHEN** no `claude` executable can be resolved
- **THEN** session starters are disabled, the reason is shown, and opening a session through the API is refused with that reason

#### Scenario: Not logged in
- **WHEN** the CLI reports an authentication failure
- **THEN** the session becomes `failed` with reason `auth` and the panel tells the user to log in by running the CLI in a terminal

### Requirement: Session starters are fixed commands for a validated change
The dashboard SHALL offer two session starters: **Draft artifacts**, available while at least one artifact of the change is not done, and **Implement**, available when the change is in `Ready` or `Implementing`; neither is offered for archived changes. The opening instruction SHALL be produced from a configured command template in which `{change}` is the only placeholder, replaced by the change name after it passed change-name validation. No other text from the browser may become part of the command line.

#### Scenario: Implement on a ready change
- **WHEN** the user starts **Implement** on change `cache-api-calls` with the default templates
- **THEN** the session's first user message is `/opsx:apply cache-api-calls`

#### Scenario: Starter not offered
- **WHEN** a change has only a proposal
- **THEN** **Draft artifacts** is offered and **Implement** is not

#### Scenario: Invalid change name
- **WHEN** a session is requested for a change name containing characters outside the allowed set
- **THEN** the request is refused and no process is started

### Requirement: Sessions are interactive conversations
A session SHALL remain open after the opening instruction completes. While the agent is working the session is `running`; when the agent's turn ends it is `waiting` and the user can send a further free-text message, which continues the same conversation with its context. Follow-up messages MUST be delivered to the agent as conversation messages over the process's input channel and MUST NOT be interpolated into a command line or passed through a shell. Messages sent while the session is `running` or `queued` SHALL be queued and delivered in order when the current turn ends.

#### Scenario: Follow-up keeps context
- **WHEN** the opening turn has finished and the user sends "also update the README"
- **THEN** the session becomes `running` again, the agent receives that text as the next user message of the same conversation, and the transcript shows it

#### Scenario: Shell metacharacters are inert
- **WHEN** the user sends the message `"; rm -rf ~ #`
- **THEN** the agent receives exactly that text as a message and no shell interprets it

### Requirement: Every session works in its own git worktree
A session MUST NOT work in the repository's main checkout. Opening a session SHALL make the agent CLI create or reuse a dedicated git worktree for the change on a branch named after the change, and the agent SHALL run there. The agent's instructions MUST state the worktree and branch it owns, forbid editing, staging, committing or switching branches in the main checkout, and direct it to copy the change's directory from the main checkout into the worktree and commit it first when it is missing there. The session record and panel SHALL show the worktree path and branch.

#### Scenario: Two sessions in one repository
- **WHEN** sessions are open for changes `audit-trail` and `upgrade-runtime` of the same repository
- **THEN** they work in two different worktrees on two different branches and the main checkout's files and branch are unchanged by the dashboard

#### Scenario: Uncommitted change directory
- **WHEN** a session is opened for a change whose directory exists only uncommitted in the main checkout
- **THEN** the agent is instructed to copy that directory into its worktree and commit it there before doing anything else

#### Scenario: Existing worktree is reused
- **WHEN** a session is opened for a change that already has a worktree from an earlier session
- **THEN** that worktree is reused rather than a second one created

### Requirement: Tool permissions are bounded and never bypassed
Sessions SHALL run in a permission mode that does not prompt and denies every tool use that is not explicitly allowed. The allowed tools are the built-in default list (file read/search/edit, the `openspec` command, and local git status/diff/log/add/commit) plus entries the user added for that repository. The dashboard MUST NOT start the CLI with a permission-bypass mode or flag, MUST reject configuration entries that would introduce one, and MUST NOT offer free-form extra CLI arguments. A denied tool use SHALL appear in the transcript as denied.

#### Scenario: Command outside the allow-list
- **WHEN** the agent tries to run `curl https://example.com` and the repository's allow-list does not permit it
- **THEN** the call is denied without prompting, the transcript shows the denial, and the session continues

#### Scenario: Bypass cannot be configured
- **WHEN** a configuration is saved with an allowed-tools entry or command template containing a permission-bypass flag or mode
- **THEN** the configuration is rejected

### Requirement: Session lifecycle, limits and control
A session SHALL be in exactly one state of `queued`, `running`, `waiting`, `closed`, `failed`, `cancelled`, `interrupted`. At most one session per repository and change may be open (any state other than `closed`, `failed`, `cancelled`); a request to open another SHALL return the existing one. At most `maxRunning` sessions (default 2) may be `running`; further turns wait as `queued` in first-in-first-out order. **Stop** SHALL interrupt the current turn and leave the session `waiting`; **Close** SHALL end the session as `closed`; **Cancel** SHALL terminate the process immediately as `cancelled`. A process that ends unexpectedly SHALL make the session `failed` with a classified reason (`auth`, `usage-limit`, `cli-missing`, `crashed`).

#### Scenario: Running limit
- **WHEN** two sessions are `running` with `maxRunning: 2` and a third is opened
- **THEN** the third is `queued` and becomes `running` when one of the others leaves `running`

#### Scenario: Stop keeps the conversation
- **WHEN** the user presses Stop during a turn
- **THEN** the turn is interrupted, the session is `waiting`, and a following message continues the same conversation

#### Scenario: Usage limit
- **WHEN** the CLI reports that the account's usage limit is reached
- **THEN** the session is `failed` with reason `usage-limit` and the panel says so

### Requirement: Transcript, resume hand-off and reopening
The session panel SHALL show a live transcript of user messages, assistant text, tool calls with their results, denied calls, and per-turn cost/usage when the CLI reports them. Transcript content MUST be rendered as untrusted text (no raw HTML, no remote resources). The dashboard SHALL choose the CLI session identifier when opening the session, store it, and offer a "Copy resume command" that continues the same conversation from a terminal in the session's worktree. A `waiting` or `interrupted` session SHALL be reopenable: sending a message resumes the same CLI conversation even after the process was stopped for idleness or the dashboard was restarted.

#### Scenario: Resume command
- **WHEN** the user copies the resume command of a session
- **THEN** the clipboard contains a command that changes into the session's worktree and resumes the CLI conversation by its stored identifier

#### Scenario: Reopen after restart
- **WHEN** the dashboard is restarted while a session was `waiting` and the user then sends a message in it
- **THEN** a new process resumes the same CLI conversation and the transcript continues below the previous one

#### Scenario: Idle process is stopped
- **WHEN** a session has been `waiting` longer than the idle limit
- **THEN** its process is stopped, the session stays `waiting`, and the next message resumes the conversation

### Requirement: Session records live outside repositories
Session metadata and transcripts SHALL be stored only under `~/.openspec-dashboard/sessions/<session-id>/`, readable by the user only, written atomically (metadata) or append-only (events). The dashboard SHALL keep the newest 50 ended sessions and cap a transcript's size, eliding the oldest tool-result bodies first. A session and its transcript SHALL be deletable from the UI. On dashboard shutdown, child processes MUST be stopped and sessions that were `running` or `queued` marked `interrupted`; on start-up, a record marked `running` without a live process MUST become `interrupted`.

#### Scenario: Nothing is written to the repository by the dashboard
- **WHEN** a session runs and is closed without removing its worktree
- **THEN** every file the dashboard itself created or modified lies under `~/.openspec-dashboard/`

#### Scenario: Shutdown
- **WHEN** the dashboard receives a termination signal while a session is `running`
- **THEN** the child process is stopped and the session is recorded as `interrupted`

### Requirement: Worktree clean-up is offered only when safe
When closing a session the dashboard SHALL offer to remove the session's worktree only if the worktree has no uncommitted changes and no commits that exist nowhere else (not ahead of its upstream, or no upstream and nothing ahead of the base branch). Removal SHALL happen only after the user confirms, using a non-forcing `git worktree remove`. Otherwise the worktree MUST be kept and the reason shown.

#### Scenario: Unpushed work
- **WHEN** the user closes a session whose worktree has commits that were not pushed
- **THEN** removal is not offered, the worktree is kept, and the panel explains why

#### Scenario: Clean worktree
- **WHEN** the worktree is clean and fully pushed and the user confirms removal
- **THEN** the worktree is removed and the session is `closed`
