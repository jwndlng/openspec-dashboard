# Spec Delta

## Purpose

Defines how a repository that does not use OpenSpec yet becomes visible in the dashboard and is set up from it: what
makes a repository integratable, what the **Integrate** action starts, and what decides that integration succeeded.

## ADDED Requirements

### Requirement: A repository without OpenSpec is integratable

A directory reached by discovery SHALL be reported as **integratable** when it has its own `.git` **directory**, does
not contain `openspec/config.yaml`, and holds no reported OpenSpec project anywhere below it. A directory whose `.git`
is a file (a linked git worktree) MUST NOT be reported, for the same reason it is not reported as a candidate: it is
the same repository seen twice. A directory that is already a tracked repository in the configuration MUST NOT be
reported. Everything the walk already skips — `node_modules`, `.git`, `.venv`, `target`, `dist`, ignore paths, symlinks
and anything beyond the depth bound — is skipped here too, and each integratable repository SHALL be reported once,
under its canonical path, with an `id` derived from that path and its default name.

A directory that holds an OpenSpec project below it is a container, not a project waiting to be set up: the project
inside it is offered, the container is not.

#### Scenario: A plain git repository is offered
- **WHEN** a scan root contains `/w/acme/beta-soc` with a `.git` directory and no `openspec/config.yaml`
- **THEN** discovery reports `/w/acme/beta-soc` as integratable, once, with its canonical path and the default name `beta-soc`

#### Scenario: A directory that is not a git repository is not offered
- **WHEN** a scan root contains `/w/acme/notes`, a plain directory with neither `.git` nor `openspec/config.yaml`
- **THEN** `/w/acme/notes` is not reported as integratable

#### Scenario: A container of an OpenSpec project is not offered
- **WHEN** the git repository `/w/acme/monorepo` has no `openspec/config.yaml` of its own but `/w/acme/monorepo/packages/tools` is reported as an OpenSpec project
- **THEN** `packages/tools` is reported as it is today and `/w/acme/monorepo` is not reported as integratable

#### Scenario: A linked worktree is not offered
- **WHEN** `/w/acme/beta-soc` is a git repository without OpenSpec and `/w/acme/beta-soc-wt` is a linked worktree of it
- **THEN** only `/w/acme/beta-soc` is reported as integratable

#### Scenario: A tracked repository is never integratable
- **WHEN** a repository in the configuration lost its `openspec/config.yaml`
- **THEN** it is not reported as integratable; it stays a tracked repository whose scan reports the problem

#### Scenario: Ignore paths apply
- **WHEN** the user adds an integratable repository's path to the ignore paths
- **THEN** it is no longer reported, exactly as ignoring a candidate removes that candidate

#### Scenario: Today's candidates are unchanged
- **WHEN** discovery runs over a scan root containing OpenSpec projects and plain git repositories
- **THEN** the reported candidates are exactly those reported before integratable repositories existed

### Requirement: Integrate starts the repository's agent in that repository

The dashboard SHALL offer an **Integrate** action for each integratable repository. Activating it SHALL start an
**integration session**: the repository's configured agent — the default agent, since the repository is not tracked and
so cannot select one — started with that agent's `integrate` prompt and the repository folder as its working directory.
An integration session is a session of its own kind: it belongs to no repository in the configuration, no change and no
action, and MUST NOT appear anywhere change sessions appear — not in Open work, not on a card, not in the activity log,
and never in work status, Ship, pull or worktree clean-up.

At most one integration session per folder SHALL be running; activating **Integrate** again while one runs SHALL return
the running session rather than start a second agent.

**Integrate** SHALL be unavailable, with the reason stated on the row, when agent sessions are off, when the default
agent has no `integrate` prompt, or when the default agent's executable was not found on this machine. Integratable
repositories SHALL be listed in all of those cases. When the agent cannot be started, the reason SHALL be shown on the
row that activated **Integrate**, because a session that was never created has no panel to report itself in.

#### Scenario: Starting an integration
- **WHEN** the user activates **Integrate** for an integratable repository and agent sessions are on
- **THEN** the default agent starts with the repository folder as its working directory and its terminal is shown

#### Scenario: Starting it twice
- **WHEN** **Integrate** is activated for a folder whose integration session is running
- **THEN** the running session is shown and no second agent is started

#### Scenario: Agent sessions are off
- **WHEN** agent sessions are disabled
- **THEN** integratable repositories are still listed, **Integrate** is inactive, and the reason given is that agent sessions are off

