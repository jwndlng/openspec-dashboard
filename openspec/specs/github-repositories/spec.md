# github-repositories Specification

## Purpose
Lets a user who keeps no local checkouts track GitHub repositories: on the user's confirmation the dashboard clones each
chosen repository into a folder directly inside a workspace root, where it is an ordinary project like any other.

## Requirements

### Requirement: Add from GitHub is offered on the overview and in setup

The projects overview SHALL offer **Add from GitHub** in its header band's action area and, while no repository is
tracked, in its "No repositories tracked yet" empty state; the setup wizard's Workspace step SHALL offer the same
choice as specified in the `setup-wizard` capability. Activating it SHALL open a dialog in which the user chooses one or
more GitHub repositories, from the list described below or by typing them, picks the workspace root to clone into —
preselected when exactly one is configured — and, per repository, the folder name, which defaults to the repository's
name; the dialog SHALL show the full path each repository will be cloned into and SHALL be confirmed with **Clone**.
Nothing SHALL be cloned before the user confirms. The action SHALL be unavailable, with the reason stated in its tooltip
and accessible name, when no workspace root is configured or when `git` was not found on this machine. It SHALL NOT
depend on agent sessions being on.

#### Scenario: Offered in the band
- **WHEN** the user opens the projects overview with one workspace root configured
- **THEN** **Add from GitHub** stands in the header band's action area next to **New project**, active

#### Scenario: Target shown
- **WHEN** the only workspace root is `/w/acme` and the user chooses `jdoe/beta-soc`
- **THEN** the dialog has `/w/acme` selected and shows `/w/acme/beta-soc` as the folder the repository will be cloned into

#### Scenario: No workspace root
- **WHEN** no workspace root is configured
- **THEN** **Add from GitHub** is inactive on the overview and its reason says to add a workspace root in Settings

#### Scenario: git missing
- **WHEN** `git` is not found on this machine
- **THEN** **Add from GitHub** is inactive and its reason says that git was not found

#### Scenario: Closing without confirming
- **WHEN** the user chooses two repositories in the dialog and closes it without activating **Clone**
- **THEN** no process was started for a clone, no folder was created and the configuration is unchanged

### Requirement: The user's GitHub repositories are listed through the GitHub CLI, read-only, on request

The dialog SHALL list GitHub repositories of one owner — by default the account `gh` is signed in as, or another owner
the user types — read with the GitHub CLI's read-only `gh repo list`, at most 200 per owner, showing for each its
`owner/name`, its description, whether it is private, whether it is archived and when it was last pushed, ordered by the
last push, newest first, and filterable by a search over `owner/name` and description. The list SHALL be requested only
when the dialog opens, when the user changes the owner and when the user activates **Refresh**; never on a timer,
during a scan, from discovery or from any other view, and it SHALL be kept nowhere but in the open dialog. The query
SHALL run through the same `gh` runner as the pull-request and issue queries — without a shell, with its working
directory in the dashboard home, prompts disabled and a timeout — and the owner SHALL be passed as one validated
argument. A repository that a tracked repository already has as its `origin` SHALL be marked as already added and SHALL
NOT be selectable. When `gh` is not installed or not signed in, the dialog SHALL say so with the remedy and SHALL still
accept typed repositories; a failed query SHALL show its masked reason and keep any earlier list.

#### Scenario: Listing the signed-in user's repositories
- **WHEN** `gh` is signed in as `jdoe`, who owns `jdoe/alpha-infra` and `jdoe/demo-ops`, and the user opens the dialog
- **THEN** both are listed with their descriptions and last-push ages, newest first, and only `gh repo list` and `gh api user` processes were started, none in a tracked repository

#### Scenario: Another owner
- **WHEN** the user types the owner `acme` and confirms it
- **THEN** the list is replaced by the repositories of `acme`

#### Scenario: Already tracked
- **WHEN** a tracked repository has `git@github.com:jdoe/demo-ops.git` as its `origin`
- **THEN** `jdoe/demo-ops` is marked as already added and cannot be selected

#### Scenario: gh not signed in
- **WHEN** `gh` is installed but not signed in and the user opens the dialog
- **THEN** the dialog says to run `gh auth login`, lists nothing, and still lets the user type `acme/beta-soc` and clone it

