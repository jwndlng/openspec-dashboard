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
The dashboard SHALL start agents from user-configurable profiles. A profile consists of an id, a display name, a command given as an argument list, an opening prompt per session starter, optional additional instructions per prompt, an optional resume command and an optional list of environment variables to remove. The dashboard MUST NOT depend on any vendor-specific protocol or output format of an agent: any program that runs interactively in a terminal SHALL be usable. One profile is the default; a repository MAY select a different one. A profile for Claude Code SHALL be preconfigured, with no additional instructions for any of its prompts. The dashboard MUST NOT read, store, log or transmit an agent's credentials and MUST NOT offer a login flow; an agent uses its own login and its own settings.

#### Scenario: A second agent
- **WHEN** the user adds a profile with command `my-agent-cli`, `{prompt}` and an Implement prompt, and selects it for repository `demo-ops`
- **THEN** Implement on a `demo-ops` card starts `my-agent-cli` and other repositories keep using the default agent

#### Scenario: Agent not installed
- **WHEN** the executable of a repository's agent cannot be found on this machine
- **THEN** that repository's starters are disabled with an explanation, and opening a session is refused with that reason

#### Scenario: API key variables are removed for the preconfigured agent
- **WHEN** the dashboard was started from a shell that exports `ANTHROPIC_API_KEY` and a Claude Code session is opened with the default profile
- **THEN** the agent's environment does not contain `ANTHROPIC_API_KEY`, so its own login is used

#### Scenario: A saved profile from before additional instructions existed
- **WHEN** a configuration saved without any additional instructions is loaded
- **THEN** every prompt of every profile is composed exactly as it was, and the profile carries no additional instructions

### Requirement: Session starters run a fixed prompt for a validated change
The dashboard SHALL offer the starters **Draft artifacts** (while at least one artifact of the change is not done), **Implement** (change in `Ready` or `Implementing`), **Validate** (change in `Done` with the sub-state `validate`) and **Archive** (change in `Done`, in either sub-state), each only when the repository's agent has an opening prompt configured for it, and none for archived changes. **Implement** SHALL NOT be offered for a change in `Done`: nothing is left to implement there, and offering it is what sends an agent back into finished code. A request to start a starter that is not available for the change's current stage and sub-state SHALL be refused. The opening prompt SHALL be produced from the profile's template, in which `{change}` is the only placeholder, replaced by the change name after it passed change-name validation. The agent MUST be started without a shell from an argument list; the prompt MUST reach it either as exactly one argument (where the command contains `{prompt}`) or by being submitted to its terminal after start-up under the rules for text sent on the user's behalf (where it does not). No text from the browser other than the validated change name may become part of the command line.

The preconfigured profile's prompts SHALL carry the meaning of the `- [~]` task marker, which OpenSpec itself does not define: the **Implement** prompt SHALL instruct the agent to leave a task only a person can verify as `- [~]` rather than ticking it; the **Validate** prompt SHALL instruct the agent to take the change's `- [~]` tasks one at a time, say what to check, and tick off only those the user confirms, leaving the rest; and the **Archive** prompt SHALL instruct the agent to sync the change's delta specs into the main specs and then archive the change, without asking whether to sync, to archive right away when nothing is left to sync, and to tick off the tasks left for the user to validate once the user has confirmed them. Each SHALL remain an ordinary prompt template the user can edit or remove, and each SHALL be a single line, so that it can be typed into a terminal.

A saved configuration whose preconfigured profile still carries a former preconfigured prompt for a starter verbatim SHALL be read as carrying the current one for that starter; any other prompt, and a removed one, SHALL be left as saved. This SHALL apply per starter, so upgrading one prompt never rewrites another.

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

### Requirement: Additional instructions extend an action's prompt without replacing it
A profile SHALL be able to carry **additional instructions** for each of its prompts — the session starters, Ship and Integrate — kept separately from the prompt itself. Whenever the dashboard produces the prompt of an action, it SHALL append that action's additional instructions to the prompt it would otherwise have sent, and SHALL send nothing else: the prompt template stays as configured, and additional instructions for one action MUST NOT reach another. This applies wherever that prompt is used — starting a session, sending a starter's prompt into a running session, Ship on a running or an ended session, and Integrate.

