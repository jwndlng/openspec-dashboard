# project-console Specification

## Purpose

Defines the project console: one agent session per managed project for general project tasks that are not a change.
It covers where it is offered, what it runs and where, how long it lives, how it adopts the session that set the project
up, and what it is kept out of.

## Requirements

### Requirement: Each managed project offers a project console
While the global agent sessions setting is enabled, each managed project SHALL offer a project console control on its
projects overview row, on its tile and in its repository board header. The control SHALL be a button that shows a
terminal icon together with the visible text **Console**. Its accessible name and tooltip SHALL say that it opens that
project's console and name the project, and the accessible name SHALL contain the visible text. It MUST NOT rely on the
icon alone for its name. In the repository board header the control SHALL be placed among the board's actions, first,
ahead of the pull, cleanup and new-change actions, and MUST NOT be styled as a ghost button. That action area SHALL be
shown whenever the control is offered, also when no other action is. On the overview row and tile the control SHALL be
outlined and set apart from the project's agent settings, so that it is not read as one of them. Activating it SHALL
open the project console overlay for that project. On the overview, activating it MUST NOT open the repository's board.
While agent sessions are disabled globally, the control MUST NOT be shown. When the project's own agent sessions setting
is disabled, or the project's agent executable was not found on this machine, the control SHALL be inactive and its
tooltip and accessible name SHALL give the reason. A pending `Scanning…` entry SHALL offer no control. The control MUST
NOT depend on the project's last scan having succeeded.

#### Scenario: Offered on the overview and the board
- **WHEN** agent sessions are on and `alpha-infra` is a managed project with agent sessions enabled
- **THEN** its overview row, its tile and its board header each show a control reading **Console**, named for
  `alpha-infra`'s console

#### Scenario: Placed with the board's actions
- **WHEN** the user opens the board of the git repository `alpha-infra`, whose last scan succeeded
- **THEN** the header's action area shows **Console** first, then Pull, Clean up and New change, and the path row shows
  no console control

#### Scenario: Board of a project whose scan failed
- **WHEN** `demo-ops`'s last scan failed and the user opens its board
- **THEN** the header's action area is shown with the **Console** control, although no other action is offered

#### Scenario: Activating it on the overview
- **WHEN** the user activates the console control on the row of `alpha-infra`
- **THEN** the project console overlay for `alpha-infra` opens, the route is unchanged and the board is not opened

#### Scenario: Agent sessions off
- **WHEN** agent sessions are disabled in Settings
- **THEN** no project shows a console control, the board header shows no action area for it, and no project console
  can be started

#### Scenario: Project excluded from agent sessions
- **WHEN** agent sessions are on and `beta-soc`'s own agent sessions toggle reads Disabled
- **THEN** `beta-soc`'s console control still reads **Console** but is inactive, and its tooltip says that agent
  sessions are off for this project

#### Scenario: Scan failed
- **WHEN** `demo-ops`'s last scan failed but its folder exists
- **THEN** its console control is active and opens a console in that folder

### Requirement: The project console runs the project's agent without a prompt
A project console SHALL run the project's agent: the profile chosen for that project, else the default agent. It SHALL be
started without a shell, from the profile's command argument list with every argument that contains `{prompt}` left out,
and with no text typed into it on start-up. The agent's environment SHALL be prepared exactly as for any session. When
the agent's executable cannot be found, opening the console SHALL be refused with that reason and the overlay SHALL show
it.

#### Scenario: Project with its own agent
- **WHEN** two agent profiles are configured, `demo-ops` uses `my-agent` with command `my-agent-cli`, `--task={prompt}`,
  `--color`, and the user opens `demo-ops`'s console
- **THEN** `my-agent-cli`, `--color` is started and nothing is typed into its terminal

#### Scenario: Default agent
- **WHEN** `alpha-infra` has no agent of its own and the default agent's command is `claude`, `{prompt}`
- **THEN** its console starts `claude` alone

#### Scenario: Agent not installed
- **WHEN** the project's agent executable cannot be found and the user opens its console
- **THEN** no process is started and the overlay says that the agent was not found

