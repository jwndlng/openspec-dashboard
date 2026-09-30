# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: A starter's prompt can be sent to a running session
**Reason**: It allowed only Draft and Implement into a running session and forbade Archive there, which is what made a change's second console necessary — and left a completed change with a running agent no way to be archived at all. The rule is now the same for every action, so the requirement is replaced by "Any available action can be sent to the change's running session".
**Migration**: None for users: the same controls send the same prompts the same way, with the same report when a prompt was only typed. Archive is now among them, and `POST /api/sessions/<id>/prompt` no longer refuses `archive` or a session whose own action is `archive`.
