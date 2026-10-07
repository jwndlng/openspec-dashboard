## MODIFIED Requirements

### Requirement: Project console sessions are session records outside change work
A project console session SHALL be stored, retained, listed and attached like every other session. Its record lives
under `~/.spec-control/sessions/`. It counts towards the newest 50 ended sessions kept. Its terminal is served over
the same WebSocket under the same guard, text sent on the user's behalf follows the same echo rule, and stopping the
dashboard ends it. It SHALL be marked as a project console session. It SHALL carry the project's repository id and
folder, and no change, action or branch. It MUST NOT be listed or counted in Open work, MUST NOT appear on any card or in
any change's detail view, and MUST NOT be written to the activity log. Every request that only applies to a change
session SHALL be refused for a project console session: Ship, Resolve conflicts, a next-step prompt, worktree status and
worktree removal. Repository cleanup MUST NOT treat the console's folder as a removable worktree. Pulling and dismissing
a change are not refused because a project console runs.

#### Scenario: Open work
- **WHEN** `demo-ops`'s console and two change sessions are running
- **THEN** the Open work control counts and lists the two change sessions only

#### Scenario: Activity
- **WHEN** a project console is started and ended
- **THEN** no entry about it appears in the activity feed

#### Scenario: Ship refused
- **WHEN** Ship is requested for a project console session
- **THEN** the request is refused and nothing is typed into its terminal

#### Scenario: Dashboard stopped
- **WHEN** the dashboard receives a termination signal while a project console runs
- **THEN** its agent is ended and the session is recorded as ended because the dashboard was stopped

#### Scenario: Project forgotten
- **WHEN** a project whose console has ended is forgotten from the overview
- **THEN** its console session stays in the session records until it is deleted or pruned, and no console control is
  shown for it