The composed text SHALL be one line: additional instructions SHALL be trimmed and any run of whitespace in them, including a line break, SHALL become a single space before they are appended, separated from the prompt by one space. Placeholders SHALL be substituted in the composed text under the rules of the prompt being extended, so additional instructions for a starter or for Ship MAY use `{change}` and MUST use no other placeholder, additional Integrate instructions MUST contain no placeholder at all, and no additional instructions may carry a permission-bypass mode or flag. Additional instructions that break these rules SHALL be refused when the configuration is saved, with a message naming the field, leaving the stored configuration unchanged.

Additional instructions SHALL be an addition, never a prompt of their own: an action whose prompt is not configured SHALL stay unavailable and its additional instructions SHALL NOT be sent anywhere. Ship SHALL be the one exception in effect, because it has an agent-neutral default prompt: additional Ship instructions SHALL be appended to the profile's Ship prompt, or to that default when the profile has none. Settings SHALL offer the additional instructions of each prompt beside that prompt, saying that the text is appended to it; empty additional instructions SHALL be stored as absent.

#### Scenario: Additional instructions reach a starter's prompt
- **WHEN** the repository's agent has the Implement prompt `/opsx:apply {change}` and additional Implement instructions `Run the linter before you finish.`, and Implement is started for change `cache-api-calls`
- **THEN** the agent receives one prompt reading `/opsx:apply cache-api-calls Run the linter before you finish.`

#### Scenario: Additional instructions extend the default Ship prompt
- **WHEN** a profile has no Ship prompt of its own but additional Ship instructions `Add the checklist from CONTRIBUTING.md to the pull request body.`, and Ship is used on a session whose work is `unpushed`
- **THEN** the text submitted to the agent is the agent-neutral default Ship prompt followed by one space and that sentence

#### Scenario: Additional instructions are one line
- **WHEN** additional Archive instructions are saved as two lines with trailing blanks
- **THEN** the composed Archive prompt is a single line in which those lines are joined by one space, so that a prompt typed into a terminal is not submitted early

#### Scenario: Additional instructions stay with their own action
- **WHEN** a profile carries additional instructions for Implement only
- **THEN** the Draft, Validate, Archive, Ship and Integrate prompts are sent exactly as they are configured

#### Scenario: Additional instructions do not make an action available
- **WHEN** a profile has no Archive prompt but additional Archive instructions, and a change is in `Done`
- **THEN** Archive is still not offered for that change, an Archive request is still refused with the reason that the agent has no Archive prompt, and the additional instructions are not sent

#### Scenario: Unknown placeholder is refused
- **WHEN** additional Implement instructions containing `{repo}` are saved
- **THEN** the response is `400` naming that field, and the stored configuration is unchanged

#### Scenario: Placeholder in additional Integrate instructions is refused
- **WHEN** additional Integrate instructions containing `{change}` are saved
- **THEN** the response is `400` naming that field, and the stored configuration is unchanged

#### Scenario: Permission bypass is refused
- **WHEN** additional Draft instructions asking the agent to run with `--dangerously-skip-permissions` are saved
- **THEN** the response is `400` naming that field, and the stored configuration is unchanged

#### Scenario: Prompt sent into a running session
- **WHEN** a session for `cache-api-calls` is running and the Implement prompt is sent into it, with additional Implement instructions configured
- **THEN** the composed prompt, including those instructions, is what is typed into the terminal under the rules for text sent on the user's behalf

### Requirement: A session is the agent's own terminal
A session SHALL run the agent attached to a pseudo-terminal, and the session panel SHALL show that terminal: what the agent prints is displayed as the agent rendered it, and what the user types is delivered to the agent unchanged. The dashboard MUST NOT parse, summarise or filter the agent's output, with one exception: after typing text on the user's behalf it MAY check whether that same text appeared in the terminal, solely to decide whether to press Enter. It MUST NOT derive anything else from the output, MUST NOT classify the agent's state from it, and MUST NOT store, log or forward what it observed for that check. Keystrokes typed by the user MUST NOT be observed in this way. The agent's own prompts — including its permission and trust questions — SHALL be answered by the user in the terminal. The terminal SHALL follow the size of the panel. Several viewers MAY be attached to one session at once; a viewer that attaches later SHALL first receive what the terminal has shown so far (bounded), then follow live. Closing the panel MUST NOT end the session.

#### Scenario: Typing reaches the agent
- **WHEN** the user types a follow-up instruction into the session's terminal and presses Enter
- **THEN** the agent receives exactly those keystrokes and its response appears in the terminal

