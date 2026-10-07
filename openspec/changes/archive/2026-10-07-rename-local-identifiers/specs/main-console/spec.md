## MODIFIED Requirements

### Requirement: The console runs in the console folder, never in a repository
The console's working directory SHALL be the console folder. By default this SHALL be the folder `console` under the
dashboard's home directory (`~/.spec-control/console/`), which the dashboard SHALL create when it does not exist.
The user MAY set another console folder in the agent sessions settings. A configured console folder SHALL be an
absolute path to an existing directory, and MUST NOT be a tracked repository's folder or lie inside one; a folder that
contains tracked repositories is allowed. Saving an invalid console folder SHALL be refused with a reason and leave the
saved configuration unchanged; clearing the setting SHALL return to the default. When a saved console folder has since
become invalid, opening the console SHALL be refused with the reason, and no fallback folder SHALL be used. For the
console, no worktree SHALL be created, no branch made and no git command run.

#### Scenario: Default folder
- **WHEN** no console folder is configured and the user opens the console for the first time
- **THEN** `~/.spec-control/console/` is created and the agent's working directory is that folder

#### Scenario: Workspace root
- **WHEN** the user sets the console folder to `/w/acme`, which contains the tracked repositories `/w/acme/demo-ops`
  and `/w/acme/alpha-infra`, and saves
- **THEN** the setting is saved and the next console starts in `/w/acme`

#### Scenario: Folder inside a tracked repository
- **WHEN** the user sets the console folder to `/w/acme/demo-ops/tools` while `/w/acme/demo-ops` is tracked
- **THEN** saving is refused with a reason that names the repository, and the configuration is unchanged

#### Scenario: Relative or missing folder
- **WHEN** the user sets the console folder to `acme` or to an absolute path that does not exist
- **THEN** saving is refused with a reason and the configuration is unchanged

#### Scenario: Folder removed after saving
- **WHEN** the configured console folder has been deleted and the user opens the console
- **THEN** opening is refused with a reason saying the folder does not exist, and no agent is started

#### Scenario: No git
- **WHEN** the console is opened, resumed and ended
- **THEN** no git command is run and no worktree or branch is created or removed

### Requirement: Console sessions are session records without a repository
A console session SHALL be stored, retained, listed and attached like every other session: its record lives under
`~/.spec-control/sessions/`, it counts towards the newest 50 ended sessions kept, its terminal is served over the
same WebSocket under the same guard, text sent on the user's behalf follows the same echo rule, and stopping the
dashboard ends it. It SHALL be marked as a console session and SHALL carry no repository, change, action or branch. It
MUST NOT be listed or counted in the Open work list, MUST NOT appear on any card or in any change's detail view, and
MUST NOT be written to the activity log. Every request that only applies to a change session — Ship, a next-step prompt,
worktree status and worktree removal — SHALL be refused for a console session.

#### Scenario: Open work
- **WHEN** the console and two change sessions are running
- **THEN** the Open work control counts and lists the two change sessions only

#### Scenario: Activity
- **WHEN** a console is started and ended
- **THEN** no entry about it appears in the activity feed

#### Scenario: Ship refused
- **WHEN** Ship is requested for a console session
- **THEN** the request is refused and nothing is typed into its terminal

#### Scenario: Dashboard stopped
- **WHEN** the dashboard receives a termination signal while the console runs
- **THEN** the console's agent is ended and the session is recorded as ended because the dashboard was stopped