#### Scenario: Not repeated by itself
- **WHEN** the dialog is open for ten minutes without the user acting
- **THEN** no further `gh` process was started after the first listing

### Requirement: A typed repository is accepted only as a GitHub owner and name

The dialog SHALL accept a typed repository as `owner/name`, `https://github.com/owner/name` with or without a trailing
`.git` or `/`, or `git@github.com:owner/name.git`, and SHALL reduce each to `owner/name`. The owner MUST consist of
letters, digits and single hyphens, neither starting nor ending with a hyphen, at most 39 characters; the name MUST
consist of letters, digits, `.`, `_` and `-`, at most 100 characters, and MUST NOT be `.` or `..` or end in `.git` once
reduced. Any other host, a longer path, a query, a fragment or credentials in the URL MUST be refused with the reason,
before any process is started. The server SHALL apply the same validation to every clone request and SHALL build the
clone URL itself as `https://github.com/<owner>/<name>.git`, never taking a URL from the request.

#### Scenario: Forms that are accepted
- **WHEN** the user types `https://github.com/acme/beta-soc.git`, `acme/beta-soc` or `git@github.com:acme/beta-soc.git`
- **THEN** each is shown as `acme/beta-soc` with the default folder name `beta-soc`

#### Scenario: Another host
- **WHEN** the user types `https://gitlab.com/acme/beta-soc`
- **THEN** it is refused as not a GitHub repository and nothing is started

#### Scenario: A path in the name
- **WHEN** a clone request names the repository `acme/../../etc`
- **THEN** the request is refused, no process is started and nothing is created

#### Scenario: Credentials in the URL
- **WHEN** the user types `https://user:secret@github.com/acme/beta-soc`
- **THEN** it is refused, and the reason shown does not contain `secret`

### Requirement: Only a new folder directly inside a workspace root is cloned into

A repository SHALL be cloned into a folder directly inside the chosen root, under the rules **New project** applies
(`project-creation` capability): the root MUST be one of the saved configuration's workspace roots, MUST exist and MUST
be a directory; the folder name MUST be a single path segment that starts with a letter or digit and contains only
letters, digits, `.`, `_` and `-`, at most 100 characters, and `.`, `..`, names containing a path separator and names
ending in `.git` MUST be refused; the resulting path MUST NOT exist in any form — file, directory or symbolic link — and
MUST NOT lie in or below an ignore path, a tracked repository's folder or the dashboard's home directory. Every refusal
SHALL give its reason in the dialog before any process is started, and SHALL leave the file system unchanged. Two
repositories in one confirmation MUST NOT be given the same target path.

#### Scenario: Folder already exists
- **WHEN** `/w/acme/beta-soc` exists and the user confirms `acme/beta-soc` into `/w/acme` with the default name
- **THEN** the clone is refused with a reason saying the folder exists, suggesting another name, and nothing in it is changed

#### Scenario: Another folder name
- **WHEN** the user changes the folder name of `acme/beta-soc` to `beta-soc-gh` and confirms
- **THEN** it is cloned into `/w/acme/beta-soc-gh`

#### Scenario: A root that is not configured
- **WHEN** a clone request names `/w/other` as the root while it is not a configured workspace root
- **THEN** the request is refused and nothing is created

### Requirement: A repository is cloned with git, without prompts or hooks

On the user's confirmation the dashboard SHALL create the target folder with an exclusive, non-recursive create, so that
a folder that appeared in the meantime is refused rather than reused, and SHALL then run `git clone` from
`https://github.com/<owner>/<name>.git` into it. The clone SHALL be a full clone, with `origin` as the remote name,
without submodules, without running any hook and without automatic maintenance, so that no later read of it needs the
network. It SHALL rely on git's own credential handling under the pull action's rules (`repository-pull` capability):
no terminal prompt, SSH in batch mode, credentials never read, stored or forwarded, and credentials in any text returned
masked. When the clone fails or exceeds its timeout of ten minutes, the dashboard SHALL stop it, SHALL remove the
target folder only if it is empty — with a non-recursive remove, deleting nothing else — and SHALL report the masked
reason with, when the folder could not be removed, its path; for an authentication failure the reason SHALL also say
that a private repository needs git credentials for github.com, for example through `gh auth setup-git`. At most two
clones SHALL run at a time. The dashboard MUST NOT write anything into the clone itself, add or change a remote, check
out another branch or configure anything in it.