#### Scenario: The agent asks for permission
- **WHEN** the agent asks whether it may run a command
- **THEN** its question appears in the terminal as it would in any terminal and the user's keystroke answers it

#### Scenario: Reattaching
- **WHEN** the user closes the session panel and opens it again, or opens the same session in a second tab
- **THEN** the terminal shows the earlier output and continues live; the agent was not interrupted

#### Scenario: Output is not interpreted
- **WHEN** the agent prints that it is waiting for input, or prints an error
- **THEN** the dashboard shows that output in the terminal and derives nothing from it

### Requirement: Text sent on the user's behalf is submitted only after the agent showed it
Whenever the dashboard sends text to an agent's terminal on the user's behalf and is meant to submit it — a default response, the Ship prompt, or an opening prompt that is typed after start-up — it SHALL first write the text without Enter, then wait until the terminal's output produced after that write shows the text, and only then press Enter, as a separate key press after a short pause. If the text does not appear within a bounded time, the dashboard MUST NOT press Enter or send any other key; the text SHALL be left as typed. Whether the text appeared SHALL be decided independently of how the agent draws it: escape sequences and whitespace, including line wrapping, MUST be disregarded, and for long text a leading portion SHALL be sufficient. Submissions to one session SHALL be processed one after another. When a text was typed but not submitted, the dashboard SHALL tell the user so, stating that nothing was confirmed; it MUST NOT fail silently. The mechanism MUST NOT depend on any particular agent.

#### Scenario: Text prompt
- **WHEN** the agent waits at a text prompt that shows typed characters, and the dashboard submits `Yes, go ahead`
- **THEN** the text is typed, the terminal shows it, Enter is pressed as a separate key press, and the agent receives the answer

#### Scenario: Selection menu
- **WHEN** the agent shows a selection menu with an option highlighted, and the dashboard submits any text
- **THEN** the typed text does not appear, no Enter is pressed, the highlighted option is not confirmed, the session keeps running, and the user is told that the text was typed but not sent

#### Scenario: Long prompt
- **WHEN** the dashboard submits a prompt of several hundred characters that the agent wraps over several lines of its input box
- **THEN** the prompt is recognised as shown, Enter is pressed separately, and the agent starts working on it instead of leaving it in the input box

#### Scenario: Agent that redraws with escape sequences
- **WHEN** the agent renders the typed text interleaved with cursor movement and colour sequences
- **THEN** the text is still recognised as shown

#### Scenario: Two submissions at once
- **WHEN** two texts are submitted to the same session within the same moment
- **THEN** the second is typed only after the first has been submitted or given up, and their characters never interleave

#### Scenario: A line-based agent
- **WHEN** the agent is a line-based program whose terminal echoes input
- **THEN** the echoed text counts as shown and the line is submitted

### Requirement: Every session works in its own git worktree, created by the dashboard
In a git repository a session MUST NOT run in the repository's main checkout. Before starting the agent, the dashboard SHALL ensure a git worktree for the session under `~/.openspec-dashboard/worktrees/<repository id>/`, outside the repository's working tree, on branch `feat/<change>` — or, for **Archive**, in a worktree and branch of its own (`archive-<change>`, `chore/archive-<change>`). An existing worktree for that name SHALL be reused; an existing branch SHALL be checked out; otherwise the branch SHALL be created from the repository's default branch as currently known locally (`origin/HEAD`, else `HEAD`). As the one exception, when a Draft or Implement session's branch `feat/<change>` is already checked out in another linked worktree of the repository, the session SHALL adopt that worktree — run the agent there instead of creating one — and SHALL record and show that the worktree was adopted. The dashboard MUST NOT contact a remote for this. If the change's directory is missing from the session's worktree, the dashboard SHALL copy it from the checkout the change's data comes from (the main checkout or a linked worktree), including when it exists there only uncommitted. The main checkout's branch, index and working tree MUST NOT be changed. The session record and panel SHALL show the worktree path and branch.

A tracked folder that holds an `openspec/` tree but is **not a git repository** is a supported repository, and its sessions SHALL run **in place**: the agent's working directory SHALL be the repository folder itself, no worktree SHALL be created, no branch SHALL be made, and no git command SHALL be run for the session. Whether a session runs in place SHALL be decided from the repository's own scan result, never by attempting a git command and reacting to its failure. An in-place session SHALL be recorded as such and MUST NOT carry a branch. The panel SHALL name the folder the agent runs in and SHALL state plainly that the agent edits the tracked folder directly, with no branch, no commit and no undo. Session starters MUST NOT be hidden or disabled because a repository is not a git repository.

