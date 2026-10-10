# Spec Delta

## ADDED Requirements

### Requirement: A new workspace folder can be created
A folder the Workspace step marks to be created SHALL be created on **Continue** by the server, before the configuration
is saved, as exactly one new, empty directory made with a non-recursive, exclusive create, and nothing else: no file in
it, no git command, no other folder. The path MUST be absolute after `~` expansion, its parent MUST exist and be a
directory, and the path MUST NOT exist in any form — file, directory or symbolic link — and MUST NOT lie in or below a
tracked repository's folder, an ignore path or the dashboard's home directory. A refusal SHALL be shown on that root
with its reason, SHALL leave the file system unchanged, and SHALL keep the step open with the entries kept; nothing is
saved when any creation was refused. The folder SHALL NOT be deleted afterwards, whatever later steps do.

#### Scenario: Parent missing
- **WHEN** the user marks `~/missing-parent/Workspace` to be created and `~/missing-parent` does not exist
- **THEN** **Continue** shows on that root that its parent folder does not exist, nothing is created and nothing is saved

#### Scenario: Inside a tracked repository
- **WHEN** the user marks `/w/acme/demo-ops/projects` to be created and `/w/acme/demo-ops` is tracked
- **THEN** it is refused with a reason that names the repository and nothing is created

#### Scenario: Appeared in the meantime
- **WHEN** the folder marked to be created exists by the time the user continues
- **THEN** it is not created again; the step marks it as found and it is saved as a root on the next **Continue**

## MODIFIED Requirements

### Requirement: The Workspace step adds roots and tracks projects
The Workspace step SHALL ask the user to choose at least one workspace folder for their projects, or to create a new
one. It SHALL list the configured workspace roots and let the user add roots in three ways: with
**Choose folder…**, which opens the operating system's own folder dialog and adds the folder the user chose; by typing
a path, with `~` accepted; and with one-click suggestions of the folders the server reports as existing in the user's
home directory that are not configured yet; when no root is configured and none of those folders exists, it SHALL
propose creating `~/Workspace`. It SHALL let the user remove roots added in this step. **Choose folder…**
SHALL be offered only while the server reports a folder picker as available, SHALL show that it is waiting while the
dialog is open and SHALL not be activatable again until it closes; cancelling the dialog SHALL add nothing and show no
error, and a failure SHALL be shown in the step with the typed path still available. A chosen folder that is already a
configured or entered root SHALL not be added twice, and the step SHALL say that it is already listed. Whenever the entered roots change, discovery SHALL run against
the configured and entered roots and the configured ignore paths without saving anything, and the step SHALL list the
OpenSpec projects found that are not tracked yet, each with a checkbox, all checked by default, and say how many git
repositories without OpenSpec were found, adding that they can be integrated from the projects overview. A root that
discovery reports as missing SHALL be marked as not found and offered **Create folder**; a root marked to be created
SHALL be created on **Continue** as specified in "A new workspace folder can be created" and then saved, and a missing
root not marked to be created SHALL NOT be saved. Only the latest discovery result
SHALL be shown. The step SHALL also offer **Add from GitHub**, opening the dialog of the `github-repositories`
capability with the configured and entered roots to choose from, in which confirming adds the chosen repositories to a
**GitHub repositories** list in the step instead of cloning them at once; each listed repository SHALL show the path it
will be cloned into and can be removed again before **Continue**. **Continue** SHALL be unavailable, saying why, while no
workspace root is configured, entered or marked to be created. **Continue** SHALL create each root marked to be created,
save the configuration with the entered roots added, track each checked project, and then clone each listed GitHub
repository under the rules of that capability, at most two at a time, showing each one's progress and outcome; a clone
holding `openspec/config.yaml` is tracked, and one without it is reported as cloned without OpenSpec, to be integrated
from the projects overview. When every clone succeeded the wizard SHALL move to the next step; when any failed, the step
SHALL stay open showing each failure with its reason and offering to retry it, and activating **Continue** again SHALL
move on without cloning what already succeeded. **Continue** SHALL NOT remove any root, ignore path or repository, and
SHALL NOT change any repository's name or enabled state other than tracking the checked projects and the cloned
repositories that use OpenSpec. If saving fails, the step SHALL stay open, show the error and keep the
entries. Continuing with a configured root and nothing entered, checked or listed SHALL save nothing, create nothing and clone
nothing.

