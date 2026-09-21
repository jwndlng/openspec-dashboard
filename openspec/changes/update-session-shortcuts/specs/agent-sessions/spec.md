# Spec Delta

## MODIFIED Requirements

### Requirement: A starter's prompt can be sent to a running session
For a running session in a change's own worktree the dashboard SHALL be able to send the opening prompt of the Draft or Implement starter to that session instead of opening a new one, under the same conditions as opening: the action must be available in the change's current stage and the session's agent must have a prompt for it. The prompt SHALL be submitted to the session's terminal under the rules for text sent on the user's behalf, so that one activation sends it where the agent shows a text prompt and it is only typed, never confirmed, where it does not. The result SHALL state whether the prompt was submitted, and when it was only typed the dashboard SHALL say so as it does for any other text sent on the user's behalf. The session's recorded action SHALL become the one sent, whether or not the prompt was submitted. Archive MUST NOT be sent to a session in the change's own worktree, and nothing SHALL be sent to a session that is not running.

#### Scenario: Draft finished, Implement next
- **WHEN** a Draft session is still running, the change has reached `Ready`, and Implement is sent to it
- **THEN** the agent's Implement prompt for that change is typed into the terminal, Enter is pressed as a separate key press once the terminal shows it, the agent receives the prompt without any further key press from the user, no second process is started, and the session's action is `implement`

#### Scenario: The agent shows a selection menu
- **WHEN** Implement is sent to a running session whose agent shows a selection menu with an option highlighted
- **THEN** no Enter is pressed, the highlighted option is not confirmed, the session keeps running, the result says the prompt was not submitted, and the dashboard tells the user that it was typed but not sent

#### Scenario: Stage does not allow it
- **WHEN** Implement is sent to a running session of a change that still lacks artifacts
- **THEN** the request is refused and nothing is written to the terminal

#### Scenario: Archive is not typed into the feature worktree
- **WHEN** Archive is sent to a running session in the change's own worktree
- **THEN** the request is refused
