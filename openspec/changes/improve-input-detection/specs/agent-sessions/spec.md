## MODIFIED Requirements

### Requirement: Status shown for a session is limited to what a terminal can tell
The dashboard SHALL show a session as running, ended (with a non-zero exit code or an error highlighted) or failed, and SHALL record when the terminal last produced output that counts as activity.

Output **counts as activity** unless it arrives within the echo window after the dashboard resized the session's terminal or passed input to it — a viewer's keystrokes, input the browser terminal generates by itself (focus reports, replies to the agent's queries), or text submitted on the user's behalf. The echo window SHALL be at most 3 seconds after the latest such event. Output inside the window SHALL still be relayed to every viewer and kept in the scrollback unchanged; it only does not move the time of the last output. Attaching, resizing, focusing or detaching a viewer therefore MUST NOT change a session's state.

A running session for which the agent has not reported a state (see "An agent can report its state through a file") SHALL be shown in one of two named states, decided **only** by how long ago its terminal last produced output that counts as activity:

- while such output arrived within the silence threshold, a state that says the terminal is producing output;
- once the terminal has been silent for longer than the threshold, a state that says the session may need the user, together with how long the silence has lasted.

The silence threshold SHALL be short enough that a session blocked on a question is surfaced within seconds rather than after a minute, and SHALL be at most 30 seconds. Every running state SHALL be equally prominent wherever a running session's status is shown, and SHALL be told apart by their words, not by colour or motion alone. The state that says the session may need the user SHALL be phrased as a possibility, never as a fact.

The decision MUST NOT use anything but the times of the output that counts, of the dashboard's own resizes and input, and the agent's report: the agent's output MUST NOT be read, parsed, matched or classified for it, and nothing vendor-specific SHALL be introduced. The dashboard MUST NOT claim on its own to know that an agent is waiting, working, or how much it has cost; a reported state SHALL be shown as the agent's report.

#### Scenario: Terminal is producing output
- **WHEN** a running session's terminal printed something that counts as activity within the silence threshold
- **THEN** its badge reads as the producing-output state, and does not suggest that the user is needed

#### Scenario: Terminal falls silent
- **WHEN** a running session's terminal has printed nothing that counts as activity for longer than the silence threshold
- **THEN** its badge changes, within one refresh, to the state that says the session may need the user, and states how long the terminal has been silent

#### Scenario: Quiet terminal
- **WHEN** a running session's terminal has printed nothing for ten minutes
- **THEN** its badge says the session may need the user and that the terminal has been silent for 10 minutes

#### Scenario: Output resumes
- **WHEN** the terminal of a session shown as possibly needing the user prints something again that counts as activity
- **THEN** its badge returns to the producing-output state and the silence duration is dropped

#### Scenario: Opening the console does not wake the badge
- **WHEN** a session has been shown as possibly needing the user for two minutes, and the user opens its console, so that the terminal is resized and focused and the agent redraws its screen
- **THEN** the redraw is shown in the terminal, and the badge still says the session may need the user and that the terminal has been silent for two minutes

#### Scenario: Typing is not the agent working
- **WHEN** the user types into a silent session's terminal and the agent echoes the keystrokes
- **THEN** the echo does not count as activity; output the agent produces after the echo window does

#### Scenario: Work that outlasts the echo window counts
- **WHEN** the user presses Enter in a session's terminal and the agent prints output continuously for a minute
- **THEN** the badge shows the producing-output state once output arrives after the echo window

#### Scenario: Both states readable without colour
- **WHEN** any running state is shown with colour and motion removed
- **THEN** the states are still told apart by their words

#### Scenario: Status on a board card
- **WHEN** a change's card carries a chip for a running session
- **THEN** that chip shows which of the running states the session is in

#### Scenario: The dashboard does not claim to know
- **WHEN** an agent that reports no state is in fact busy but has printed nothing for longer than the threshold
- **THEN** the dashboard still shows the possibly-needs-you state, worded as a possibility, and never asserts that the agent is waiting or working

### Requirement: Session records live outside repositories
Session metadata SHALL be stored only under `~/.spec-control/sessions/<session-id>/`, written atomically and readable by the user only; when a session ends, the bounded tail of its terminal output SHALL be stored there too, so that an ended session still shows what happened. The agent's state file (see "An agent can report its state through a file") SHALL be in the same folder. The dashboard SHALL keep the newest 50 ended sessions, and a session's record SHALL be deletable from the UI once it has ended; deleting or pruning a record removes its state file with it.

#### Scenario: Looking at an ended session
- **WHEN** the user opens the panel of a session that ended before the dashboard was restarted
- **THEN** the stored terminal output is shown and no input is accepted

#### Scenario: State file goes with its record
- **WHEN** an ended session's record is deleted or pruned
- **THEN** its state file is gone as well, and nothing of it remains outside `~/.spec-control/sessions/`

## ADDED Requirements

### Requirement: An agent can report its state through a file
Every agent session — change sessions, the main console, project consoles and integrations alike — SHALL be started with the environment variable `SPEC_CONTROL_STATE_FILE` set to the absolute path of a file named for that purpose in the session's record folder. Before the agent is started or restarted, the dashboard SHALL remove any file left at that path, so a report never outlives the process that wrote it. The dashboard MUST NOT write that file otherwise, MUST NOT change the agent's configuration to write it, and MUST NOT ask the agent in a prompt to write it: wiring it up — for example in hooks the agent runs when it ends a turn or asks for permission — is the user's own configuration.

The dashboard SHALL read the file's modification time and at most its first 64 bytes, and SHALL recognise exactly two reports: `waiting` and `working`, as the whole content apart from surrounding whitespace and case. Anything else, an unreadable file, a file that is not a regular file, or a missing file SHALL be treated as no report. A report is **current** while it was written after the session's process started and after the latest input the user gave the session — keystrokes, mouse input, or text submitted on the user's behalf; input the browser terminal generates by itself (focus reports, replies to the agent's queries) and resizes MUST NOT make a report stale.

