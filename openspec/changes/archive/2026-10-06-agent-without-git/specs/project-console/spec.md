# Spec Delta

## MODIFIED Requirements

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
