## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Default responses can be sent to a running session
The session panel SHALL offer a set of default responses next to the terminal. The initial set SHALL be, in this order, `Yes, go ahead`, `Yes, create a PR` and `No, stop here`. Activating a response SHALL send it to the agent with one activation: exactly its text SHALL be submitted to the agent's terminal under the rules for text sent on the user's behalf, so that it is submitted where the agent shows a text prompt and is only typed, never confirmed, where it does not. The dashboard MUST NOT add to or alter the text, and MUST NOT interpret the agent's output to decide which responses to offer. Default responses SHALL be offered only while the session is running and its terminal is connected. Each response SHALL state, as its tooltip or accessible description, what will be sent. After activation, keyboard focus SHALL return to the terminal, and the same response MUST NOT be sent a second time while its first activation is still in progress. When a response was typed but not submitted, the panel SHALL say so next to the responses. Typed input SHALL keep working exactly as before.

#### Scenario: One click answers the agent
- **WHEN** a session is running, the agent waits at its text prompt, and the user activates `Yes, go ahead`
- **THEN** the agent receives `Yes, go ahead` as a submitted answer without any further key press, and keyboard focus is in the terminal

#### Scenario: A response never confirms a menu
- **WHEN** the agent shows a selection menu with an option highlighted and the user activates any default response
- **THEN** no Enter is sent, the highlighted option is not confirmed, the session keeps running, and the panel says that the text was typed but not sent

#### Scenario: The set and its order
- **WHEN** the panel of a running, connected session is open
- **THEN** it offers exactly `Yes, go ahead`, `Yes, create a PR` and `No, stop here`, in that order

#### Scenario: Not offered when the session is not running
- **WHEN** the agent has exited, or the session failed to start
- **THEN** no default responses are offered

#### Scenario: Not offered while disconnected
- **WHEN** the session is running but the panel's terminal connection is not open
- **THEN** no default responses are offered until the terminal is connected again

#### Scenario: Double activation
- **WHEN** the user double-clicks `Yes, create a PR`
- **THEN** the agent receives the response once

#### Scenario: Keep typing
- **WHEN** the user has sent a default response and then types on the keyboard without clicking anything
- **THEN** the keystrokes go to the terminal

#### Scenario: Any agent
- **WHEN** the session runs an agent from a user-defined profile rather than the preconfigured one
- **THEN** the same default responses are offered and sent in the same way

### Requirement: Ship asks the agent to commit, push and open a pull request
For a session whose worktree has status `uncommitted`, `unpushed` or `pushed` the dashboard SHALL offer a Ship action. It uses the agent profile's Ship prompt, or an agent-neutral default asking to commit with a conventional message, push the branch, open a pull request against the default branch if none exists, not to merge it, and to report its URL. When the session is running the prompt SHALL be submitted to its terminal under the rules for text sent on the user's behalf, so that one activation sends it; otherwise the agent SHALL be started in the session's worktree — with its resume command and the prompt submitted after start-up when it has one, else with its command and the prompt as opening prompt — in the same session record, under the same checks as resuming. The result of Ship SHALL state whether the prompt was submitted, and when it was only typed the panel SHALL say so. The dashboard itself MUST NOT commit, push, or contact a remote.

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

### Requirement: Session starters run a fixed prompt for a validated change
The dashboard SHALL offer the starters **Draft artifacts** (while at least one artifact of the change is not done), **Implement** (change in `Ready` or `Implementing`) and **Archive** (change in `Done`), each only when the repository's agent has an opening prompt configured for it, and none for archived changes. The opening prompt SHALL be produced from the profile's template, in which `{change}` is the only placeholder, replaced by the change name after it passed change-name validation. The agent MUST be started without a shell from an argument list; the prompt MUST reach it either as exactly one argument (where the command contains `{prompt}`) or by being submitted to its terminal after start-up under the rules for text sent on the user's behalf (where it does not). No text from the browser other than the validated change name may become part of the command line.

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
- **WHEN** an agent's command does not contain `{prompt}` and the agent shows its text prompt after start-up
- **THEN** the agent is started as given and the opening prompt is typed into its terminal and submitted with a separate Enter once the agent shows it

#### Scenario: Agent starts with a dialog instead of a prompt
- **WHEN** an agent whose opening prompt is typed shows a first-run dialog with a highlighted option after start-up
- **THEN** no Enter is pressed and the dialog is left for the user to answer in the terminal

#### Scenario: Invalid change name
- **WHEN** a session is requested for a change name containing characters outside the allowed set
- **THEN** the request is refused, no worktree is created and no process is started
