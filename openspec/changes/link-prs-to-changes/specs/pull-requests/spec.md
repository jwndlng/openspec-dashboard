# Spec Delta

## MODIFIED Requirements

### Requirement: GitHub is contacted only when the user asks
The pull-request query SHALL run only when the user activates a **Refresh** control on the Pull requests view or in a repository's pull-request dialog, or when the user opens one of the three views that show pull requests — the Pull requests view, a repository's pull-request dialog, or a Kanban board — and the shown repositories' cached lists are older than five minutes or were never fetched. It MUST NOT run on a timer, during or after a scan, on page load of a view that shows no pull request, on the projects overview, or as a side effect of another operation. While a refresh runs, the control SHALL show that it is running and SHALL NOT start a second one.

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
- **WHEN** a board stays open for an hour while scans run on the poll interval
- **THEN** no `gh` process is started after the one refresh the board's opening may have caused

#### Scenario: The overview is still offline
- **WHEN** the user opens the projects overview with a cache two hours old
- **THEN** the cached counts are shown and no `gh` process is started

## ADDED Requirements

### Requirement: A pull request is linked to a change by its head branch
A cached pull request SHALL be shown as a change's pull request when it belongs to that change's repository and its head branch is exactly the change's `branchMatch`, compared as written with no normalisation, abbreviation or containment. A change without a `branchMatch`, and a change whose `branchMatch` matches no cached pull request, SHALL be shown without one. The dashboard MUST NOT infer a link from the change name, the pull request's title, or any part of a branch name.

Where several cached pull requests share that head branch, exactly one SHALL be shown: an `open` one (a draft counts as open) in preference to any other, otherwise the one most recently merged, closed or updated. The choice SHALL be deterministic and SHALL be the same wherever the link is shown.

The link SHALL be derived when it is displayed, from the snapshot and the cached lists. It MUST NOT be stored in a change's snapshot, written to any cache, or recorded in the activity log, and it MUST NOT affect a change's column, sub-state, progress, counts, filters or available actions.

#### Scenario: Exact branch match
- **WHEN** change `add-validate-phase` has `branchMatch: feat/add-validate-phase` and a cached open pull request `#125` has that head branch in the same repository
- **THEN** `#125` is shown as that change's pull request

#### Scenario: No pull request for the branch
- **WHEN** a change's `branchMatch` matches no cached pull request
- **THEN** the change is shown without a pull request

#### Scenario: Off-convention branch name
- **WHEN** a pull request's head branch is `jan/125-add-validate-phase` and the change's `branchMatch` is `feat/add-validate-phase`
- **THEN** no pull request is shown for that change

#### Scenario: Name containment is not a match
- **WHEN** change `add-validate` has `branchMatch: feat/add-validate` and the only cached pull request has the head branch `feat/add-validate-phase`
- **THEN** no pull request is shown for `add-validate`

#### Scenario: Same branch in another repository
- **WHEN** a cached pull request of another tracked repository has the same head branch as this change's `branchMatch`
- **THEN** it is not shown for this change

#### Scenario: Open wins over merged
- **WHEN** one merged and one open pull request share a change's head branch
- **THEN** the open one is shown

#### Scenario: Several closed pull requests
- **WHEN** two closed pull requests share a change's head branch and neither is open
- **THEN** the one most recently closed is shown

#### Scenario: Change without a branch
- **WHEN** a change has no `branchMatch`
- **THEN** it is shown without a pull request and no matching is attempted

#### Scenario: The link changes nothing else
- **WHEN** a change gains a linked pull request
- **THEN** its column, sub-state, progress, the counts it contributes to and the starters it offers are unchanged, and the activity log records nothing

#### Scenario: Cache deleted
- **WHEN** the pull-request cache is deleted
- **THEN** no change shows a pull request and everything else is unchanged