While the current report is `waiting`, a running session SHALL be shown in a state that says the agent reported that it is waiting for the user, with how long ago it reported, worded as the agent's report. While the current report is `working`, or there is no current report, the silence-based states of "Status shown for a session is limited to what a terminal can tell" SHALL apply. Reported states SHALL be read at least as often as the session list is refreshed. An ended or failed session SHALL be shown as today, whatever its last report was.

#### Scenario: Variable is set
- **WHEN** any agent session is started or resumed
- **THEN** the agent's environment contains `SPEC_CONTROL_STATE_FILE`, naming a path under `~/.spec-control/sessions/<session-id>/`, and no file exists at that path yet

#### Scenario: Agent reports waiting
- **WHEN** a running session's agent writes `waiting` into the file
- **THEN** within one refresh its badge says the agent reported that it is waiting for the user and how long ago, even while the terminal is still printing or opened in a console

#### Scenario: User answers
- **WHEN** a session shows the agent's waiting report and the user types into its terminal or the dashboard submits a shortcut to it
- **THEN** the report is no longer current and the badge falls back to the silence-based states

#### Scenario: Opening the console keeps the report
- **WHEN** a session shows the agent's waiting report and the user opens its console, so that the terminal is resized and sends a focus report
- **THEN** the badge still shows the agent's waiting report

#### Scenario: Agent resumes on its own
- **WHEN** a session shows the agent's waiting report and the agent writes `working` into the file
- **THEN** the badge falls back to the silence-based states

#### Scenario: Unrecognised content
- **WHEN** the file holds anything other than `waiting` or `working`, is larger than 64 bytes, or is a directory or a symbolic link
- **THEN** the session is shown as if it had reported nothing

#### Scenario: Agent without reports
- **WHEN** no file is ever written for a session
- **THEN** its badge behaves exactly as the silence-based states describe

#### Scenario: Report from an earlier run
- **WHEN** a session whose last report was `waiting` is resumed
- **THEN** the old report is removed before the agent starts and the resumed session shows the silence-based states until it reports again