An **integration session** — the session started by **Integrate** for a repository that is not tracked and has no `openspec/` tree — is the second in-place case and the only one in a git repository. It SHALL run in place under exactly the rules of the paragraph above: the repository folder is the working directory, no worktree, no branch, no git command for the session, recorded as in place, with the same panel wording. The reason it does not get a worktree is that its whole purpose is to leave `openspec/config.yaml` in the checkout the user works in; on a branch in a worktree the marker would never appear where discovery looks. Whether a session runs in place SHALL still be decided from what the dashboard already knows about the folder, never by attempting a git command and reacting to its failure.

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

### Requirement: Session lifecycle and control
A session SHALL be `running` while its agent process lives, `exited` with the process's exit code once it has ended, or `failed` when the agent could not be started. At most one session per change may be running, and no two sessions may run in the same worktree. A request to open a session for a change that already has one running SHALL return that running session and SHALL start no second process, create no second worktree and send nothing to a terminal, whatever action was asked for — **Archive** included, so one change never has two consoles. The refusals an opening is subject to still come first, so an action the change's stage does not allow is refused rather than answered with the running session. Where a session runs in place, in a tracked folder that is not a git repository, the same rule keeps a second agent out of that folder. **End session** SHALL terminate the agent as closing its terminal window would (hang-up, then a forced kill if it does not exit). When the agent's profile has a resume command, an ended session SHALL offer **Resume**, which starts that command in the same worktree within the same session. Because a terminal cannot outlive the process that owns it, stopping the dashboard MUST end every agent, and sessions recorded as running at start-up MUST be shown as ended with that reason.

#### Scenario: Duplicate open
- **WHEN** a session for a change is running and the same starter is used again
- **THEN** the existing session is returned and no second process is started

#### Scenario: Archive next to a running session
- **WHEN** a change's Implement session is still running, the change is in `Done`, and Archive is opened for it
- **THEN** no second session starts: the running session is returned, no archive worktree or branch is created, and Archive can instead be sent into that session

#### Scenario: A folder without git keeps one agent
- **WHEN** a session is running for a change in a tracked folder that has no `.git`, and Archive is opened for that change
- **THEN** the running session is returned and no second agent is started in that folder

#### Scenario: Agent exits
- **WHEN** the user quits the agent from within the terminal
- **THEN** the session becomes `exited` with the exit code, every attached viewer is told, and the terminal's output remains viewable

#### Scenario: Resume
- **WHEN** an ended session's agent has the resume command `claude`, `--continue` and the user presses Resume
- **THEN** that command is started in the session's worktree and the session is `running` again

#### Scenario: Dashboard stopped
- **WHEN** the dashboard receives a termination signal while a session is running
- **THEN** the agent is ended and the session is recorded as ended because the dashboard was stopped

### Requirement: Configured shortcuts can be sent to a running session
The session panel SHALL offer the configured shortcuts next to the terminal, in their configured order. A shortcut is a
**title**, shown on its control, and a **prompt**, which is the text sent to the agent; the two are independent and the
title SHALL NOT be sent. The shortcuts SHALL be preceded by the visible label `Shortcuts:`, which is not itself a
control and SHALL serve as the accessible name of the group. Activating a shortcut SHALL send it to the agent with one
activation: exactly its prompt SHALL be submitted to the agent's terminal under the rules for text sent on the user's
behalf, so that it is submitted where the agent shows a text prompt and is only typed, never confirmed, where it does
not. The dashboard MUST NOT add to or alter the prompt, MUST NOT substitute anything into it, and MUST NOT interpret the
agent's output to decide which shortcuts to offer. Shortcuts SHALL be offered only while the session is running and its
terminal is connected, and SHALL be the same for every kind of session and every agent profile. Each shortcut SHALL
state, as its tooltip or accessible description, the prompt that will be sent. When no shortcuts are configured, neither
the label nor any control SHALL be shown. After activation, keyboard focus SHALL return to the terminal, and the same
shortcut MUST NOT be sent a second time while its first activation is still in progress. When a prompt was typed but not
submitted, the panel SHALL say so next to the shortcuts. Typed input SHALL keep working exactly as before.