#### Scenario: Choosing a folder in Finder
- **WHEN** the server runs on macOS and the user activates **Choose folder…** and picks `/w/acme` in the dialog
- **THEN** `/w/acme` is listed as an entered root, discovery runs, and the projects found under it are listed with checkboxes

#### Scenario: Cancelling the folder dialog
- **WHEN** the user activates **Choose folder…** and cancels the dialog
- **THEN** no root is added, no error is shown and **Choose folder…** can be activated again

#### Scenario: No folder picker on this machine
- **WHEN** the server reports that no folder picker is available
- **THEN** the step offers no **Choose folder…**, and roots can still be typed and picked from the suggestions

#### Scenario: A suggested folder
- **WHEN** `~/Workspace` exists, is not a configured root, and the user opens the Workspace step
- **THEN** `~/Workspace` is offered as a suggestion, and activating it adds it to the entered roots and runs discovery

#### Scenario: Projects found are tracked
- **WHEN** the user adds `/w/acme`, discovery finds `/w/acme/alpha-infra` and `/w/acme/demo-ops` with OpenSpec and `/w/acme/chat-groups` without, the user unchecks `demo-ops` and continues
- **THEN** the saved configuration has `/w/acme` as a root, `alpha-infra` is tracked and enabled, `demo-ops` is not in the configuration, and the step had said that one repository without OpenSpec can be integrated from the overview

#### Scenario: Nothing is saved before Continue
- **WHEN** the user marks `~/Workspace` to be created, adds a root, discovery lists projects, the user lists `acme/beta-soc` under GitHub repositories, and then activates **Skip setup**
- **THEN** the saved configuration's roots and repositories are unchanged, `~/Workspace` does not exist and nothing was cloned

#### Scenario: A missing folder
- **WHEN** the user enters `~/does-not-exist` and does not activate **Create folder**
- **THEN** the root is marked as not found, **Create folder** is offered, and the root is not saved on **Continue**

#### Scenario: Existing roots are kept
- **WHEN** setup is run again with two configured roots and the user adds a third and continues
- **THEN** the saved configuration has all three roots

#### Scenario: Creating a workspace folder
- **WHEN** no root is configured, `~/Workspace` does not exist, and the user accepts the proposal to create it and continues
- **THEN** `~/Workspace` exists as an empty folder and is saved as a workspace root

#### Scenario: A root is required
- **WHEN** no root is configured and the user has entered none
- **THEN** **Continue** is inactive and says that a workspace folder is needed, and **Skip setup** is still available

#### Scenario: GitHub repositories into a new workspace
- **WHEN** no root is configured, the user marks `~/Workspace` to be created, lists `acme/beta-soc`, which uses OpenSpec, and `acme/chat-groups`, which does not, and continues
- **THEN** `~/Workspace` is created and saved as a root, both are cloned into it, `beta-soc` is tracked and enabled, `chat-groups` is reported as cloned without OpenSpec, and the wizard moves to the Agents step

#### Scenario: A clone fails
- **WHEN** the user lists `acme/beta-soc` and `acme/missing-repo`, continues, and the clone of `acme/missing-repo` fails
- **THEN** the step stays open, shows `acme/beta-soc` as tracked and `acme/missing-repo` with its reason and a retry, and activating **Continue** again moves to the Agents step without cloning `acme/beta-soc` a second time

