# Spec Delta

## MODIFIED Requirements

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
