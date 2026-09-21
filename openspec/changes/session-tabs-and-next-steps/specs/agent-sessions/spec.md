## ADDED Requirements

### Requirement: A starter's prompt can be sent to a running session
For a running session in a change's own worktree the dashboard SHALL be able to send the opening prompt of the Draft or Implement starter to that session instead of opening a new one, under the same conditions as opening: the action must be available in the change's current stage and the session's agent must have a prompt for it. The prompt SHALL be written to the terminal as input **without a trailing Enter**, because the dashboard cannot know whether the agent shows a text prompt or a selection menu; sending it is the user's keystroke. The session's recorded action SHALL become the one sent. Archive MUST NOT be sent to a session in the change's own worktree, and nothing SHALL be sent to a session that is not running.

#### Scenario: Draft finished, Implement next
- **WHEN** a Draft session is still running, the change has reached `Ready`, and Implement is sent to it
- **THEN** the agent's Implement prompt for that change appears in the terminal as typed input, no Enter is sent, no second process is started, and the session's action is `implement`

#### Scenario: Stage does not allow it
- **WHEN** Implement is sent to a running session of a change that still lacks artifacts
- **THEN** the request is refused and nothing is written to the terminal

#### Scenario: Archive is not typed into the feature worktree
- **WHEN** Archive is sent to a running session in the change's own worktree
- **THEN** the request is refused

## MODIFIED Requirements

### Requirement: Session lifecycle and control
A session SHALL be `running` while its agent process lives, `exited` with the process's exit code once it has ended, or `failed` when the agent could not be started. At most one session per worktree may be running; a request to open another for the same worktree SHALL return the running one. Because archiving has a worktree of its own, an Archive session MAY run next to the change's other session. **End session** SHALL terminate the agent as closing its terminal window would (hang-up, then a forced kill if it does not exit). When the agent's profile has a resume command, an ended session SHALL offer **Resume**, which starts that command in the same worktree within the same session. Because a terminal cannot outlive the process that owns it, stopping the dashboard MUST end every agent, and sessions recorded as running at start-up MUST be shown as ended with that reason.

#### Scenario: Duplicate open
- **WHEN** a session for a change is running and the same starter is used again
- **THEN** the existing session is returned and no second process is started

#### Scenario: Archive next to a running session
- **WHEN** a change's Implement session is still running, the change is in `Done`, and Archive is started
- **THEN** a second session starts in the archive worktree on `chore/archive-<change>` and the first keeps running

#### Scenario: Agent exits
- **WHEN** the user quits the agent from within the terminal
- **THEN** the session becomes `exited` with the exit code, every attached viewer is told, and the terminal's output remains viewable

#### Scenario: Resume
- **WHEN** an ended session's agent has the resume command `claude`, `--continue` and the user presses Resume
- **THEN** that command is started in the session's worktree and the session is `running` again

#### Scenario: Dashboard stopped
- **WHEN** the dashboard receives a termination signal while a session is running
- **THEN** the agent is ended and the session is recorded as ended because the dashboard was stopped
