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
When the fast-forward cannot be done safely the action SHALL leave the branch, index and working tree exactly as they were and SHALL report why, while the fetch SHALL still have run: when the checkout is not on the repository's default branch or is detached (`skipped`), when the branch has no upstream (`skipped`), when local and remote history have diverged (`refused`), and when an uncommitted change would be overwritten (`refused`). A refusal because of uncommitted changes SHALL list the **blocking files** — every path that has an uncommitted change in the main checkout (staged, unstaged or untracked) and that the incoming commits change — each classified as a change leftover (identical or differing, see "Change leftovers blocking a pull are resolved on confirmation") or as local work; when git refuses but no blocking file can be determined, git's message SHALL be reported instead. Every refusal SHALL say in plain words what the user can do: for local work, commit or set aside the listed files and pull again; for diverged history, reconcile the local commits outside the dashboard. The result MUST NOT suggest forcing, resetting or discarding anything. A repository without any remote SHALL be reported as having nothing to pull, without running a fetch. A fetch that fails SHALL be reported as `failed` with git's reason and SHALL NOT be followed by an update.

#### Scenario: On a feature branch
- **WHEN** the main checkout is on `feat/redesign` and the default branch is `main`
- **THEN** the remote is fetched, nothing in the working tree changes, and the result says it only fetched because the checkout is on `feat/redesign`, not `main`

#### Scenario: Diverged
- **WHEN** the default branch has one local commit the remote lacks and the remote has one the checkout lacks
- **THEN** the update is refused as diverged, the result says the local commit has to be reconciled outside the dashboard without suggesting a force, and the local commit and working tree are untouched

#### Scenario: Overlapping local edit
- **WHEN** `src/app.ts` has an uncommitted edit and an incoming commit changes `src/app.ts`
- **THEN** the update is refused, the result lists `src/app.ts` as local work and says to commit or set it aside and pull again, and the edit, the index and the branch are unchanged

#### Scenario: Only files the incoming commits touch are listed
- **WHEN** `src/app.ts` and `notes.md` have uncommitted edits and the incoming commits change only `src/app.ts`
- **THEN** the blocking files are exactly `src/app.ts`

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

### Requirement: Change leftovers blocking a pull are resolved on confirmation
A blocking file SHALL be a **change leftover** when all of these hold: its path lies inside `openspec/changes/<name>/` for a valid change name other than `archive`; it is not in the checkout's current commit; locally it is only a new file, staged or untracked (not also deleted); and the incoming upstream commit contains it. A leftover SHALL be **identical** when its working-tree content and, when staged, its staged content both equal the incoming content, and SHALL **differ** otherwise. Any other blocking file SHALL be **local work**.

When every blocking file is a change leftover, the refused result SHALL offer **Resolve and pull**, naming each leftover and whether it differs. Nothing SHALL happen until the user confirms. On confirmation the dashboard SHALL NOT fetch again; it SHALL re-determine the blocking files itself and SHALL proceed only when the upstream still points at the commit the user was shown, the blocking files are exactly the ones shown, each is still a change leftover, and each still has the content it had when shown. Otherwise it SHALL change nothing and report the pull refused with the reason. When it proceeds it SHALL, in this order: save a copy of every leftover that differs under `~/.openspec-dashboard/` (its working-tree content, and its staged content too when that is different again); remove the leftovers, and only them, from the main checkout's index and working tree; and run the fast-forward again. The result SHALL name every file it replaced and, for each copy, where it was saved. When the retried fast-forward is still refused, the dashboard SHALL put each leftover back as it was — its content, and whether it was staged — and report the pull refused; the copies SHALL be kept.

When any blocking file is local work, no resolution SHALL be offered and a request to resolve SHALL be refused without touching anything. Resolve and pull SHALL be offered for one repository at a time, from every place a pull outcome is shown, and never by "Pull all" for several repositories at once.

#### Scenario: Identical leftover
- **WHEN** `openspec/changes/add-login/.openspec.yaml` was created and staged locally, and the incoming commits add that file with the same content, and git refuses the fast-forward
- **THEN** the result offers Resolve and pull, and after confirmation the checkout is fast-forwarded, the file has the incoming content and is tracked, and no copy was saved

#### Scenario: Differing leftover
- **WHEN** a staged `openspec/changes/add-login/prompt.md` differs from the one the incoming commits add
- **THEN** after confirmation a copy of the local `prompt.md` exists under `~/.openspec-dashboard/`, the checkout is fast-forwarded, and the result names the replaced file and where its copy is

#### Scenario: Untracked leftover
- **WHEN** a change's files were created but never staged, and the incoming commits add the same paths
- **THEN** they are classified as change leftovers and can be resolved the same way

#### Scenario: Leftover mixed with local work
- **WHEN** the blocking files are a staged change leftover and an uncommitted edit to `src/app.ts`
- **THEN** no resolution is offered, `src/app.ts` is listed as local work, and a resolve request is refused with every file, the index and the branch unchanged

#### Scenario: A file already in the current commit is not a leftover
- **WHEN** `openspec/changes/add-login/proposal.md` is tracked in the current commit, has an uncommitted edit, and the incoming commits change it
- **THEN** it is listed as local work

#### Scenario: Leftover changed after the offer
- **WHEN** Resolve and pull was offered and the user edits the leftover before confirming
- **THEN** the confirmation is refused because the file changed, and nothing is removed, copied or merged

#### Scenario: Upstream moved after the offer
- **WHEN** another fetch moved the upstream to a newer commit between the offer and the confirmation
- **THEN** the confirmation is refused, nothing is touched, and the user is asked to pull again

#### Scenario: Retried fast-forward still refused
- **WHEN** after the leftovers were removed the fast-forward is refused because another file changed meanwhile
- **THEN** each leftover is back with its content and staged state, any copies remain, and the result is refused with the reason

#### Scenario: Pull all
- **WHEN** "Pull all" runs and one repository is blocked only by change leftovers
- **THEN** that repository's outcome lists its leftovers and offers Resolve and pull for it alone, and nothing is resolved without that repository's own confirmation