#### Scenario: What is on disk after a clone
- **WHEN** the user clones `acme/beta-soc` into `/w/acme/beta-soc`
- **THEN** `/w/acme/beta-soc` is a git repository on the remote's default branch with `origin` set to `https://github.com/acme/beta-soc.git` and its working tree equals that branch, and nothing else under `/w/acme` changed

#### Scenario: Clone fails
- **WHEN** the remote refuses the clone because the repository does not exist or needs credentials
- **THEN** the outcome is `failed` with the masked reason, `/w/acme/beta-soc` does not exist, and the configuration is unchanged

#### Scenario: No prompt
- **WHEN** the repository is private and no credential helper provides credentials
- **THEN** the clone fails with a reason within the timeout, no prompt appears anywhere, and the reason mentions `gh auth setup-git`

#### Scenario: Two clones into the same folder
- **WHEN** two clone requests for `/w/acme/beta-soc` arrive at the same time
- **THEN** exactly one clone is made, the other is refused because the folder exists, and only one folder exists

#### Scenario: Hooks do not run
- **WHEN** the user's git template directory installs a `post-checkout` hook
- **THEN** cloning does not run it

### Requirement: Clones run in the background and report their outcome

A clone SHALL go on when the dialog is closed or the page is reloaded. Once a clone succeeded, a clone holding
`openspec/config.yaml` SHALL be added to the configuration with `enabled: true` and its default name, disambiguated as
for any enabled candidate, and a scan SHALL start, without a further action by the user. A clone without that marker
SHALL NOT be added to the configuration; it is a git repository under a workspace root, so discovery reports it as
integratable and it can be integrated as the `repo-integration` capability specifies. The dialog, while open, SHALL show
each repository's outcome: cloning, tracked, cloned without OpenSpec (with a pointer to **Integrate** under Unmanaged
projects) or failed with its reason. While a clone runs, the projects overview SHALL list it under Unmanaged projects as
`Cloning…` with its `owner/name` and target path, and a clone that failed since the dashboard started SHALL be listed
there with its reason, offering to retry it and to dismiss the entry, until the dashboard restarts. These outcomes are
kept in memory only and are never an input to scanning, columns, counts or actions.

#### Scenario: An OpenSpec repository
- **WHEN** `acme/beta-soc` holds `openspec/config.yaml` and the user clones it into `/w/acme`
- **THEN** `/w/acme/beta-soc` is tracked as `beta-soc` with `enabled: true` and appears under Managed projects after the scan

#### Scenario: A repository without OpenSpec
- **WHEN** `acme/chat-groups` holds no `openspec/config.yaml` and the user clones it into `/w/acme`
- **THEN** the configuration is unchanged, the dialog says it was cloned without OpenSpec, and `/w/acme/chat-groups` is listed under Unmanaged projects labelled `no OpenSpec` with **Integrate**

#### Scenario: Closing the dialog while cloning
- **WHEN** the user activates **Clone** for `acme/beta-soc` and closes the dialog before the clone finished
- **THEN** Unmanaged projects lists `acme/beta-soc` as `Cloning…`, and once the clone finished it is under Managed projects without the user acting

#### Scenario: Retrying a failed clone
- **WHEN** a clone of `acme/beta-soc` failed and the user activates its retry after fixing their credentials
- **THEN** the clone runs again into the same target under the same rules

### Requirement: A cloned repository is an ordinary project

A cloned repository SHALL be an ordinary folder under a workspace root: the dashboard SHALL store nothing about it
having been cloned, and it SHALL be discovered, tracked, scanned, auto-fetched, pulled, cleaned up, disabled, forgotten
and used for agent sessions, pull requests and issues exactly as any other git repository there. The dashboard MUST NOT
delete, move or empty it at any time after the clone succeeded.

#### Scenario: Agent session in a clone
- **WHEN** agent sessions are on and the user starts Implement for a change of the tracked clone `/w/acme/beta-soc`
- **THEN** the session runs in a worktree under `~/.spec-control/worktrees/` on its own branch, and the main checkout is unchanged

#### Scenario: Forgetting a clone
- **WHEN** the user disables and forgets the tracked clone `/w/acme/beta-soc`
- **THEN** the folder is unchanged on disk and after discovery it is listed under Unmanaged projects labelled `OpenSpec`
