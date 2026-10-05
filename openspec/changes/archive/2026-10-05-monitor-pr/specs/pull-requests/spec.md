# Spec Delta

## MODIFIED Requirements

### Requirement: GitHub is contacted only when the user asks
The pull-request query SHALL run only when the user activates a **Refresh** control on the Pull requests view or in a repository's pull-request dialog, when the user opens one of the three views that show pull requests — the Pull requests view, a repository's pull-request dialog, or a Kanban board — and the shown repositories' cached lists are older than five minutes or were never fetched, or as the **pull-request watch** of an open Kanban board ("The board watches pull requests that are not ready"). It MUST NOT run on any other timer, during or after a scan, on page load of a view that shows no pull request, on the projects overview, or as a side effect of another operation. While a refresh runs, the control SHALL show that it is running and SHALL NOT start a second one.

#### Scenario: Opening the view with a stale cache
- **WHEN** the user opens `/pull-requests` and the last fetch was 20 minutes ago
- **THEN** the cached lists are shown at once, marked with their age, and a refresh runs and replaces them when it completes

#### Scenario: Opening the view with a fresh cache
- **WHEN** the user opens `/pull-requests` two minutes after the last fetch
- **THEN** the cached lists are shown and GitHub is not contacted

#### Scenario: Explicit refresh
- **WHEN** the user activates Refresh one minute after the last fetch
- **THEN** GitHub is queried regardless of the cache's age

#### Scenario: Overview and scans stay offline
- **WHEN** the dashboard runs for an hour with the projects overview open and scans on its poll interval
- **THEN** no `gh` process is started

#### Scenario: Opening the board with a stale cache
- **WHEN** the user opens a board and the last fetch was 20 minutes ago
- **THEN** the cards show what the cache holds at once, and one refresh runs and updates them when it completes

#### Scenario: Opening the board with a fresh cache
- **WHEN** the user opens a board two minutes after the last fetch
- **THEN** the cached pull requests are shown and no `gh` process is started

#### Scenario: Moving between boards does not re-fetch
- **WHEN** the user opens the combined board, then a repository board, within five minutes of a fetch
- **THEN** GitHub is contacted once at most, and not a second time for the second board

#### Scenario: The board does not fetch on a timer
- **WHEN** a board stays open for an hour while scans run on the poll interval, and none of its cards links an open pull request that is not ready
- **THEN** no `gh` process is started after the one refresh the board's opening may have caused

#### Scenario: The Pull requests view does not watch
- **WHEN** the Pull requests view stays open for an hour and lists an open pull request whose checks are running
- **THEN** no `gh` process is started after the one refresh its opening may have caused

#### Scenario: The overview is still offline
- **WHEN** the user opens the projects overview with a cache two hours old
- **THEN** the cached counts are shown and no `gh` process is started

### Requirement: What a pull-request list contains
For each queried GitHub repository the list SHALL contain every open pull request, drafts included, and every pull request merged or closed within the last 7 days, up to 100 open and 50 recently closed ones; when a limit is reached the list SHALL say it is truncated. Each pull request SHALL carry its number, title, URL, author login, head and base branch, whether it is a draft, its state (`open`, `merged` or `closed`), when it was opened and, when applicable, merged or closed, its review decision (approved, changes requested, review required, or none), whether review is requested from the signed-in user, a summary of its checks (passing, failing, pending, or none), and its mergeability as GitHub reports it (`mergeable`, `conflicting`, or `unknown` while GitHub has not computed it). Mergeability SHALL be read with the same `gh pr list` call as every other field. A cached pull request written before mergeability was read, or carrying a value the dashboard does not recognise, SHALL be treated as `unknown`.

#### Scenario: Merged last week and last month
- **WHEN** a repository has a pull request merged 3 days ago and one merged 30 days ago
- **THEN** the first is listed as merged and the second is not listed

#### Scenario: Check summary
- **WHEN** an open pull request has one failing and three passing checks
- **THEN** its checks summary is failing

#### Scenario: Truncated
- **WHEN** a repository has 140 open pull requests
- **THEN** 100 are listed and the list says it is truncated

#### Scenario: Conflicting pull request
- **WHEN** GitHub reports an open pull request's mergeability as `CONFLICTING`
- **THEN** it is listed with mergeability `conflicting`, and no `gh` subcommand other than `gh pr list` was run to learn it

#### Scenario: A cache from an earlier version
- **WHEN** the cache holds a pull request without mergeability
- **THEN** it is shown with mergeability `unknown` and nothing fails

