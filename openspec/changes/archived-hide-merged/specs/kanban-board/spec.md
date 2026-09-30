# Spec Delta

## ADDED Requirements

### Requirement: Archived changes are told apart as merged or pending
The board SHALL treat an archived change as **pending** — still needing to be pushed or merged — when its archive is found only in a linked worktree and not yet in the repository's main checkout, unless that worktree's work status is known to be `merged`; or when an agent-session worktree of that change reports `uncommitted`, `unpushed` or `pushed` work. Every other archived change SHALL be **merged**: in particular every archive the main checkout holds with no such session worktree, and every archive of a repository without git. The distinction SHALL be derived only from the snapshot and the session worktrees the board already has — from local git, as of the user's last fetch — and SHALL NOT fetch, contact a remote or write anything. With agent sessions disabled, only where the archive was found SHALL decide.

#### Scenario: Archive only in a worktree
- **WHEN** `alpha-infra`'s change `add-audit-log` is archived on the branch of a linked worktree and the main checkout does not hold that archive yet
- **THEN** `add-audit-log` is pending

#### Scenario: Archive arrived in the main checkout
- **WHEN** the change `add-audit-log` was archived, merged, and the main checkout now holds `openspec/changes/archive/<date>-add-audit-log/`, and no session worktree of that change holds unmerged work
- **THEN** `add-audit-log` is merged

#### Scenario: Worktree already merged, main checkout not pulled
- **WHEN** an archive exists only in an agent worktree whose work status is `merged`
- **THEN** the change is merged

#### Scenario: Archive worktree still holds unpushed work
- **WHEN** the main checkout holds a change's archive and that change's archive session worktree reports `unpushed`
- **THEN** the change is pending

#### Scenario: Repository without git
- **WHEN** a tracked folder without git holds an archived change
- **THEN** the change is merged

## MODIFIED Requirements

### Requirement: Board filters
The board SHALL provide filters for repository (multi-select), free-text search over change name and repository name, stale threshold (hide changes with activity within N days, default off), a toggle to hide the `Archived` column, and a toggle to hide merged archived changes (default on). Filters SHALL apply instantly on the client and persist in the URL query string.

#### Scenario: Repo filter
- **WHEN** the user selects repos `beta-soc` and `vcs-admin`
- **THEN** only cards from those two repositories are shown

#### Scenario: Stale filter
- **WHEN** the stale threshold is set to 14 days
- **THEN** only changes whose `lastActivityAt` is older than 14 days are shown

#### Scenario: Filters in URL
- **WHEN** the user reloads the page after setting a text search of `terraform`
- **THEN** the search filter is still applied

#### Scenario: Merged archives hidden by default
- **WHEN** the board opens with no query string and the `Archived` column would hold 30 merged and 2 pending archived changes
- **THEN** the `Archived` column shows only the 2 pending ones and its header count reads `2`

#### Scenario: Showing merged archives
- **WHEN** the user turns **Hide merged** off
- **THEN** the `Archived` column shows merged and pending archived changes alike, the URL holds `merged=1`, and after a reload merged archives are still shown

### Requirement: Archived column is bounded
The `Archived` column SHALL be presented like every other column: always open, with the same width, header layout, repository grouping and cards, and with no collapse, expand or close control of its own. It SHALL show at most the 25 most recently archived changes sorted by archive date descending, among the archived changes the active filters allow — with **Hide merged** on, only pending ones. Its header count SHALL be the total number of archived changes matching the active filters, **Hide merged** included; when more than 25 match, the count SHALL read `25 of <total>`. The "hide archived" filter SHALL remain the way to remove the column from the board. This SHALL apply to the combined board and to repository boards alike. Where the column shows repository groups, those groups follow the minimizing rules for repository groups and are minimized by default; the bound of 25 SHALL be applied before grouping, so a group's count is the number of its changes within the bound. The number of changes shown in the filter bar SHALL count only the archived cards the column shows.