#### Scenario: One click answers the agent
- **WHEN** a session is running, the agent waits at its text prompt, and the user activates the shortcut titled `Yes, go ahead` whose prompt is `Yes, go ahead`
- **THEN** the agent receives `Yes, go ahead` as a submitted answer without any further key press, and keyboard focus is in the terminal

#### Scenario: The title is not the prompt
- **WHEN** a shortcut titled `Ship it` has the prompt `Commit the work, push the branch and open a pull request; ask me before force-pushing.` and the user activates it
- **THEN** the agent receives exactly that prompt as a submitted answer, the title is sent nowhere, and the control shows `Ship it` with the prompt as its tooltip

#### Scenario: A response never confirms a menu
- **WHEN** the agent shows a selection menu with an option highlighted and the user activates any shortcut
- **THEN** no Enter is sent, the highlighted option is not confirmed, the session keeps running, and the panel says that the text was typed but not sent

#### Scenario: The set and its order
- **WHEN** the configuration lists the shortcuts `Review`, `Yes, go ahead` and `No, stop here` in that order and the panel of a running, connected session is open
- **THEN** it offers exactly those three, in that order, and no others

#### Scenario: Nothing configured
- **WHEN** the configured list of shortcuts is empty and the panel of a running, connected session is open
- **THEN** no shortcut controls and no `Shortcuts:` label are shown, and typing into the terminal still works

#### Scenario: The row is labelled
- **WHEN** the panel of a running, connected session is open and at least one shortcut is configured
- **THEN** the label `Shortcuts:` is shown in front of the first shortcut, activating it sends nothing, and assistive technology announces the group as "Shortcuts"

#### Scenario: Asking the agent to resolve conflicts
- **WHEN** a session is running, the agent waits at its text prompt, and the user activates the shortcut whose prompt is `Resolve PR conflicts`
- **THEN** the agent receives exactly `Resolve PR conflicts` as a submitted answer, and the dashboard runs no git command and contacts no remote because of it

#### Scenario: Not offered when the session is not running
- **WHEN** the agent has exited, or the session failed to start
- **THEN** no shortcuts and no `Shortcuts:` label are shown

#### Scenario: Not offered while disconnected
- **WHEN** the session is running but the panel's terminal connection is not open
- **THEN** no shortcuts are offered until the terminal is connected again

#### Scenario: Double activation
- **WHEN** the user double-clicks a shortcut
- **THEN** the agent receives its prompt once

#### Scenario: Keep typing
- **WHEN** the user has sent a shortcut and then types on the keyboard without clicking anything
- **THEN** the keystrokes go to the terminal

#### Scenario: Any agent
- **WHEN** the session runs an agent from a user-defined profile rather than the preconfigured one, or is the main console or an Integrate session
- **THEN** the same configured shortcuts are offered and sent in the same way

### Requirement: Shortcuts are configurable, with the shipped set as the default
Shortcuts SHALL be part of the dashboard's own configuration, not built in. Each SHALL have a stable identifier, a
title and a prompt. The configuration SHALL be accepted only when every title is non-empty after trimming and short
enough to read on a control, every prompt is non-empty after trimming and a **single line** without control characters,
every identifier is unique, and no prompt carries permission-bypass wording — the same rule that applies to every other
prompt the dashboard sends to an agent. A prompt SHALL support no placeholder: it is sent exactly as written. An empty
list SHALL be valid. A configuration that does not mention shortcuts at all — every configuration saved before they
became configurable — SHALL be read as carrying the shipped defaults, which SHALL be, in this order, `Yes, go ahead`,
`Yes, create a PR`, `Resolve PR conflicts` and `No, stop here`, each with its title as its prompt. A user's saved list
SHALL never be replaced or extended by the dashboard, not even when the shipped defaults change.

#### Scenario: A configuration from before shortcuts were configurable
- **WHEN** the dashboard loads a saved configuration that has no shortcuts
- **THEN** the loaded configuration carries the four shipped defaults in their order, and the console offers exactly them

#### Scenario: A saved list is left alone
- **WHEN** a saved configuration lists two shortcuts of the user's own and none of the shipped ones
- **THEN** the loaded configuration carries exactly those two, and no default is added back

