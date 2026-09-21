## ADDED Requirements

### Requirement: Default responses can be sent to a running session
The session panel SHALL offer a set of default responses next to the terminal. The initial set SHALL be, in this order, `Yes, go ahead`, `Yes, create a PR` and `No, stop here`. Activating a response SHALL deliver exactly its text followed by Enter to the agent's terminal through the same input path as typed keystrokes, so that the agent receives it as if the user had typed it; the dashboard MUST NOT add to, alter or interpret the text, and MUST NOT interpret the agent's output to decide which responses to offer. Default responses SHALL be offered only while the session is running and its terminal is connected. Each response SHALL state, as its tooltip or accessible description, what will be typed. After a response is sent, keyboard focus SHALL return to the terminal, and activating the same response again within a short moment MUST NOT send it a second time. Typed input SHALL keep working exactly as before.

#### Scenario: One click answers the agent
- **WHEN** a session is running, the agent has asked whether it should continue, and the user activates `Yes, go ahead`
- **THEN** the agent receives the text `Yes, go ahead` followed by Enter, the text appears in the terminal as typed input would, and the agent continues

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
- **THEN** the same default responses are offered and delivered in the same way
