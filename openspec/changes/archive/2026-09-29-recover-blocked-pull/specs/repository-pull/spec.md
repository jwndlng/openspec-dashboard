# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