#### Scenario: Prompt carried by an option
- **WHEN** `demo-ops` uses the Antigravity preset, whose command is `agy`, `--prompt-interactive={prompt}`, and the user opens `demo-ops`'s console
- **THEN** `agy` is started alone and nothing is typed into its terminal

### Requirement: The project console runs in place in the project's folder
A project console SHALL run **in place**. The agent's working directory SHALL be the tracked repository's folder, which
for a git repository is its main checkout. No worktree SHALL be created, no branch made and no git command run by the
dashboard for the session. The session SHALL be recorded as in place and MUST NOT carry a branch. Whether it runs in
place does not depend on whether the folder is a git repository. When the folder no longer exists or is not a
directory, opening SHALL be refused with that reason and no agent SHALL be started. The overlay SHALL name the folder
and SHALL state plainly that the agent edits that folder directly, with no branch, no commit and no undo.

#### Scenario: Git repository
- **WHEN** the user opens the console of the tracked git repository `/w/acme/demo-ops`
- **THEN** the agent's working directory is `/w/acme/demo-ops`, no worktree or branch is created, and the dashboard
  runs no git command for the session

#### Scenario: The dashboard leaves the main checkout alone
- **WHEN** a project console is started
- **THEN** the repository's branch, index and working tree are exactly as they were; whatever changes afterwards is what
  the agent did under its own permission prompts

#### Scenario: Folder without git
- **WHEN** the user opens the console of a tracked folder that has an `openspec/` tree but no `.git`
- **THEN** the agent starts in that folder and no git command is run

#### Scenario: Folder removed
- **WHEN** the tracked folder has been deleted and the user opens its console
- **THEN** opening is refused with a reason saying the folder does not exist, and no agent is started

#### Scenario: The overlay states the risk
- **WHEN** a project console overlay is open
- **THEN** it names the project folder, shows no branch, and states that the agent edits that folder directly with no
  branch, no commit and no undo

### Requirement: One project console per project, and one agent per folder
At most one project console SHALL be running per project. Opening a project's console while one runs SHALL attach to it
and MUST NOT start a second process. Closing the overlay MUST NOT end the console. **End session** SHALL end the agent as
ending any session does, and ending it SHALL do nothing else. Consoles of different projects, the main console and any
number of change sessions MAY run at the same time. A project console MUST NOT be started in a folder in which another
in-place session runs. In a tracked folder without git, and in a git repository with no commit yet, where change
sessions run in place too, opening the console while an in-place change session runs there SHALL be refused with a
reason naming that change. Opening a change session there while the project console runs SHALL be refused with a reason
saying that the project console is running in that folder.

#### Scenario: Reopening a running console
- **WHEN** `demo-ops`'s console is running, the user closes the overlay and activates its console control again
- **THEN** the overlay shows the same terminal with its earlier output and no second process is started

#### Scenario: Two projects
- **WHEN** `demo-ops`'s console is running and the user opens `alpha-infra`'s console
- **THEN** a second console starts in `alpha-infra`'s folder and `demo-ops`'s console is unaffected

#### Scenario: Ending the console
- **WHEN** the user ends a project console
- **THEN** its agent is ended, and no worktree removal, pull offer or other follow-up is offered

#### Scenario: Next to a change session in a folder without git
- **WHEN** an Implement session for `audit-trail` runs in place in a tracked folder without git and the user opens that
  project's console
- **THEN** opening is refused with a reason naming `audit-trail`, and no second agent runs in that folder

#### Scenario: Next to a change session in a repository without a commit
- **WHEN** a Draft artifacts session for `first-feature` runs in place in the tracked git repository `/w/acme/fresh-app`,
  which has no commit yet, and the user opens that project's console
- **THEN** opening is refused with a reason naming `first-feature`, and no second agent runs in that checkout

#### Scenario: A change session while the console runs in a repository without a commit
- **WHEN** the project console of `/w/acme/fresh-app`, which has no commit yet, is running and the user starts
  **Draft artifacts** for `first-feature`