### Requirement: A pull request is linked to a change by its head branch
A cached pull request SHALL be shown as a change's pull request when it belongs to that change's repository and its head branch is exactly one of the change's **candidate branches**, compared as written with no normalisation, abbreviation or containment. A change's candidate branches are its `branchMatch`, when it has one, and the two branches the dashboard's own agent sessions create for that change: the implementation branch `feat/<name>` and the archive branch `chore/archive-<name>`, where `<name>` is the change name exactly as written. The candidates SHALL be the same for an active and an archived change, and the session branch names SHALL be the same ones the dashboard uses when it creates a session's branch. A change whose candidate branches match no cached pull request SHALL be shown without one. The dashboard MUST NOT infer a link from the pull request's title, from a branch that merely contains or resembles the change name, or from any branch other than the candidates.

A merged or closed pull request that was merged or closed more than one day before the change's creation date SHALL NOT be linked to that change, so a change that reuses the name of an earlier one does not inherit its pull request. A change without a creation date, and an open pull request, are not affected by this rule.

Where several cached pull requests match, across all of the change's candidate branches, exactly one SHALL be shown: an `open` one (a draft counts as open) in preference to any other, otherwise the one most recently merged, closed or opened, otherwise the one with the higher number. The choice SHALL be deterministic and SHALL be the same wherever the link is shown.

The link SHALL be derived when it is displayed, from the snapshot and the cached lists. It MUST NOT be stored in a change's snapshot, written to any cache, or recorded in the activity log, and it MUST NOT affect a change's column, sub-state, progress, counts, filters or available actions. The only things the link and its readiness may change are what the change's card and detail header display — the pull-request badge and the card's working state (`kanban-board`: "A card keeps its working state until its pull request is ready") — and which repositories a board's pull-request watch refreshes.

#### Scenario: Exact branch match
- **WHEN** change `add-validate-phase` has `branchMatch: feat/add-validate-phase` and a cached open pull request `#125` has that head branch in the same repository
- **THEN** `#125` is shown as that change's pull request

#### Scenario: Worktree removed after the merge
- **WHEN** change `add-validate-phase` lives only in the main checkout on `main`, has no `branchMatch` because its session's worktree was removed, and a cached merged pull request `#125` has the head branch `feat/add-validate-phase`
- **THEN** `#125` is shown as that change's pull request, marked as merged

#### Scenario: Archive awaiting review
- **WHEN** change `add-validate-phase` is archived, its merged implementation pull request `#125` has the head branch `feat/add-validate-phase`, and an open pull request `#131` has the head branch `chore/archive-add-validate-phase`
- **THEN** `#131` is shown as that change's pull request

#### Scenario: Archive merged
- **WHEN** both `#125` (head `feat/add-validate-phase`, merged on 1 October) and `#131` (head `chore/archive-add-validate-phase`, merged on 2 October) are merged
- **THEN** `#131` is shown as that change's pull request

#### Scenario: No pull request for the branch
- **WHEN** none of a change's candidate branches matches a cached pull request
- **THEN** the change is shown without a pull request

#### Scenario: Off-convention branch name
- **WHEN** a pull request's head branch is `jan/125-add-validate-phase` and the change `add-validate-phase` has `branchMatch: feat/add-validate-phase`
- **THEN** no pull request is shown for that change

#### Scenario: Name containment is not a match
- **WHEN** change `add-validate` has `branchMatch: feat/add-validate` and the only cached pull requests have the head branches `feat/add-validate-phase` and `chore/archive-add-validate-phase`
- **THEN** no pull request is shown for `add-validate`

#### Scenario: Same branch in another repository
- **WHEN** a cached pull request of another tracked repository has the head branch `feat/<name>` of this change
- **THEN** it is not shown for this change

#### Scenario: Open wins over merged
- **WHEN** one merged and one open pull request match a change's candidate branches
- **THEN** the open one is shown

#### Scenario: Several closed pull requests
- **WHEN** two closed pull requests match a change's candidate branches and neither is open
- **THEN** the one most recently closed is shown

#### Scenario: A reused change name
- **WHEN** change `rotate-keys` was created on 20 September and the only cached pull request on `feat/rotate-keys` was merged on 10 September
- **THEN** no pull request is shown for `rotate-keys`

#### Scenario: Change without a branch
- **WHEN** a change has no `branchMatch` and no cached pull request has the head branch `feat/<name>` or `chore/archive-<name>`
- **THEN** it is shown without a pull request

#### Scenario: The link changes nothing else
- **WHEN** a change gains a linked pull request whose checks are still running
- **THEN** its column, sub-state, progress, the counts it contributes to and the starters it offers are unchanged, and the activity log records nothing

#### Scenario: Cache deleted
- **WHEN** the pull-request cache is deleted
- **THEN** no change shows a pull request and everything else is unchanged