### Requirement: The Done step summarises and ends setup
The Done step SHALL summarise what setup saved: the roots added and which of them it created, the number of projects
tracked, the GitHub repositories cloned, whether agent
sessions are on, the agents added, the default agent, the console agent and the number of projects whose settings were
changed. It SHALL also say what is left, naming the checks of a setup-view report requested when the Done step is shown that are
still `problem` or `warning`, and each checked agent whose executable the Agents step last found missing. It SHALL present this
visually: a headline that setup is complete, with a large check mark — or, when checks still need attention, that setup
is complete with something left to fix — followed by one card per step from System check to Project settings, in the wizard's
order, each with that step's icon from the Welcome diagram, its name, its outcome in a word or a number and a line of
detail, and a mark in text and colour of whether it is **done**, **needs attention** or had **nothing changed**. A card
SHALL need attention only for the System check, when a check is `problem` or `warning`, and for Agents, when a checked
agent is not found. Below the cards it SHALL say
what comes next: the projects overview, and the tour on a first start. The cards SHALL be exposed to assistive
technology as a list, each read as its name, mark and outcome, and the headline's animation, if any, SHALL not play when
the user prefers reduced motion. It SHALL offer **Finish**. Finishing, and **Skip setup** at any step, SHALL mark setup as done on the server and close the wizard,
keeping everything earlier steps saved. If marking setup as done fails, the wizard SHALL close anyway and open by itself
again on the next page load. After the wizard closed on a first start, the onboarding tour SHALL start under its own
rules.

#### Scenario: Finish
- **WHEN** the user activates **Finish**
- **THEN** the wizard closes, the configuration no longer has `setup: "pending"`, and on reload the wizard does not open

#### Scenario: A visual ending
- **WHEN** the user added `/w/acme`, tracked two projects, added Codex, kept the console on the default agent, changed no project setting, and every check is `ok`
- **THEN** the Done step's headline says setup is complete beside a large check mark, and it shows five cards — System check "All in place" done, Workspace "2 projects" done, Agents "2 agents" done, Console "Claude Code" done, Project settings nothing changed — each with its step's icon

#### Scenario: Something left to fix
- **WHEN** the GitHub CLI check is `warning` on the Done step
- **THEN** the headline says something is left to fix, and the System check card is marked as needing attention and names the GitHub CLI

#### Scenario: Summary of agents and projects
- **WHEN** the user added Codex and Antigravity, kept the console on the default agent and changed the auto fetch of three projects
- **THEN** the Done step lists Codex and Antigravity as added, names the default agent as the console agent, and says that the settings of three projects were saved

#### Scenario: Skip keeps what was saved
- **WHEN** the user continues from the Workspace step, which tracked two projects, and activates **Skip setup** on the Agents step
- **THEN** the wizard closes, setup is marked done, and the two projects are still tracked

#### Scenario: The tour follows
- **WHEN** a first-time user finishes the wizard in a browser that has not seen the tour
- **THEN** the onboarding tour starts at its first step

#### Scenario: An agent still missing
- **WHEN** the user checked Antigravity, `agy` is still not found, and every check of the setup view is `ok`
- **THEN** the Agents card is marked as needing attention and names Antigravity, and the System check card is done

### Requirement: The wizard reads and writes only through existing rules
The wizard SHALL save only through the configuration, tracking, setup, workspace-folder and GitHub clone endpoints, and
MUST NOT write to a tracked repository or start an agent. Beyond the configuration, the only things it writes are a new
workspace folder the user marked to be created and the GitHub clones the user listed. The processes it may cause to be
started are the operating system's folder dialog, through the setup folder endpoint, only when the user activates
**Choose folder…**; the environment report's `git config --get`; and, under the `github-repositories` capability, the
read-only `gh repo list` and `gh api user` when the user opens the Add from GitHub dialog, changes its owner or refreshes
it, and the `git clone` of each GitHub repository the user listed, when the user activates **Continue** or a retry. Only
those last two contact a network. Its
workspace suggestions SHALL come from a fixed list of folder names checked directly in the user's home directory,
without listing the home directory or descending into any folder.

#### Scenario: No process started
- **WHEN** the user steps through the whole wizard with an existing root and without opening Add from GitHub, switches agent sessions on, adds two agents and changes the settings of every project
- **THEN** no agent was started, no repository file was created, modified or deleted, no network was contacted, and no process was started other than any folder dialog the user opened and the environment report's `git config --get`

#### Scenario: Only what the user asked for
- **WHEN** the user opens Add from GitHub in the Workspace step, lists one repository and continues
- **THEN** the only processes started besides the environment report's were the `gh` listing and one `git clone` of that repository, and no agent was started
