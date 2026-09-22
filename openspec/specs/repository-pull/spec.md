# repository-pull Specification

## Purpose
Defines the pull action: the one user-requested operation that contacts a repository's remote and updates its main checkout — a fetch followed by a fast-forward-only merge of the upstream, the cases in which the update is refused rather than forced, how credentials, prompts and hooks are handled, and where the action is offered in the UI.

## Requirements

### Requirement: Pull fetches, then fast-forwards only
The pull action SHALL, in the repository's main checkout, first fetch from the remote of the checked-out branch's upstream (or from `origin` when the branch has no upstream but that remote exists), and then — only when the checkout is on the repository's default branch, that branch has an upstream, and it is behind it — update it with a fast-forward-only merge of the upstream. It MUST NOT create a merge commit, rebase, stash, reset, force, delete or switch branches, and MUST NOT touch linked worktrees or submodules. Uncommitted changes to files the fast-forward does not touch SHALL be left as they are. The fetch MUST NOT trigger automatic repository maintenance.

#### Scenario: Behind and clean
- **WHEN** the main checkout is on its default branch, clean, and two commits behind its upstream
- **THEN** after the pull it is at the upstream's commit and the result says it was fast-forwarded by 2 commits

#### Scenario: Already up to date
- **WHEN** the remote has nothing new
- **THEN** the result says `up to date` and the working tree, index and branch are unchanged

#### Scenario: Unrelated local edits survive
- **WHEN** the checkout has an uncommitted edit to `notes.md` and the incoming commits only change `src/app.ts`
- **THEN** the fast-forward happens and `notes.md` still has the uncommitted edit

#### Scenario: Worktrees are left alone
- **WHEN** a repository with three linked worktrees is pulled
- **THEN** no file, index or branch of any linked worktree changes

### Requirement: The update is refused rather than forced
When the fast-forward cannot be done safely the action SHALL leave the branch, index and working tree exactly as they were and SHALL report why, while the fetch SHALL still have run: when the checkout is not on the repository's default branch or is detached (`skipped`), when the branch has no upstream (`skipped`), when local and remote history have diverged (`refused`), and when an uncommitted change would be overwritten (`refused`, with git's message). A repository without any remote SHALL be reported as having nothing to pull, without running a fetch. A fetch that fails SHALL be reported as `failed` with git's reason and SHALL NOT be followed by an update.

#### Scenario: On a feature branch
- **WHEN** the main checkout is on `feat/redesign` and the default branch is `main`
- **THEN** the remote is fetched, nothing in the working tree changes, and the result says it only fetched because the checkout is on `feat/redesign`, not `main`

#### Scenario: Diverged
- **WHEN** the default branch has one local commit the remote lacks and the remote has one the checkout lacks
- **THEN** the update is refused as diverged and the local commit and working tree are untouched

#### Scenario: Overlapping local edit
- **WHEN** `src/app.ts` has an uncommitted edit and an incoming commit changes `src/app.ts`
- **THEN** the update is refused with git's message, and the edit, the index and the branch are unchanged

#### Scenario: Remote unreachable
- **WHEN** the remote cannot be reached
- **THEN** the result is `failed` with the reason, and nothing in the repository's working tree changed

#### Scenario: No remote
- **WHEN** the repository has no remote configured
- **THEN** the result says there is nothing to pull and no fetch is run

### Requirement: Credentials, prompts and hooks
The action SHALL rely on git's own credential handling (SSH agent, credential helpers) and the dashboard MUST NOT read, store, request, log or forward credentials. It MUST NOT prompt: terminal prompts SHALL be disabled and SSH SHALL run in batch mode unless the user has configured their own SSH command through the environment, so that a remote requiring interaction fails instead of waiting. The fetch SHALL have a timeout after which it is stopped and reported as failed. Repository hooks MUST NOT run as part of the action; when the repository has a `post-merge` hook and a fast-forward happened, the result SHALL say that hooks were not run. Any text returned to the browser SHALL have credentials embedded in URLs masked.

#### Scenario: Login required
- **WHEN** the remote needs a password and no credential helper provides one
- **THEN** the pull fails with a reason within the timeout and no prompt appears anywhere

#### Scenario: Hook present
- **WHEN** the repository has an executable `post-merge` hook and the pull fast-forwards
- **THEN** the hook does not run and the result says hooks were not run

#### Scenario: Credentials in an error
- **WHEN** git's error message contains `https://user:secret@host/repo.git`
- **THEN** the reason shown has the user and secret masked

#### Scenario: Remote never answers
- **WHEN** the fetch produces no result within the timeout
- **THEN** the process is stopped and the result is `failed: timed out`

### Requirement: Pull is offered where repositories are shown, and only runs on request
The repository board header and each git repository's row in the projects overview SHALL offer a Pull action, and the overview SHALL offer "Pull all". The dialog that ends an agent session SHALL offer a pull for that session's repository as part of confirming it, under the rules of the `agent-sessions` capability. While a pull runs the control SHALL show that it is running and SHALL NOT start a second one, nor SHALL a second one be started for the same repository from another of these places. The outcome SHALL be shown next to the control as text — up to date, fast-forwarded with the number of commits, fetched only, refused, or failed — with the reason available, and the view SHALL update from the rescan without a page reload. Using the control in an overview row MUST NOT navigate into the repository. Nothing SHALL pull without the user activating one of these controls.

#### Scenario: From the overview
- **WHEN** the user activates Pull in the row of a repository that is three commits behind
- **THEN** the row shows that it is running, then `+3 commits`, the overview stays where it is, and the repository's data refreshes

#### Scenario: Pull all
- **WHEN** the user activates "Pull all" with five git repositories tracked
- **THEN** each repository's outcome is listed, including any that were only fetched or failed, with their reasons

#### Scenario: Non-git repository
- **WHEN** a tracked repository is not a git repository
- **THEN** no Pull action is offered for it

#### Scenario: From the end-session dialog
- **WHEN** the user confirms the end-session dialog with its pull offer selected
- **THEN** that repository is pulled once, and the outcome is reported both in the dialog and next to the repository's Pull control

#### Scenario: Already running elsewhere
- **WHEN** a pull for a repository is still running and the user confirms an end-session dialog for that repository with the pull offer selected
- **THEN** no second pull is started and the running pull's outcome is the one reported