## ADDED Requirements

### Requirement: A linked open pull request has a readiness
The dashboard SHALL derive, for display only, the **readiness** of an `open` pull request (drafts included) from its cached fields: it is **ready** when it is not a draft, its checks summary is `passing` or `none`, and its mergeability is `mergeable`; otherwise it is **not ready** with exactly one reason, the first that applies in this order: `draft`, `conflicts` (mergeability `conflicting`), `checks failing`, `checks running` (checks `pending`), `mergeability unknown`. A merged or closed pull request SHALL have no readiness. The review decision SHALL NOT enter into readiness. A not-ready pull request is **in progress** when its reason is `checks running` or `mergeability unknown` — something on GitHub is still being computed — and **waiting** otherwise. The rule SHALL be one shared rule, so that the card, the detail header and the watch never disagree, and like the link it SHALL be derived on display and never stored, logged or used as an input to scanning, columns, counts, filters or actions.

#### Scenario: Green and mergeable
- **WHEN** an open, non-draft pull request has passing checks and mergeability `mergeable`
- **THEN** it is ready

#### Scenario: No checks configured
- **WHEN** an open, non-draft pull request has no checks and mergeability `mergeable`
- **THEN** it is ready

#### Scenario: Checks still running
- **WHEN** an open pull request's checks are pending and it is mergeable
- **THEN** it is not ready, its reason is `checks running`, and it is in progress

#### Scenario: Conflict outranks checks
- **WHEN** an open pull request conflicts with its base and its checks are failing
- **THEN** it is not ready, its reason is `conflicts`, and it is waiting

#### Scenario: Mergeability not computed yet
- **WHEN** an open pull request's checks pass and its mergeability is `unknown`
- **THEN** it is not ready, its reason is `mergeability unknown`, and it is in progress

#### Scenario: Approval does not matter
- **WHEN** an open pull request is green and mergeable and its review decision is `review_required`
- **THEN** it is ready

#### Scenario: Draft
- **WHEN** an open pull request is a draft with passing checks
- **THEN** it is not ready, its reason is `draft`, and it is waiting

#### Scenario: Merged
- **WHEN** a pull request is merged
- **THEN** it has no readiness

### Requirement: The board watches pull requests that are not ready
While a Kanban board is open and the browser tab showing it is visible, and at least one card on it links an open pull request that is not ready, the board SHALL refresh the pull-request lists of exactly the repositories of those cards on its own — the **pull-request watch** — ignoring the five-minute freshness window. The next watch refresh SHALL be due 60 seconds after the previous refresh settled while at least one watched pull request is in progress, and five minutes after it while every watched pull request is only waiting. The watch SHALL stop as soon as no card on the board links an open pull request that is not ready, when the user leaves the board, and while the tab is hidden; when the tab becomes visible again it SHALL resume on the same schedule, counted from the last refresh. A watch refresh SHALL share the one-refresh-at-a-time rule with every other refresh: when a refresh is already running the watch SHALL NOT start another. It SHALL refresh only enabled repositories whose pull requests can be queried, and a repository that is unavailable (not on GitHub, `gh` missing or not signed in) SHALL NOT be watched. Lists that are synthetic (the demo) SHALL never be watched. The watch SHALL use the same read-only query as every other refresh and MUST NOT change anything on GitHub or in any repository.

#### Scenario: Watching running checks
- **WHEN** a board is open and visible and one card links open pull request `#125` of `alpha-infra` whose checks are running
- **THEN** about a minute after the last refresh `alpha-infra`'s pull requests are queried again, and no other repository is queried by the watch

#### Scenario: Waiting on a conflict slows down
- **WHEN** the only not-ready pull request on an open board conflicts with its base
- **THEN** the watch queries its repository again five minutes after the last refresh, not every minute

#### Scenario: Ready ends the watch
- **WHEN** a watch refresh finds that `#125`'s checks now pass and it is mergeable, and no other card links a not-ready pull request
- **THEN** no further `gh` process is started while the board stays open

#### Scenario: Hidden tab
- **WHEN** the tab showing the board is hidden for ten minutes while `#125`'s checks are running
- **THEN** no `gh` process is started in that time, and a refresh runs once the tab is visible again and the minute since the last refresh has passed

#### Scenario: Leaving the board
- **WHEN** the user moves from the board to the projects overview while `#125`'s checks are running
- **THEN** the watch stops and no further `gh` process is started

#### Scenario: One refresh at a time
- **WHEN** a watch refresh is due while a refresh the user started is still running
- **THEN** no second refresh starts

#### Scenario: Demo
- **WHEN** the demo shows a card whose pull request's checks are running
- **THEN** nothing is ever refreshed for it
