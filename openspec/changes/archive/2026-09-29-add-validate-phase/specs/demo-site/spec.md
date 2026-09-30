# Spec Delta

## MODIFIED Requirements

### Requirement: Agent sessions are enabled and simulated in the demo
The demo SHALL start with agent sessions enabled and one fictional agent profile reported as available, so that session starters, the running badge, work-status badges, the Open work list and Ship are visible without the visitor changing any setting. The visitor MAY switch agent sessions off in the demo's Settings for the current page session. Starting a session for a card SHALL be validated as the dashboard validates it (tracked repository, existing unarchived change, action available in the change's stage and sub-state, one open session per change) and SHALL create a running session in memory. Resume, Ship, close, delete, worktree status and worktree removal SHALL behave as in the dashboard from the UI's point of view: Ship SHALL be refused unless the worktree's work status is shippable and SHALL end with the work status `pushed`; removing a worktree SHALL be refused, with a reason, while it holds uncommitted or unpushed work. The demo MUST NOT start a process, open a network connection or write anywhere for any of this.

The demo's data SHALL include at least one change in `Done` awaiting validation — its tasks partly `- [x]` and partly `- [~]` — so that the **Validate** badge, the three-part progress bar and the **Validate** starter are reachable in the demo, and the fictional agent profile SHALL carry a Validate prompt. A simulated **Validate** session SHALL behave as every other simulated starter does.

#### Scenario: Sessions are on by default
- **WHEN** the demo is opened for the first time
- **THEN** Settings shows agent sessions as enabled with the agent "Demo Agent" available, and cards offer session starters

#### Scenario: Switching sessions off
- **WHEN** the visitor switches agent sessions off in Settings and saves
- **THEN** starters, session badges and the Open work control disappear, and are back after a reload

#### Scenario: Starting a session
- **WHEN** the visitor starts Implement on a card in `Ready`
- **THEN** the card shows a running session, the session panel opens with a terminal, and starting it again returns the same session

#### Scenario: Action not available
- **WHEN** Implement is requested for a change that is still in `Drafts`
- **THEN** the request is refused with the same reason the dashboard gives

#### Scenario: A change awaiting validation
- **WHEN** the demo board is opened
- **THEN** the `Done` column holds a change with a **Validate** badge whose progress bar names its awaiting tasks

#### Scenario: Simulated validate session
- **WHEN** the visitor starts **Validate** on that change
- **THEN** a running session is created in memory as for any other starter, and no process is started

#### Scenario: Implement is refused for a change awaiting validation
- **WHEN** Implement is requested for the demo's change in `Done` with awaiting tasks
- **THEN** the request is refused with the same reason the dashboard gives

#### Scenario: Ship
- **WHEN** the visitor presses Ship on an ended session with 3 uncommitted files
- **THEN** the terminal plays a commit, push and pull-request transcript and the work status becomes `pushed`

#### Scenario: Unsafe removal is refused
- **WHEN** the visitor closes a session whose worktree has unpushed commits and asks to remove the worktree
- **THEN** the session ends, the worktree is kept, and the reason is shown

#### Scenario: Nothing leaves the page
- **WHEN** any session operation is used in the demo
- **THEN** no process is started and no network request is made
