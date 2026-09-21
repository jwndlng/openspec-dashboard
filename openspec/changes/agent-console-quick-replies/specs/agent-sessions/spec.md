## ADDED Requirements

### Requirement: Default responses can be sent to a running session
The session panel SHALL offer a set of default responses next to the terminal. The initial set SHALL be, in this order, `Yes, go ahead`, `Yes, create a PR` and `No, stop here`. Activating a response SHALL deliver exactly its text to the agent's terminal through the same input path as typed keystrokes, so that the agent receives it as if the user had typed it, and MUST NOT press Enter or send any other key on the user's behalf: the dashboard cannot know whether the agent is showing a text prompt or a selection menu, and in a menu Enter would confirm whichever option is highlighted. The user sends the response by pressing Enter in the terminal. The dashboard MUST NOT add to, alter or interpret the text, and MUST NOT interpret the agent's output to decide which responses to offer. Default responses SHALL be offered only while the session is running and its terminal is connected. Each response SHALL state, as its tooltip or accessible description, what will be typed and that Enter sends it. After a response is sent, keyboard focus SHALL return to the terminal, and activating the same response again within a short moment MUST NOT send it a second time. Typed input SHALL keep working exactly as before.

#### Scenario: One click and Enter answer the agent
- **WHEN** a session is running, the agent waits at its text prompt, and the user activates `Yes, go ahead` and then presses Enter
- **THEN** the text `Yes, go ahead` appears at the agent's prompt after the click, keyboard focus is in the terminal, and the agent receives the answer when Enter is pressed

#### Scenario: A response never confirms a menu
- **WHEN** the agent shows a selection menu with an option highlighted and the user activates any default response
- **THEN** no Enter is sent, the highlighted option is not confirmed, and the session keeps running

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
- **THEN** the text is typed once

#### Scenario: Keep typing
- **WHEN** the user has sent a default response and then types on the keyboard without clicking anything
- **THEN** the keystrokes go to the terminal

#### Scenario: Any agent
- **WHEN** the session runs an agent from a user-defined profile rather than the preconfigured one
- **THEN** the same default responses are offered and delivered in the same way
