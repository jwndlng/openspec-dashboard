# Spec Delta

## MODIFIED Requirements

### Requirement: Board filters
The board SHALL provide filters for repository (multi-select), free-text search over change name and repository name, stale threshold (hide changes with activity within N days, default off), a toggle to hide the `Archived` column, and a toggle to hide merged archived changes (default on). **Hide merged** SHALL NOT hide an archived change while an agent session started for that change — its own session or its archive session — is running: such a change SHALL stay in the `Archived` column, take its place among the changes the column's count and bound consider, and be shown whether it is merged or pending. A session that has ended (exited or failed) SHALL NOT keep a change; once every session of the change has ended, **Hide merged** SHALL apply to it as to any other archived change, so the user ends the session to let a merged change be hidden. Running a session SHALL NOT make a change pending, and the main console and integration sessions, which belong to no change, SHALL keep no change. Which sessions are running SHALL come from the session list the board already has, without fetching or writing anything. Filters SHALL apply instantly on the client and persist in the URL query string.

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

#### Scenario: Running session keeps a merged archive
- **WHEN** **Hide merged** is on and `alpha-infra`'s merged archived change `add-audit-log` has a running agent session
- **THEN** `add-audit-log` is shown in the `Archived` column and counted in its header count

#### Scenario: Ending the session lets it be hidden
- **WHEN** the user ends that session while **Hide merged** is on
- **THEN** once the board has the updated session list, `add-audit-log` is no longer shown in the `Archived` column and its header count drops by one

#### Scenario: Ended sessions keep nothing
- **WHEN** **Hide merged** is on and a merged archived change has only sessions that exited or failed
- **THEN** the change is not shown in the `Archived` column

#### Scenario: Session of another change
- **WHEN** **Hide merged** is on and a running session belongs to `add-audit-log` of `beta-soc`, while `alpha-infra` also has a merged archived change `add-audit-log`
- **THEN** only `beta-soc`'s change is kept; `alpha-infra`'s is hidden

### Requirement: The board's filters form one filter bar
The board's filters SHALL be presented as one filter bar below the header band, with the same filters and URL persistence as before: a search field with a leading search icon and, while it holds text, a control that clears it; on the combined board a **Repositories** menu button that shows how many repositories are selected (or `All`) and opens a list of every repository with a checkbox, its colour and name, and its error styling when its last scan failed; a **Stale** selector offering `Any activity` and idle thresholds of 7, 14, 30 and 90 days, which also offers the current threshold when the URL holds another value; a **Hide archived** switch; directly after it a **Hide merged** switch, on by default, disabled while **Hide archived** is on, with a tooltip explaining that it hides archived changes whose archive has reached the main checkout and that a change with a running agent session stays shown until that session is ended; and **Clear filters** while any filter is active. **Hide merged** SHALL count as an active filter only while it is off, and **Clear filters** SHALL turn it back on. Each selected repository and an active stale threshold SHALL also appear as a removable tag in the bar, and removing a tag SHALL clear that one filter. The **Lanes**/**Stack** layout switch and the number of changes shown SHALL stay at the bar's end. The menu SHALL close on Escape, on a click outside it and on leaving it with the keyboard, SHALL expose its open state to assistive technology, and every control SHALL be operable by keyboard.

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