#### Scenario: An empty list is kept
- **WHEN** the user saves a configuration with no shortcuts
- **THEN** it is accepted and reloading the dashboard still shows no shortcuts

#### Scenario: A prompt spanning several lines is refused
- **WHEN** a configuration is saved with a shortcut whose prompt contains a line break
- **THEN** the save is refused with a message naming that shortcut's prompt, and the stored configuration is unchanged

#### Scenario: An empty title is refused
- **WHEN** a configuration is saved with a shortcut whose title is blank or only spaces
- **THEN** the save is refused and the stored configuration is unchanged

#### Scenario: Bypass wording is refused
- **WHEN** a configuration is saved with a shortcut prompt that tells an agent to skip its permission checks
- **THEN** the save is refused, exactly as for an agent's other prompts

### Requirement: Shortcuts are edited in the Agent sessions settings
The Settings page SHALL let the user manage shortcuts within its **Agent sessions** section, without adding a section of
its own. The section SHALL list the configured shortcuts in their order and allow, for each, editing its title and its
prompt, removing it, and moving it earlier or later in the order; it SHALL allow adding a shortcut and restoring the
shipped defaults. The prompt SHALL be presented as the text that will be sent to the agent and the title as what the
control will read. Edits SHALL take part in the page's single draft and save bar like every other setting: they survive
navigating between sections, count towards "unsaved changes", and reach the configuration only when the page is saved.
A refused save SHALL keep the user's edits in the page and say what is wrong.

#### Scenario: Editing a title and a prompt
- **WHEN** the user renames a shortcut to `Ship it`, replaces its prompt with two sentences on one line, and saves
- **THEN** the configuration carries that title and prompt, and the console's control reads `Ship it` and sends the prompt

#### Scenario: Adding a shortcut
- **WHEN** the user adds a shortcut, gives it a title and a prompt, and saves
- **THEN** it appears last in the console's shortcuts and sends its prompt

#### Scenario: Reordering
- **WHEN** the user moves the last shortcut to the first position and saves
- **THEN** the console offers the shortcuts in the new order

#### Scenario: Removing all of them
- **WHEN** the user removes every shortcut and saves
- **THEN** the save is accepted and the console shows no shortcut row

#### Scenario: Restoring the defaults
- **WHEN** the user has changed the shortcuts, activates the restore control, and saves
- **THEN** the configuration carries exactly the four shipped defaults in their order

#### Scenario: Edits survive navigation
- **WHEN** the user edits a shortcut's prompt, navigates to another section and back
- **THEN** the edited prompt is still in the field and the save bar still shows "unsaved changes"

### Requirement: Status shown for a session is limited to what a terminal can tell
The dashboard SHALL show a session as running, ended (with a non-zero exit code or an error highlighted) or failed, and SHALL record when the terminal last produced output.

A running session SHALL be shown in one of two named states, decided **only** by how long ago its terminal last produced output:

- while output arrived within the silence threshold, a state that says the terminal is producing output;
- once the terminal has been silent for longer than the threshold, a state that says the session may need the user, together with how long the silence has lasted.

The silence threshold SHALL be short enough that a session blocked on a question is surfaced within seconds rather than after a minute, and SHALL be at most 30 seconds. Both states SHALL be equally prominent wherever a running session's status is shown, and SHALL be told apart by their words, not by colour or motion alone. The state that says the session may need the user SHALL be phrased as a possibility, never as a fact.

The decision MUST NOT use anything but the time of the last output: the agent's output MUST NOT be read, parsed, matched or classified for it, and nothing vendor-specific SHALL be introduced. The dashboard MUST NOT claim to know that an agent is waiting, working, or how much it has cost.

#### Scenario: Terminal is producing output
- **WHEN** a running session's terminal printed something within the silence threshold
- **THEN** its badge reads as the producing-output state, and does not suggest that the user is needed

#### Scenario: Terminal falls silent
- **WHEN** a running session's terminal has printed nothing for longer than the silence threshold
- **THEN** its badge changes, within one refresh, to the state that says the session may need the user, and states how long the terminal has been silent

#### Scenario: Quiet terminal
- **WHEN** a running session's terminal has printed nothing for ten minutes
- **THEN** its badge says the session may need the user and that the terminal has been silent for 10 minutes

#### Scenario: Output resumes
- **WHEN** the terminal of a session shown as possibly needing the user prints something again
- **THEN** its badge returns to the producing-output state and the silence duration is dropped