#### Scenario: The agent has no Integrate prompt
- **WHEN** the default agent's profile carries no `integrate` prompt
- **THEN** **Integrate** is inactive on every row and names that as the reason

#### Scenario: An integration session is not change work
- **WHEN** an integration session is running
- **THEN** it does not appear in Open work, on any card or in the activity log, and it has no work status, no Ship and no worktree

### Requirement: An integration session runs in place, in the main checkout

An integration session SHALL run **in place**: the agent's working directory is the repository folder itself, no
worktree is created, no branch is made, and the dashboard SHALL run no git command for the session. This is the one
case in which a session runs in a git repository's main checkout, and it exists because the point of the action is to
set up the repository the user works in: scaffolding created on a branch in a worktree would leave no marker in the
checkout, so the repository would stay integratable and nothing would be visible until someone merged that branch.

The decision to run in place SHALL follow from the discovery result — a git repository, not tracked, without the marker
— and never from attempting a git command and reacting to its failure. The session SHALL be recorded as in place and
MUST NOT carry a branch. Its panel SHALL name the folder the agent runs in and SHALL state plainly that the agent edits
that folder directly, with no branch, no commit and no undo.

#### Scenario: No worktree and no branch
- **WHEN** an integration session is started for a git repository
- **THEN** the agent's working directory is the repository folder, no worktree is created, no branch is made and no git command is run for the session

#### Scenario: The main checkout is left alone by the dashboard
- **WHEN** an integration session starts
- **THEN** the repository's branch, index and working tree are exactly as they were; whatever changes afterwards is what the agent did with the user's approval

#### Scenario: The panel states the risk
- **WHEN** the panel of an integration session is open
- **THEN** it names the repository folder, shows no branch, and states that the agent edits that folder directly with no branch, no commit and no undo

### Requirement: Integration is confirmed by the marker, never by the agent's word

The dashboard SHALL treat an integration as finished only when `openspec/config.yaml` exists in the folder. It SHALL
re-check the folder when the integration session ends, and every discovery run SHALL re-check it as a matter of course.
On the first check that finds the marker, the repository SHALL be added to the configuration with `enabled: true` and
its default name — disambiguated by the same `<basename> (<parent>)` rule that applies to an enabled candidate — the
configuration SHALL be written with the existing atomic write, and a scan SHALL start so the repository appears on the
board.

Nothing SHALL be read from the agent's output to decide this. If the session ends without the marker, the folder stays
integratable, nothing is added to the configuration, and the session's outcome — its exit code and reason — is shown.

#### Scenario: The marker appears
- **WHEN** an integration session ends and the folder now holds `openspec/config.yaml`
- **THEN** the repository is added to the configuration with `enabled: true` and its default name, a scan starts, and it appears on the board

#### Scenario: The agent exits without doing it
- **WHEN** an integration session ends and the folder holds no `openspec/config.yaml`
- **THEN** the configuration is unchanged, the repository is still listed as integratable, and the session's exit code and reason are shown

#### Scenario: The agent claims success it did not achieve
- **WHEN** an integration session's terminal shows that OpenSpec was initialised but no `openspec/config.yaml` is on disk
- **THEN** nothing is added to the configuration

#### Scenario: The marker appears without the session ending
- **WHEN** the marker is written while the integration session is still running and the user runs discovery
- **THEN** that discovery adds the repository, starts a scan, and no longer lists the folder as integratable

#### Scenario: Colliding default name
- **WHEN** an integrated repository's basename is already the name of a tracked repository
- **THEN** its name defaults to `<basename> (<parent directory name>)`, as it does for an enabled candidate

### Requirement: Integration adds no write by the dashboard to a repository

Integration SHALL NOT make the dashboard write to a repository. The dashboard MUST NOT run `openspec init`, in process
or as a subprocess, MUST NOT create, edit or delete any file in the folder, and MUST NOT run a git command for the
integration session. Everything written in the folder is written by the user's agent under its own permission prompts.
Adding the repository to `~/.openspec-dashboard/config.json` and starting a scan are the only state the dashboard
changes, and both are outside the repository.

#### Scenario: The dashboard writes nothing
- **WHEN** an integration session is started, runs and ends
- **THEN** the dashboard itself has created, changed or deleted no file in the repository and has run no git command for the session

#### Scenario: No init subprocess
- **WHEN** **Integrate** is activated
- **THEN** the only process the dashboard starts is the configured agent
