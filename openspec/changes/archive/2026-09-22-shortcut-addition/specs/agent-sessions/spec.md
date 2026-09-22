# Spec Delta

## MODIFIED Requirements

### Requirement: Default responses can be sent to a running session
The session panel SHALL offer a set of default responses next to the terminal. The set SHALL be, in this order, `Yes, go ahead`, `Yes, create a PR`, `Resolve PR conflicts` and `No, stop here`. The responses SHALL be preceded by the visible label `Shortcuts:`, which is not itself a control and SHALL serve as the accessible name of the group of responses. Activating a response SHALL send it to the agent with one activation: exactly its text SHALL be submitted to the agent's terminal under the rules for text sent on the user's behalf, so that it is submitted where the agent shows a text prompt and is only typed, never confirmed, where it does not. The dashboard MUST NOT add to or alter the text, and MUST NOT interpret the agent's output to decide which responses to offer. Default responses SHALL be offered only while the session is running and its terminal is connected. Each response SHALL state, as its tooltip or accessible description, what will be sent. After activation, keyboard focus SHALL return to the terminal, and the same response MUST NOT be sent a second time while its first activation is still in progress. When a response was typed but not submitted, the panel SHALL say so next to the responses. Typed input SHALL keep working exactly as before.

#### Scenario: One click answers the agent
- **WHEN** a session is running, the agent waits at its text prompt, and the user activates `Yes, go ahead`
- **THEN** the agent receives `Yes, go ahead` as a submitted answer without any further key press, and keyboard focus is in the terminal

#### Scenario: A response never confirms a menu
- **WHEN** the agent shows a selection menu with an option highlighted and the user activates any default response
- **THEN** no Enter is sent, the highlighted option is not confirmed, the session keeps running, and the panel says that the text was typed but not sent

#### Scenario: The set and its order
- **WHEN** the panel of a running, connected session is open
- **THEN** it offers exactly `Yes, go ahead`, `Yes, create a PR`, `Resolve PR conflicts` and `No, stop here`, in that order

#### Scenario: The row is labelled
- **WHEN** the panel of a running, connected session is open
- **THEN** the label `Shortcuts:` is shown in front of the first response, activating it sends nothing, and assistive technology announces the group of responses as "Shortcuts"

#### Scenario: Asking the agent to resolve conflicts
- **WHEN** a session is running, the agent waits at its text prompt, and the user activates `Resolve PR conflicts`
- **THEN** the agent receives exactly `Resolve PR conflicts` as a submitted answer, and the dashboard runs no git command and contacts no remote because of it

#### Scenario: Not offered when the session is not running
- **WHEN** the agent has exited, or the session failed to start
- **THEN** no default responses and no `Shortcuts:` label are shown

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