- **THEN** the request is refused with a reason saying the project console is running in that folder, and no agent is
  started

### Requirement: The setup session is the project's console once the project is tracked
An integration session whose folder is a tracked repository's folder SHALL be treated as that project's console. While
it runs, opening the project console SHALL show it and MUST NOT start another agent. When it has ended and is the
project's most recent console session, the overlay SHALL show it with its stored output and Resume. The overlay SHALL
show the most recent of the project's console sessions and integration sessions for its folder: a running one first,
otherwise the newest by start time. Resuming an integration session shown this way SHALL resume it as an integration
session. Whether the project is set up is still decided only by the marker, as the `repo-integration` capability
specifies.

#### Scenario: New project, overlay closed
- **WHEN** the user creates the project `gamma-tools`, the agent runs `openspec init`, the user closes the setup overlay
  and the project is tracked after the next discovery
- **THEN** `gamma-tools`'s console control shows that the session is running, and activating it shows the same setup
  terminal with its earlier output, with no second agent started

#### Scenario: Setup session ended
- **WHEN** `gamma-tools`'s setup session has ended and no project console was started since
- **THEN** opening `gamma-tools`'s console shows the setup session's stored output with Resume and New console

#### Scenario: A newer console wins
- **WHEN** `gamma-tools`'s setup session ended and the user later started and ended a project console for it
- **THEN** opening the console shows the newer project console session

### Requirement: The project console overlay holds the console and nothing change-related
The project console SHALL be shown in an overlay in the same frame as a change's detail view: a header that names the
project, the agent, the folder and the session's status badge; the in-place warning; the terminal; the default
responses while the session runs and its terminal is connected; End session; and, once the shown session has ended,
Resume when its agent has a resume command, **New console** and deleting the record. It MUST NOT offer Ship, work
status, next-step prompts, session starters, worktree removal or a pull. When the project has no console session at all,
opening the overlay SHALL start one. The overlay SHALL close on its close control, on the backdrop and on `Escape`,
except that `Escape` pressed while keyboard focus is in the terminal SHALL go to the agent. While the overlay is open,
the page behind it SHALL take no focus and no clicks. Opening and closing the overlay SHALL NOT change the current
route.

#### Scenario: First open
- **WHEN** `alpha-infra` has never had a console or integration session and the user activates its console control
- **THEN** a project console starts and its terminal is shown

#### Scenario: Nothing change-related
- **WHEN** the overlay of a running project console is open
- **THEN** it shows the default responses and End session, and no Ship, work status, next-step or pull control

#### Scenario: New console after an ended one
- **WHEN** the shown console has ended and the user activates New console
- **THEN** a new project console starts in the project's folder and the ended one stays in the session records

#### Scenario: Escape in the terminal
- **WHEN** the overlay is open, keyboard focus is in its terminal and the user presses `Escape`
- **THEN** the agent receives the key and the overlay stays open

#### Scenario: Route is kept
- **WHEN** the user opens and closes a project console overlay on a repository's board
- **THEN** the same board is shown with its filters as before

### Requirement: The project console control shows the console's state
While a project's console runs, its control SHALL show which of the two running states the session is in. These are
producing output, or possibly needing the user together with the length of the silence. They SHALL be decided exactly
as for every other session badge. The control SHALL show the state as visible text next to its **Console** label, in
the same words as the session badge (`working`, or `may need you` with the duration), and SHALL give it in the tooltip
and accessible name. It MUST NOT give the state by colour or motion alone. While none of the project's console sessions
runs, the control SHALL show no state, only its label.

#### Scenario: Console working
- **WHEN** `demo-ops`'s console is producing output
- **THEN** its control reads **Console** followed by `working`

#### Scenario: Console waiting
- **WHEN** `demo-ops`'s console has printed nothing for longer than the silence threshold
- **THEN** the control shows `may need you` with the silence duration next to its label, and its tooltip and accessible
  name say that `demo-ops`'s console may need the user and for how long it has been silent

#### Scenario: No console running
- **WHEN** no console session of `demo-ops` is running
- **THEN** its control reads **Console** only and shows no running indicator

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