#### Scenario: Both states readable without colour
- **WHEN** either running state is shown with colour and motion removed
- **THEN** the two states are still told apart by their words

#### Scenario: Status on a board card
- **WHEN** a change's card carries a chip for a running session
- **THEN** that chip shows which of the two running states the session is in

#### Scenario: The dashboard does not claim to know
- **WHEN** an agent is in fact busy but has printed nothing for longer than the threshold
- **THEN** the dashboard still shows the possibly-needs-you state, worded as a possibility, and never asserts that the agent is waiting or working

### Requirement: Session records live outside repositories
Session metadata SHALL be stored only under `~/.openspec-dashboard/sessions/<session-id>/`, written atomically and readable by the user only; when a session ends, the bounded tail of its terminal output SHALL be stored there too, so that an ended session still shows what happened. The dashboard SHALL keep the newest 50 ended sessions, and a session's record SHALL be deletable from the UI once it has ended.

#### Scenario: Looking at an ended session
- **WHEN** the user opens the panel of a session that ended before the dashboard was restarted
- **THEN** the stored terminal output is shown and no input is accepted

### Requirement: Worktree clean-up is offered only when safe
When ending or cleaning up a session, or for a worktree that has no session record, the dashboard SHALL offer to remove the worktree only if the dashboard created it, it has no uncommitted changes, and either its work status is `merged` or it has no commits that exist nowhere else (nothing ahead of its upstream, or, without an upstream, no commit that is unreachable from every other local or remote-tracking branch). Removal SHALL happen only after the user confirms, by a non-forcing `git worktree remove`; the branch is never deleted. Otherwise the worktree MUST be kept and the reason shown. A worktree MUST NOT be removed while a session is running in it. A worktree that a session adopted MUST NOT be offered for removal and MUST NOT be removed by the dashboard. An in-place session has no worktree: removal MUST NOT be offered for it, and ending it SHALL end the agent and nothing else.

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

#### Scenario: Ending an in-place session
- **WHEN** the user ends a session that ran in a folder that is not a git repository
- **THEN** the dialog offers neither a worktree removal nor a pull, and confirming ends the agent and leaves the folder untouched

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
For a session whose worktree has status `uncommitted`, `unpushed` or `pushed` the dashboard SHALL offer a Ship action. It uses the agent profile's Ship prompt, or an agent-neutral default asking to commit with a conventional message, push the branch, open a pull request against the default branch if none exists, not to merge it, and to report its URL. When the session is running the prompt SHALL be submitted to its terminal under the rules for text sent on the user's behalf, so that one activation sends it; otherwise the agent SHALL be started in the session's worktree — with its resume command and the prompt submitted after start-up when it has one, else with its command and the prompt as opening prompt — in the same session record, under the same checks as resuming. The result of Ship SHALL state whether the prompt was submitted, and when it was only typed the panel SHALL say so. The dashboard itself MUST NOT commit, push, or contact a remote. An in-place session has no worktree and no branch: it has no work status, Ship MUST NOT be offered for it, and a Ship request for it SHALL be refused.

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

### Requirement: Any available action can be sent to the change's running session
For a running session of a change the dashboard SHALL be able to send the opening prompt of any starter to that session instead of opening a new one, under the same conditions as opening: the action must be available in the change's current stage and the session's agent must have a prompt for it. Every action qualifies, **Archive** included — it is how a completed change is archived without ending the agent that worked on it — and the action the session itself was started with SHALL NOT restrict what may be sent to it. The prompt SHALL be submitted to the session's terminal under the rules for text sent on the user's behalf, so that one activation sends it where the agent shows a text prompt and it is only typed, never confirmed, where it does not. The result SHALL state whether the prompt was submitted, and when it was only typed the dashboard SHALL say so as it does for any other text sent on the user's behalf. The session's recorded action SHALL become the one sent, whether or not the prompt was submitted. Nothing SHALL be sent to a session that is not running, and sending a prompt SHALL create no worktree, run no git command and start no process.

#### Scenario: Draft finished, Implement next
- **WHEN** a Draft session is still running, the change has reached `Ready`, and Implement is sent to it
- **THEN** the agent's Implement prompt for that change is typed into the terminal, Enter is pressed as a separate key press once the terminal shows it, the agent receives the prompt without any further key press from the user, no second process is started, and the session's action is `implement`