#### Scenario: Open by default
- **WHEN** the combined board loads with 96 archived changes, "hide archived" is off and **Hide merged** is off, for a user with no remembered choices
- **THEN** the `Archived` column is shown open like the other columns with a header count of `25 of 96`, and the 25 most recently archived changes are represented by minimized repository groups whose counts add up to 25

#### Scenario: Fewer archived changes than the bound
- **WHEN** a repository board has 7 archived changes and **Hide merged** is off
- **THEN** the `Archived` column shows all 7 cards, newest archive first, and the header count reads `7`

#### Scenario: Merged archives take no place in the bound
- **WHEN** 96 archived changes match the other filters, 3 of them pending and the 25 most recent all merged, and **Hide merged** is on
- **THEN** the `Archived` column shows the 3 pending changes, newest archive first, with a header count of `3`

#### Scenario: Only merged archives
- **WHEN** every archived change on the board is merged and **Hide merged** is on
- **THEN** the `Archived` column is still shown, empty, with a count of `0`, like any other empty column

#### Scenario: No collapse control
- **WHEN** the `Archived` column is shown
- **THEN** the column itself has no control to collapse, expand or close it, and clicking the column header does nothing

#### Scenario: Hidden by the filter
- **WHEN** the user enables "hide archived"
- **THEN** the `Archived` column is not shown, and it is still not shown after a page reload

### Requirement: The board's filters form one filter bar
The board's filters SHALL be presented as one filter bar below the header band, with the same filters and URL persistence as before: a search field with a leading search icon and, while it holds text, a control that clears it; on the combined board a **Repositories** menu button that shows how many repositories are selected (or `All`) and opens a list of every repository with a checkbox, its colour and name, and its error styling when its last scan failed; a **Stale** selector offering `Any activity` and idle thresholds of 7, 14, 30 and 90 days, which also offers the current threshold when the URL holds another value; a **Hide archived** switch; directly after it a **Hide merged** switch, on by default, disabled while **Hide archived** is on, with a tooltip explaining that it hides archived changes whose archive has reached the main checkout; and **Clear filters** while any filter is active. **Hide merged** SHALL count as an active filter only while it is off, and **Clear filters** SHALL turn it back on. Each selected repository and an active stale threshold SHALL also appear as a removable tag in the bar, and removing a tag SHALL clear that one filter. The **Lanes**/**Stack** layout switch and the number of changes shown SHALL stay at the bar's end. The menu SHALL close on Escape, on a click outside it and on leaving it with the keyboard, SHALL expose its open state to assistive technology, and every control SHALL be operable by keyboard.

#### Scenario: Selecting repositories
- **WHEN** the user opens **Repositories** and checks `alpha-infra` and `beta-soc`
- **THEN** only their cards are shown, the button reads `2`, the bar shows the tags `alpha-infra` and `beta-soc` in their colours, and the URL holds both

#### Scenario: Removing a tag
- **WHEN** the user removes the `beta-soc` tag
- **THEN** only `alpha-infra` stays selected and the menu shows `beta-soc` unchecked

#### Scenario: Custom threshold from the URL
- **WHEN** the board opens with `?stale=10`
- **THEN** the **Stale** selector shows `Idle 10+ days` selected and the tag `Idle 10+ days` is shown

#### Scenario: Hide archived
- **WHEN** the user turns **Hide archived** on
- **THEN** the `Archived` column is removed, the URL holds `archived=0`, exactly as the former checkbox did, and **Hide merged** is disabled

#### Scenario: Hide merged is the default
- **WHEN** the board opens with no query string
- **THEN** **Hide merged** is on, the URL holds no `merged` parameter, and **Clear filters** is not offered

#### Scenario: Clearing restores Hide merged
- **WHEN** **Hide merged** is off and the user activates **Clear filters**
- **THEN** **Hide merged** is on again and the URL no longer holds `merged=1`

#### Scenario: Clearing the search
- **WHEN** the search field holds `sync` and the user activates its clear control
- **THEN** the field is empty and every card that the other filters allow is shown