#### Scenario: Archive goes into the running session
- **WHEN** a change is in `Done`, its session is still running, and Archive is sent to it
- **THEN** the agent's Archive prompt for that change is submitted to that terminal, no second session is opened and no worktree is created, and the session's action is `archive`

#### Scenario: An archiving session takes the next step
- **WHEN** a change's only running session was started as Archive, the change's stage still allows Validate, and Validate is sent to it
- **THEN** the prompt is submitted to that same session and no second session is opened

#### Scenario: The agent shows a selection menu
- **WHEN** Implement is sent to a running session whose agent shows a selection menu with an option highlighted
- **THEN** no Enter is pressed, the highlighted option is not confirmed, the session keeps running, the result says the prompt was not submitted, and the dashboard tells the user that it was typed but not sent

#### Scenario: Stage does not allow it
- **WHEN** Implement is sent to a running session of a change that still lacks artifacts
- **THEN** the request is refused and nothing is written to the terminal

#### Scenario: The session has ended
- **WHEN** a starter's prompt is sent to a session that is no longer running
- **THEN** the request is refused, nothing is written to the terminal and no process is started

### Requirement: Ending a session also offers to pull the repository
Wherever the dashboard offers to remove a session's worktree when the session ends, it SHALL — for a repository the
pull action can run in, meaning a tracked git repository that was scanned without error — also offer to pull that
repository, so that the main checkout the dashboard reads archives, specs and progress from catches up with work that
was merged. The offer SHALL be pre-selected exactly when the worktree's work status is `merged`, and SHALL be
unselected otherwise; it SHALL be shown whether or not the worktree itself can be removed. When the user confirms with
the offer selected, the pull SHALL run after the session has ended and after the worktree was removed, and SHALL be
the same action the repository's own Pull control runs, with the same safety rules and the same outcomes. A pull that
is already running for that repository SHALL NOT be started a second time. Nothing SHALL be pulled when the offer is
not selected, when the user cancels, or for a repository the pull action cannot run in.

#### Scenario: Merged work, pull pre-selected
- **WHEN** the user ends a session whose worktree's work status is `merged`, in a tracked git repository
- **THEN** the dialog offers both the worktree removal and the pull, both already selected

#### Scenario: Confirming pulls after the worktree is gone
- **WHEN** the user confirms with both offers selected
- **THEN** the session ends, the worktree is removed, and only then is the repository fetched and fast-forwarded

#### Scenario: Unshipped work
- **WHEN** the user ends a session whose worktree has commits that exist only on its branch
- **THEN** the pull is offered but not selected, and ending the session pulls nothing

#### Scenario: Offer declined
- **WHEN** the user clears the pull offer and confirms
- **THEN** the session ends and no remote is contacted

#### Scenario: Cancelled dialog
- **WHEN** the user cancels the dialog while the pull offer is selected
- **THEN** nothing is ended, removed or pulled

#### Scenario: Not a repository the pull action can run in
- **WHEN** the session's repository is not a git repository, or its last scan failed
- **THEN** no pull is offered and ending the session pulls nothing

### Requirement: A pull the user needs to know about is stated before the dialog closes
When a pull started from the end-session dialog leaves the main checkout behind — it only fetched, was refused, or
failed — the dialog SHALL stay open, SHALL name that outcome with git's reason available, and SHALL say that the
session has already ended, so that the user learns the view may still be outdated. A pull that fast-forwarded the
checkout, found it already up to date, or found the repository has no remote to pull from SHALL close the
dialog. While the pull runs the dialog SHALL show that it is
running and SHALL NOT accept a second confirmation. The outcome SHALL also be reported next to the repository's own
Pull control, as any other pull's is.

#### Scenario: Refused pull
- **WHEN** the pull is refused because local and remote history have diverged
- **THEN** the dialog stays open, says the pull was refused and why, and says the session has ended

#### Scenario: Failed pull
- **WHEN** the remote cannot be reached
- **THEN** the dialog stays open with git's reason, and the session and the worktree removal are unaffected

#### Scenario: Successful pull
- **WHEN** the pull fast-forwards the main checkout by two commits
- **THEN** the dialog closes, the board shows the repository's new state without a page reload, and `+2 commits` is
  reported next to the repository's Pull control

#### Scenario: While it runs
- **WHEN** the pull started from the dialog has not finished
- **THEN** the dialog shows that it is running and confirming again starts nothing
