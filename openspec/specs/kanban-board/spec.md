# kanban-board Specification

## Purpose
Defines the Kanban board UI: how changes map to columns, what cards display, filtering, the archived column, refresh behaviour, the copy-apply-command action and the visual design tokens.

## Requirements

### Requirement: Board columns are derived from schema and implementation state
The board SHALL place each change in exactly one column, where a column names the last step of the lifecycle that is complete. Using, in order: `Archived` if the change is archived; `Synced` if `tasks.total > 0`, `tasks.done == tasks.total` and the change's delta specs are synced into the main specs (a change without delta specs counts as synced); `Done` if `tasks.total > 0` and `tasks.done == tasks.total`; `Implementing` if `tasks.done > 0`; `Ready` if every artifact is done (ready to apply, nothing ticked yet); `Unknown` if the change's artifacts could not be read; otherwise, taking the schema's artifacts in display order, `New` if the first artifact is not done, else the display name of the last artifact of the longest leading run of done artifacts.

Display order SHALL be the schema's own artifact order, except that for the `spec-driven` schema it SHALL be `proposal`, `design`, `specs`, `tasks` (artifacts not named there follow in schema order). Column order SHALL be `New`, then the artifact columns of the majority schema followed by any additional artifact columns of other schemas, each schema omitting its last artifact in display order (completing it means every artifact is done, which is `Ready`), then `Ready`, `Implementing`, `Done`, `Synced`, `Archived`. Apart from the display-order exception, columns MUST NOT be hardcoded to the `spec-driven` schema.

A change in `Synced` SHALL be treated as complete wherever a change in `Done` is: the completion badge on its card, the highlighted column count, and every "to archive" count.

#### Scenario: Brand-new change
- **WHEN** a change directory exists and its `proposal` artifact is not done
- **THEN** it appears in the `New` column

#### Scenario: Change with proposal only
- **WHEN** a `spec-driven` change has `proposal: done` and `design` and `specs` not done
- **THEN** it appears in the `Proposal` column

#### Scenario: Design written
- **WHEN** a `spec-driven` change has `proposal` and `design` done and `specs` not done
- **THEN** it appears in the `Design` column

#### Scenario: Specs written before design
- **WHEN** a `spec-driven` change has `proposal` and `specs` done and `design` not done
- **THEN** it appears in the `Proposal` column, because `design` precedes `specs` in display order

#### Scenario: Specs written, tasks not yet
- **WHEN** a `spec-driven` change has `proposal`, `design` and `specs` done and `tasks` not done
- **THEN** it appears in the `Specs` column

#### Scenario: Ready to apply
- **WHEN** all artifacts are done and `tasks` is `done: 0, total: 12`
- **THEN** it appears in `Ready` showing `0/12`

#### Scenario: First task ticked
- **WHEN** all artifacts are done and `tasks` is `done: 1, total: 12`
- **THEN** it appears in `Implementing` showing `1/12`

#### Scenario: Tasks ticked while an artifact is still open
- **WHEN** `design` is not done and `tasks` is `done: 2, total: 12`
- **THEN** it appears in `Implementing`

#### Scenario: Complete but not synced
- **WHEN** `tasks` is `done: 12, total: 12`, the change is not archived, and its delta specs are not yet reflected in the main specs
- **THEN** it appears in the `Done` column

#### Scenario: Synced, waiting to be archived
- **WHEN** `tasks` is `done: 12, total: 12`, the change is not archived, and its delta specs are reflected in the main specs
- **THEN** it appears in the `Synced` column with the completion badge and counts towards "to archive"

#### Scenario: Complete change without delta specs
- **WHEN** `tasks` is `done: 5, total: 5` and the change has no delta spec files
- **THEN** it appears in the `Synced` column

#### Scenario: All artifacts done but tasks file empty
- **WHEN** all artifacts are done and `tasks` is `done: 0, total: 0`
- **THEN** it appears in `Ready` with a "no tasks" warning badge

#### Scenario: Column list for the spec-driven schema
- **WHEN** every tracked change uses the `spec-driven` schema
- **THEN** the board shows the columns `New`, `Proposal`, `Design`, `Specs`, `Ready`, `Implementing`, `Done`, `Synced`, `Archived`, with no `Tasks` column

#### Scenario: Another schema keeps its own order
- **WHEN** every tracked change uses a schema whose artifacts are `brief`, `plan`, `checklist` in that order
- **THEN** the board shows `New`, `Brief`, `Plan`, `Ready`, `Implementing`, `Done`, `Synced`, `Archived`

#### Scenario: Lifecycle columns are always present
- **WHEN** no change is new, ready to apply or synced
- **THEN** the board still shows empty `New`, `Ready` and `Synced` columns in their positions

#### Scenario: Unreadable change
- **WHEN** a change's artifacts could not be read
- **THEN** it appears in the `Unknown` column, not in `New`

### Requirement: Board filters
The board SHALL provide filters for repository (multi-select), free-text search over change name and repository name, stale threshold (hide changes with activity within N days, default off), and a toggle to hide the `Archived` column. Filters SHALL apply instantly on the client and persist in the URL query string.

#### Scenario: Repo filter
- **WHEN** the user selects repos `beta-soc` and `vcs-admin`
- **THEN** only cards from those two repositories are shown

#### Scenario: Stale filter
- **WHEN** the stale threshold is set to 14 days
- **THEN** only changes whose `lastActivityAt` is older than 14 days are shown

#### Scenario: Filters in URL
- **WHEN** the user reloads the page after setting a text search of `terraform`
- **THEN** the search filter is still applied

### Requirement: Archived column is bounded
The `Archived` column SHALL be presented like every other column: always open, with the same width, header layout, repository grouping and cards, and with no collapse, expand or close control of its own. It SHALL show at most the 25 most recently archived changes sorted by archive date descending. Its header count SHALL be the total number of archived changes matching the active filters; when more than 25 match, the count SHALL read `25 of <total>`. The "hide archived" filter SHALL remain the way to remove the column from the board. This SHALL apply to the combined board and to repository boards alike. Where the column shows repository groups, those groups follow the minimizing rules for repository groups and are minimized by default; the bound of 25 SHALL be applied before grouping, so a group's count is the number of its changes within the bound.

#### Scenario: Open by default
- **WHEN** the combined board loads with 96 archived changes and "hide archived" is off, for a user with no remembered choices
- **THEN** the `Archived` column is shown open like the other columns with a header count of `25 of 96`, and the 25 most recently archived changes are represented by minimized repository groups whose counts add up to 25

#### Scenario: Fewer archived changes than the bound
- **WHEN** a repository board has 7 archived changes
- **THEN** the `Archived` column shows all 7 cards, newest archive first, and the header count reads `7`

#### Scenario: No collapse control
- **WHEN** the `Archived` column is shown
- **THEN** the column itself has no control to collapse, expand or close it, and clicking the column header does nothing

#### Scenario: Hidden by the filter
- **WHEN** the user enables "hide archived"
- **THEN** the `Archived` column is not shown, and it is still not shown after a page reload

### Requirement: Board refreshes from the snapshot
The board SHALL fetch `GET /api/state` on load, re-fetch on the poll interval, and provide a Refresh button that calls `POST /api/scan` and re-fetches when complete. The header SHALL show the snapshot's `generatedAt` and per-repo error indicators for repos with `ok: false`.

#### Scenario: Manual refresh
- **WHEN** the user clicks Refresh
- **THEN** a scan is triggered and the board updates with the new snapshot without a page reload

#### Scenario: Repo in error
- **WHEN** a tracked repo failed to scan
- **THEN** a warning indicator with the error message is visible in the header

### Requirement: Status labels use a semantic colour palette
Every label the board paints in a colour SHALL draw that colour from a fixed set of semantic roles, and each role SHALL
mean one thing across the whole UI. The roles are `info` (blue), `branch` (orange), `success`, `warning`, `danger` and
`neutral`. Each role SHALL be defined as theme tokens for its text, its border and a soft background in both themes: a
label in a role SHALL be drawn on that role's soft background (a translucent tint of the role), so the role reads as a
filled chip. The `neutral` role keeps the badge's own background. Component styles MUST reference those tokens
rather than literal colours or the brand accent.

Labels SHALL use the roles as follows:

- `info` — something in flight: an agent session that is running, including its `quiet` state, and outside the board an
  action that is planned but not yet applied. On a card no label other than a running session's SHALL use it, so that
  on the board blue means exactly "an agent is up".
- `branch` — anything naming a working copy that is not merged yet: the branch badge on the change detail view and
  in the repository board header, and the `uncommitted`, `unpushed` and `pushed` work-status badges.
- `success` — a complete change and `merged` work.
- `warning` — a condition the user should look at but that is not an error: a missing tasks file, an archive the main
  checkout does not have yet.
- `danger` — a failed or erroring session, a scan warning, and uncommitted or unpushed work that has gone stale.
  Stale `pushed` work stays `warning`: a pushed branch may simply be waiting for review.
- `neutral` — labels that carry no status: the activity age, the `prompt` note, the column a change sits in, and
  markers such as which agent profile is the default.

The brand accent SHALL NOT be the colour of any status label; it stays reserved for focus, active state, primary
actions and progress. Colour MUST NOT be the only cue: every label SHALL keep its text, and its role MUST NOT change
what it says. Every role's text SHALL keep a contrast ratio of at least 4.5:1 against the card and panel backgrounds in
both themes, and so SHALL it against the role's soft background laid over those backgrounds.

#### Scenario: A live agent is blue
- **WHEN** a card's change has a running session that printed something within the last minute
- **THEN** its badge reads `running` in the `info` role, and no other label on that card uses `info`

#### Scenario: A quiet session keeps the live role
- **WHEN** a running session's terminal has printed nothing for more than a minute
- **THEN** its badge reads `quiet <duration>` in the `info` role, without motion

#### Scenario: Branch and uncommitted work share the orange role
- **WHEN** a change's detail view shows the branch badge `feat/add-login` and its worktree holds 3 uncommitted files
- **THEN** both labels are painted in the `branch` role, and both still read their own text

#### Scenario: The brand accent is not a status
- **WHEN** any card on the board is rendered in either theme
- **THEN** none of its labels uses the brand accent colour, while focus rings, primary buttons and the progress bar still do

#### Scenario: Stale open work escalates
- **WHEN** a worktree has had unpushed commits for two days and no session is running
- **THEN** its badge is painted in the `danger` role and still says how long it has been untouched

#### Scenario: A stale pushed branch is only a warning
- **WHEN** a worktree's branch has been pushed and untouched for eight days and no session is running
- **THEN** its badge is painted in the `warning` role, not `danger`

#### Scenario: Roles are legible in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** each role's text keeps a contrast ratio of at least 4.5:1 against the badge's own ground and against the card it sits in

### Requirement: Cards are grouped by repository within each column
Within every column, including the expanded `Archived` column, the board SHALL group cards by repository: all cards of one repository SHALL be adjacent, under a group header showing the repository name and the number of cards in that group. Groups SHALL be ordered by repository name, case-insensitively, and the order SHALL be the same in every column. Within a group, cards SHALL keep the order they would have had without grouping. A repository with no visible cards in a column SHALL NOT produce a group there. Column counts SHALL remain the total number of cards in the column. Grouping SHALL be applied after filtering, and in the `Archived` column after selecting the most recently archived changes, so it never changes which cards are shown.

#### Scenario: Two repositories in one column
- **WHEN** the `Implementing` column contains changes `a1` and `a2` from repository `alpha` and `b1` from repository `beta`, scanned in the order `a1`, `b1`, `a2`
- **THEN** the column shows a group `alpha` with count `2` containing `a1` then `a2`, followed by a group `beta` with count `1` containing `b1`, and the column count is `3`

#### Scenario: Same group order across columns
- **WHEN** repositories `zeta` and `Alpha` both have cards in `Design` and in `Done`
- **THEN** the `Alpha` group is above the `zeta` group in both columns

#### Scenario: No empty groups
- **WHEN** repository `beta` has no cards in the `Ready` column
- **THEN** the `Ready` column shows no `beta` group header

#### Scenario: Filtered-out repository
- **WHEN** the repository filter selects only `alpha`
- **THEN** every column shows at most one group, `alpha`, and its header count equals the number of visible `alpha` cards in that column

#### Scenario: Archived column keeps its bound
- **WHEN** 96 changes are archived across repositories and the `Archived` column is expanded
- **THEN** the 25 most recently archived changes are shown, grouped by repository, with each group's cards in archive-date descending order, and the column header still reports the total of `96`

### Requirement: Each repository has its own stable colour
The board SHALL assign every repository in the snapshot a colour derived deterministically from its repository id, without any configuration. The assignment SHALL be computed over all repositories in the snapshot, independent of the active filters, so that the same set of tracked repositories always yields the same colours across reloads, scans and filter changes. Repositories tracked at the same time SHALL receive distinct colours for up to 19 repositories. The colours a repository can be assigned SHALL exclude the hues the status roles and the brand accent own: every assignable repository hue SHALL differ from every one of those hues by at least 12°, so a repository is never shown in a colour that means "running", "uncommitted", "complete", "needs attention" or "error". The repository colour SHALL be shown on the repository's group header, which encloses its cards, on its entry in the repository filter menu and on its active-filter tag, and on each agent session tab in the dock's tab strip — as an accent on the tab and on the repository name it shows. A session tab whose repository is not in the current snapshot SHALL be shown without a repository colour. The repository colour on a tab MUST NOT replace or obscure the marks that say which sessions are shown and which tab is focused; those marks SHALL stay distinguishable from every assignable repository colour. The colour SHALL adapt to the active theme so that repository-coloured text keeps a contrast ratio of at least 4.5:1 against its background in every supported theme, including the background of the dock's tab strip and of a tab whose session is shown. Colour MUST NOT be the only cue: wherever a repository colour is shown, the repository name SHALL be shown with it. The error styling of a repository's filter menu entry SHALL take precedence over its repository colour.

#### Scenario: Distinct colours
- **WHEN** 17 repositories are tracked
- **THEN** no two of them have the same colour

#### Scenario: Stable across reload and rescan
- **WHEN** the page is reloaded or a scan completes and the set of tracked repositories is unchanged
- **THEN** every repository has the same colour as before

#### Scenario: Filters do not change colours
- **WHEN** the user filters the board to repository `vcs-admin` only
- **THEN** `vcs-admin` group headers, filter menu entry and active-filter tag keep the colour they had with no filter applied

#### Scenario: Colour is consistent across the board
- **WHEN** repository `beta-soc` has cards in three columns
- **THEN** its group headers, around all of its cards, and its filter menu entry all use the same colour, each alongside the name `beta-soc`

#### Scenario: Session tabs carry the repository colour
- **WHEN** the dock shows tabs for sessions of `beta-soc` and of `alpha-infra`
- **THEN** each tab shows its repository's accent and its repository name in that repository's colour, the same colour that repository's cards and group headers use, and both tabs still show the repository name as text

#### Scenario: Filtering the board does not recolour a tab
- **WHEN** the user filters the board to `alpha-infra` only while a `beta-soc` session is in the tab strip
- **THEN** the `beta-soc` tab keeps the colour it had with no filter applied

#### Scenario: Shown and focused marks survive the tint
- **WHEN** a tinted tab's session has a pane in the dock and its tab is the focused one
- **THEN** the tab still shows the mark that says its session is shown and the marking of the focused tab, both distinguishable from the repository colour

#### Scenario: Session of an untracked repository
- **WHEN** a session's repository is switched off in Settings while its tab is in the strip
- **THEN** that tab is shown without a repository colour and stays readable

#### Scenario: Theme change
- **WHEN** the user switches from the dark to the light theme
- **THEN** each repository keeps the same hue, and repository-coloured text remains legible (contrast ≥ 4.5:1) on the light backgrounds, on the board and in the dock's tab strip

#### Scenario: Repository in error
- **WHEN** a tracked repository failed to scan
- **THEN** its entry in the repository filter menu shows the error styling rather than its repository colour

#### Scenario: No repository wears a status colour
- **WHEN** 19 repositories are tracked
- **THEN** every assigned hue is at least 12° away from each of the status role hues and from the brand accent

### Requirement: Repository groups are visually distinct
On a board showing more than one repository, each repository group SHALL be rendered as an enclosing panel that contains its group header and all of its cards. The panel SHALL have a background that differs from the column background and is tinted with the repository's colour, and a border in the same tint. The repository name in the group header SHALL be rendered in bold. The vertical distance between two adjacent groups SHALL be larger than the distance between two adjacent cards within a group. Cards SHALL remain visually distinguishable from the panel they sit on. The panel tint SHALL be derived from the repository colour and theme tokens so that it adapts to every supported theme, and repository-coloured text shown on the panel SHALL keep a contrast ratio of at least 4.5:1 against the panel background in every supported theme.

#### Scenario: Bold group name
- **WHEN** a column shows groups for `alpha` and `beta`
- **THEN** both repository names in the group headers are rendered with a bold font weight

#### Scenario: Group is an enclosed, tinted panel
- **WHEN** repository `beta-soc` has two cards in the `Ready` column
- **THEN** its header and both cards sit inside one panel whose background is a tint of the `beta-soc` colour and differs from the column background

#### Scenario: Groups are further apart than cards
- **WHEN** a column shows group `alpha` with two cards followed by group `beta`
- **THEN** the gap between the `alpha` panel and the `beta` panel is larger than the gap between the two `alpha` cards

#### Scenario: Works in both themes
- **WHEN** the user switches between the dark and the light theme
- **THEN** the panels stay tinted with their repository colour relative to that theme's column background, and the repository name keeps at least 4.5:1 contrast against the panel for every assignable repository colour

#### Scenario: Single-repository board is unchanged
- **WHEN** the board shows only one repository and cards render without group headers
- **THEN** no group panel is drawn

### Requirement: Repository groups can be minimized
On a board that shows repository groups, every group SHALL offer a control on its header to minimize and expand it. A minimized group SHALL show only its header — the repository colour and name and the number of cards in the group — and none of its cards; an expanded group SHALL show its cards as before. The control SHALL be operable by pointer and keyboard and SHALL expose its expanded or minimized state to assistive technology. The state SHALL be held per group, that is per repository and column: changing one group MUST NOT change the same repository's group in another column.

Groups in the `Archived` column SHALL be minimized by default; groups in every other column SHALL be expanded by default. A state the user has chosen explicitly SHALL be remembered in the browser and SHALL survive page reloads, scans and filter changes; repositories and columns without an explicit choice SHALL use the default. If the remembered state cannot be read or written, the board SHALL fall back to the defaults and remain fully usable.

Minimizing MUST NOT change which cards match the active filters or any count: the group header count and the column header count SHALL include the cards of minimized groups. While a text search is active, every group shown SHALL be presented expanded regardless of its remembered state, the control SHALL NOT change the remembered state, and clearing the search SHALL restore the previous presentation. Boards that render cards without group headers (single-repository boards) are unaffected.

#### Scenario: Minimize a group
- **WHEN** the `Implementing` column shows group `alpha` with 3 cards and the user activates the control on its header
- **THEN** the group shows only its header with the name `alpha` and the count `3`, none of its cards are shown, and the `Implementing` column count is unchanged

#### Scenario: Expand again
- **WHEN** the user activates the control on the minimized `alpha` group
- **THEN** its 3 cards are shown again in their previous order

#### Scenario: State is per column
- **WHEN** the user minimizes `alpha` in `Implementing` and `alpha` also has a group in `Ready`
- **THEN** the `alpha` group in `Ready` stays expanded

#### Scenario: Archived groups start minimized
- **WHEN** the combined board loads for a user with no remembered choices and the `Archived` column contains groups `alpha` (4) and `beta` (2)
- **THEN** both groups are shown minimized with their counts, and the groups in all other columns are shown expanded

#### Scenario: Choice is remembered
- **WHEN** the user expands `alpha` in `Archived`, minimizes `beta` in `Ready`, and reloads the page
- **THEN** `alpha` in `Archived` is expanded, `beta` in `Ready` is minimized, and all other groups use their defaults

#### Scenario: New repository gets the defaults
- **WHEN** a repository is tracked for the first time after the user has made choices for other repositories
- **THEN** its groups are minimized in `Archived` and expanded elsewhere

#### Scenario: Search shows matches inside minimized groups
- **WHEN** `alpha` in `Archived` is minimized and the user searches for the name of one of its archived changes
- **THEN** the matching card is shown in an expanded `alpha` group, and after the search is cleared `alpha` in `Archived` is minimized again

#### Scenario: Keyboard and assistive technology
- **WHEN** the user focuses a group header control with the keyboard and presses Enter or Space
- **THEN** the group toggles, and the control reports whether the group is expanded

#### Scenario: Storage unavailable
- **WHEN** the browser refuses access to local storage
- **THEN** the board shows the default states, toggling still works for the current page, and no error is shown

### Requirement: Cards offer session starters and show session state
When agent sessions are enabled and the card's repository is tracked and not excluded, a card SHALL offer the session starters available for its change — **Draft artifacts** while an artifact is not done, **Implement** in `Ready` or `Implementing`, **Archive** in `Done`, none for archived changes — limited to the starters the repository's agent has a prompt for, and disabled with an explanation when that agent's executable is not found. A card whose change has a running session SHALL instead show a badge beside the change name — `running`, or `quiet <duration>` when the terminal has been silent for more than a minute, or that the agent may need the user — and a card whose latest session failed to start or ended with an error SHALL show that; activating the badge SHALL open the session panel. Status MUST be conveyed by text as well as colour. **Show details** remains available. When agent sessions are disabled or the repository is excluded, cards MUST look and behave exactly as before.

#### Scenario: Done change offers Archive
- **WHEN** a change is in `Done` and agent sessions are enabled
- **THEN** the card offers **Archive** in its footer

#### Scenario: Ready change
- **WHEN** a change is in `Ready`, agent sessions are enabled and its repository is not excluded
- **THEN** the card offers **Implement** and still offers **Show details**

#### Scenario: Running session
- **WHEN** a change has a running session
- **THEN** its card shows a session badge and no starter, and activating the badge opens the session panel

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no card shows a starter or a session badge

### Requirement: Session panel
The board SHALL show agent sessions in a dock at the bottom of the window that spans its full width, addressable in the URL so that it survives reload and working in both routing modes. For each session shown it SHALL present the change, repository, agent, worktree path and branch and the session's state; the session's terminal, coloured from the dashboard's theme tokens and rendered without loading anything from the network; and the actions End session or Clean up (with the remove-worktree confirmation when removal is safe), Resume when available, Delete record for an ended session, and "Copy cd" for the worktree. The page SHALL reserve the dock's height below its content so that no part of the board is hidden behind it. The dock's height SHALL be adjustable by dragging its top edge and by keyboard, within limits that keep both the board and a terminal usable, and SHALL be remembered in the browser; the dock SHALL offer maximising and collapsing to its tab strip. Hiding a session, collapsing the dock or closing it MUST NOT end any session, and the board MUST stay usable above the dock. When no session is shown and none is running there SHALL be no dock.

#### Scenario: Deep link
- **WHEN** the user reloads the page while a session panel is open
- **THEN** the same session's terminal is shown again, including its earlier output

#### Scenario: Hiding the panel
- **WHEN** the user closes the panel while the agent is working
- **THEN** the agent keeps running and the card keeps showing the session badge

#### Scenario: Nothing hidden behind the dock
- **WHEN** the dock is open and the user scrolls the board to its end
- **THEN** the last cards are fully visible above the dock

#### Scenario: Height is remembered
- **WHEN** the user drags the dock to a new height and reloads the page
- **THEN** the dock opens at that height

#### Scenario: Collapsed
- **WHEN** the user collapses the dock while two sessions run
- **THEN** only the tab strip remains at the bottom, both sessions keep running, and selecting a tab expands the dock with that session

### Requirement: Open work list
While agent sessions are enabled the top bar SHALL show an "Open work" control with the number of agent sessions that are currently running, across all repositories; it SHALL be hidden when no session is running. Opening it SHALL list exactly those running sessions — oldest first — each with repository, change, the session's action, agent, branch, its live session badge, the work-status badge of its worktree when there is one, and how long ago it started. Sessions that have ended or failed, worktrees without a session record and worktrees of archived or vanished changes MUST NOT be listed, whatever their work status. Activating an entry SHALL show that session's panel, following the same rule as selecting its tab, and close the list. The list SHALL update as sessions start and end, without a reload.

#### Scenario: Only running sessions are listed
- **WHEN** one session is running for `add-login`, a session for `fix-parser` has ended with 2 unpushed commits in its worktree, and an orphaned worktree of `audit-trail` holds uncommitted files
- **THEN** the control reads `Open work 1` and its list shows only `add-login`

#### Scenario: A session that ends leaves the list
- **WHEN** the list shows a running session and that session's agent exits
- **THEN** the entry disappears from the list and the count drops, and the card still shows the worktree's work-status badge

#### Scenario: Stale worktrees stay out
- **WHEN** a worktree has had unpushed commits for two days, no session is running in it and its session record still exists
- **THEN** it does not appear in the Open work list, and its card's badge is still highlighted as stale

#### Scenario: Archive worktree of an archived change
- **WHEN** the archive worktree of a change that is already archived holds a commit that is not pushed and no session runs in it
- **THEN** it does not appear in the Open work list

#### Scenario: Opening an entry
- **WHEN** the user activates the entry of a running session that is not shown in the dock
- **THEN** its panel is shown as if its tab had been selected, and the list closes

#### Scenario: Nothing open
- **WHEN** worktrees with uncommitted, unpushed, pushed or merged work exist but no session is running
- **THEN** the top bar shows no Open work control

### Requirement: The session panel shows work status and offers Ship
The session panel SHALL show the work status of the session's worktree and a Ship button while that status is `uncommitted`, `unpushed` or `pushed`, naming what it will do. For `merged` the panel SHALL suggest removing the worktree, and the clean-up dialog SHALL preselect removal.

#### Scenario: Ship from the panel
- **WHEN** the user presses Ship on an ended session with uncommitted work
- **THEN** the agent starts in the terminal with the Ship prompt

#### Scenario: Merged
- **WHEN** the panel is opened for a session whose worktree is `merged`
- **THEN** Ship is not offered and removal of the worktree is suggested

### Requirement: The dock shows up to three sessions side by side
The dock SHALL show one, two or three sessions next to each other in panes of equal width, each with its own header, actions, terminal and default responses, and MUST NOT show more than three at once. The tab strip SHALL list every running session, however many, plus shown sessions that have ended, and SHALL mark, as text or shape as well as colour, which sessions are currently shown. Selecting a tab whose session is not shown SHALL open it in a new pane while fewer than three are shown, and otherwise replace the pane that last had the keyboard focus; selecting a tab whose session is shown SHALL move the keyboard focus to its terminal. Each pane SHALL have a control that removes it from the dock without ending its session; removing the last pane collapses the dock. Opening a session from a card, from Open work or by starting one follows the same rule as selecting its tab. The URL SHALL carry the shown sessions in pane order, and a URL naming a single session SHALL open one pane; sessions in the URL that do not exist are ignored, and no more than the first three are shown. Typing, default responses and next-step prompts MUST reach only the session of the pane they were used in.

#### Scenario: Three at once, more in tabs
- **WHEN** five sessions are running and three of them are shown
- **THEN** three terminals are visible side by side and the tab strip lists all five, marking the three that are shown

#### Scenario: Fourth session replaces the focused pane
- **WHEN** three sessions are shown, the keyboard focus is in the second pane, and the user selects the tab of a fourth session
- **THEN** the second pane shows the fourth session, the other two panes are unchanged, and the replaced session keeps running

#### Scenario: Pane closed
- **WHEN** the user removes one of two panes
- **THEN** the remaining pane takes the full width and the removed session keeps running and stays in the tab strip

#### Scenario: Deep link with several sessions
- **WHEN** the page is loaded with two session ids in the URL
- **THEN** both terminals are shown in that order with their earlier output

#### Scenario: Input stays in its pane
- **WHEN** two sessions are shown and the user presses a default response in the first pane
- **THEN** only the first session's terminal receives it

### Requirement: The running session badge shows activity through motion
The session badge of a running session whose terminal is not quiet SHALL be animated wherever it is shown (cards and the session panel): its dot pulses and a lighter colour sweeps across its label, in a loop of about two seconds that never hides the label or reduces its contrast below that of the static badge. The `quiet`, ended and failed badges, work-status badges and every other badge MUST NOT be animated, so that motion means exactly "an agent is working now". The animation MUST be decorative only: the label still reads `running`, the dot is hidden from assistive technology, and status remains conveyed by text as well as colour. When the user prefers reduced motion (`prefers-reduced-motion: reduce`) the badge MUST be static and look as it did without this requirement. Colours MUST come from the theme tokens so that both themes apply.

#### Scenario: Running
- **WHEN** a change has a running session that printed something within the last minute
- **THEN** its badge reads `running`, its dot pulses and a colour sweeps across the label

#### Scenario: Quiet session is still
- **WHEN** a running session has been silent for more than a minute
- **THEN** its `quiet` badge is not animated

#### Scenario: Reduced motion
- **WHEN** the user's system asks for reduced motion
- **THEN** the running badge is static and still reads `running`

### Requirement: Cards keep offering the next step while a session runs
A card whose change has a running session SHALL show the session badge and, next to it, the starters available in the change's current stage. For Draft and Implement with a running session in the change's own worktree, the starter SHALL send its prompt to that session and open the panel with the terminal focused; its label and tooltip MUST say that it sends the prompt to the running session, and MUST NOT ask the user for a further key press. When the prompt was typed but not submitted, the panel SHALL say so as it does for any other text sent on the user's behalf. Archive SHALL open its own session as before. The panel header SHALL offer the same next-step buttons for the session shown.

#### Scenario: Draft finished
- **WHEN** a Draft session is still running and the change has moved to `Ready`
- **THEN** the card shows the running (or quiet) badge and an **Implement** button, and pressing it sends the Implement prompt to that session and opens the panel

#### Scenario: The prompt was not sent
- **WHEN** the next step is sent to a session whose agent never shows the typed prompt
- **THEN** the panel says that the text was typed but not sent, and the session keeps running

#### Scenario: Nothing new to do
- **WHEN** an Implement session is running and the change is `Implementing`
- **THEN** the card offers Implement next to the badge and no other starter

### Requirement: Running sessions can be ended from the card
The badge of a running session SHALL carry a small close control with an accessible name. Activating it MUST NOT end the session directly but open the end-session dialog.

#### Scenario: Close control
- **WHEN** the user activates the close control on a running badge
- **THEN** the end-session dialog opens and the session keeps running until confirmed

### Requirement: The end-session dialog is graded by work status
Ending a session — from a card or from the panel — SHALL go through one dialog that reads the worktree's work status fresh and grades its warning: a plain confirmation for `clean`, `merged` or `missing`; a notice for `pushed` that the work is not merged as of the last fetch; and for `uncommitted` or `unpushed` a strong warning, as text plus colour, naming the number of files or commits that exist only in this worktree, with **Ship instead** offered and the confirming button labelled **End anyway**. The dialog MUST state that the worktree and branch are kept, and SHALL offer worktree removal only when that is safe. Cancelling MUST change nothing.

#### Scenario: Unshipped work
- **WHEN** the user ends a session whose worktree holds 3 uncommitted files
- **THEN** the dialog warns that 3 files exist only in this worktree, offers Ship instead, and ends the session only on **End anyway**

#### Scenario: Nothing unshipped
- **WHEN** the user ends a session whose worktree is `clean`
- **THEN** the dialog asks for a plain confirmation

### Requirement: The session panel has a tab per running session
The session panel SHALL show a tab strip with every running session across repositories — repository, change and its live badge — plus the session currently shown when it has ended. Selecting a tab SHALL show that session's terminal with its earlier output and update the URL; it MUST NOT end, restart or otherwise affect any session. Tabs SHALL be keyboard-operable and expose the selected one to assistive technology. With a single session the strip MAY be omitted.

#### Scenario: Switching
- **WHEN** two sessions are running and the user selects the other tab
- **THEN** the other session's terminal is shown including its earlier output, both sessions keep running, and reloading the page shows the same tab

#### Scenario: Session ends while shown
- **WHEN** the session shown ends
- **THEN** its tab stays until the user selects another or hides the panel

### Requirement: Cards offer Show details
Each card SHALL offer a **Show details** action that opens its change's detail view, carrying the board it sits on and that board's filters so the detail view can lead back to them. The action SHALL be a link: opening it in a new tab or window SHALL land on the same detail view, and activating it with the keyboard SHALL open the detail view in the current tab.

**Show details** SHALL be the only part of a card that navigates to the detail view, apart from the **Console** quick link: when agent sessions apply and the change has a session or a session worktree, the card SHALL show a small console link in its top-right corner, beside the session status, that opens the change's detail view directly on its Console tab (carrying the board like **Show details** does). The quick link is an icon; its tooltip and accessible name SHALL say that it opens the agent console of the named change. The card as a whole MUST NOT be a link, and the change name MUST NOT be one; clicking a card's background, its badges or its progress bar MUST NOT navigate anywhere. The session starters and the session badge keep their own behaviour.

#### Scenario: Opening a change
- **WHEN** the user activates **Show details** on the card of change `multi-tenant-sync`
- **THEN** the detail view of `multi-tenant-sync` is shown

#### Scenario: Card background does not navigate
- **WHEN** the user clicks the card's background, its change name, its progress bar or its age badge
- **THEN** nothing is opened and the board stays as it is

#### Scenario: New tab
- **WHEN** the user middle-clicks or ⌘-clicks **Show details**
- **THEN** a new tab opens on that change's detail view

#### Scenario: Keyboard
- **WHEN** the user tabs to a card and presses Enter
- **THEN** the detail view for that change is shown

#### Scenario: Console quick link
- **WHEN** the change `multi-tenant-sync` has a running session and the user activates the console link on its card
- **THEN** the detail view of `multi-tenant-sync` opens on its Console tab, and closing it returns to the board with its filters

#### Scenario: No console, no link
- **WHEN** a change has neither a session nor a session worktree
- **THEN** its card shows no console link

### Requirement: Session tabs read as tabs
Every tab in the dock's tab strip SHALL be drawn as a tab of its own — with a background and an outline that set it apart from the strip behind it — whether or not its session is shown, and a tab's repository accent SHALL sit on the tab's own edge. A tab whose session is shown SHALL differ from a tab whose session is not shown by shape as well as by the existing mark and by colour. The focused tab SHALL be marked more strongly than the other shown tabs, in a way that does not rely on colour alone and is distinguishable from every assignable repository colour. The strip SHALL leave enough room that a tab's mark, repository name, change name and badge sit on one line with space around them, and the space the page reserves for a collapsed dock SHALL equal the strip's height. The tabs SHALL keep the content, order, marks, repository colours, legibility and keyboard behaviour the other requirements give them.

#### Scenario: A tab that is not shown
- **WHEN** two sessions are running and only one of them is shown
- **THEN** the other session's tab has its own visible background and outline against the strip, with its repository accent on the tab's edge

#### Scenario: Shown and not shown differ in shape
- **WHEN** one session is shown and another is not
- **THEN** the shown tab is visibly joined to the panes below the strip and the other tab is not, in addition to their ▣ and ▢ marks

#### Scenario: Focused tab among shown tabs
- **WHEN** three sessions are shown and the keyboard focus is in the second pane
- **THEN** the second pane's tab carries a stronger marking than the other two shown tabs — more than a change of colour — and that marking stays visible on a tab with a repository colour

#### Scenario: Collapsed dock
- **WHEN** the dock is collapsed to its tab strip
- **THEN** every tab is fully visible and no part of the board is hidden behind the strip

### Requirement: Cards show only what an overview needs
A card SHALL show only what an overview needs: the change name in monospace, the relative age of `lastActivityAt` under it (e.g. `updated 3d ago`, or the archive date for an archived change), the change's session status beside the name as the "Cards offer session starters and show session state" requirement gives it, a progress bar with `done/total` when tasks exist, and a footer with the next-step starter and **Show details**, and — when the change has a console — the console quick link beside its session status. A card SHALL additionally show the `no tasks` warning and an error mark for any other warning the snapshot carries. A card SHALL NOT show the repository name — on the combined board every card sits in its repository's group, whose header names it, and a repository board names it in its header — nor the branch badge, the checkouts holding the change, the worktree's work status, the prompt, how long the change has been complete, or which artifacts are written: the change's detail view shows those (change-detail: "Detail header shows the change's state"), and the column says how far the change has come.

The branch badge in the repository board header MUST NOT extend beyond its container at any width. A branch name that fits SHALL be shown in full; one that does not SHALL be shortened in the middle with an ellipsis so that both its beginning and its end remain readable, with the branch glyph visible and the full name as its tooltip and accessible name.

#### Scenario: Card content
- **WHEN** a change `cloud-deployment` in repo `demo-ops` has `tasks 30/30`, last activity 12 days ago and a branch match `feat/cloud-deployment`, and is shown on the combined board
- **THEN** the card sits in the `demo-ops` group and shows `cloud-deployment`, `updated 12d ago`, a full progress bar labelled `30/30` and **Show details**, and shows neither `demo-ops`, the branch, nor a completion badge

#### Scenario: Card with a running session
- **WHEN** a change in `Implementing` has a session whose agent is waiting for the user
- **THEN** its card shows the session's status beside the name, the task progress, and the next step in its footer

#### Scenario: Details live in the detail view
- **WHEN** a change has a `prompt.md`, a worktree with uncommitted files and all of its artifacts written
- **THEN** its card shows none of these, and its detail view shows the prompt, the work status and each artifact's state

#### Scenario: Long branch name in the repository header
- **WHEN** the repository board's current branch is `feat/introduce-tenant-quota-enforcement` and it does not fit
- **THEN** its badge shows the beginning, an ellipsis and `quota-enforcement`, stays inside the header, and presents the full name on hover and to a screen reader

### Requirement: Visual design follows the grey and indigo token set
The UI SHALL define its colours as two token sets sharing the same token names: a dark set (neutral dark grey backgrounds ascending from `#26272b` for the page to `#4b4c51` for the most elevated surface, light enough that the edges between surfaces and every border stay visible; indigo brand `#6366f1`) and a light set (slate backgrounds from `#f8fafc`, with white raised surfaces, indigo brand `#4f46e5`). In the dark theme the background tokens SHALL be near-neutral greys, in the light theme slate greys with at most a slight cool tint; the indigo brand SHALL be used only as an accent (focus, active state, primary actions, progress) and MUST NOT be the resting colour of panel or card borders, nor the colour of any status label; highlighting the border of the card or control under the pointer is an active state and MAY use it. Borders SHALL be neutral: translucent white in the dark theme and translucent slate in the light theme. Both themes SHALL share Inter for text, JetBrains Mono for identifiers, one radius scale (small controls, fields and cards, panels and columns — rounder the larger the element) and one set of shadow tokens, with fonts bundled locally. Component styles MUST reference colour, radius and shadow tokens only and MUST NOT contain literal colour values. In both themes, text and status colours SHALL have a contrast ratio of at least 4.5:1 against the backgrounds they are rendered on, and so SHALL the text of a filled primary button against that button. The token set SHALL keep the status roles, the brand accent and the repository colours in three disjoint colour ranges, so that no status label can be mistaken for a repository accent or for the accent, and no repository can be shown in a colour that means a status. The UI MUST render correctly without network access, and any icon SHALL be drawn from inline markup, be decorative only, and sit beside text that says the same thing — with one exception, the card's console quick link, whose icon carries its meaning in a tooltip and an accessible name.

#### Scenario: Offline rendering
- **WHEN** the dashboard is opened with no network connectivity
- **THEN** fonts, icons and styles render as designed in the active theme with no external requests

#### Scenario: Same layout in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** only colours and shadows change; layout, spacing, typography and radius are identical

#### Scenario: Status badges readable in light theme
- **WHEN** the light theme is active and a card shows success, warning and danger badges
- **THEN** each badge's text has a contrast ratio of at least 4.5:1 against the card background and is still accompanied by a text label

#### Scenario: Dark ground is a neutral grey, not near-black
- **WHEN** the dark theme is active
- **THEN** the page, column, card and panel backgrounds are greys whose red, green and blue channels differ by no more than 6 of 255, the page background is lighter than `#1a1b1e` and darker than `#2a2b2f`, and panel and card borders are neutral rather than indigo

#### Scenario: Borders are visible
- **WHEN** a column or card is rendered in either theme
- **THEN** its border has a contrast ratio of at least 1.3:1 against the ground it edges

#### Scenario: Subtle text readable on dark cards
- **WHEN** the dark theme is active and a card shows heading, body and subtle text
- **THEN** each has a contrast ratio of at least 4.5:1 against the card background

#### Scenario: Status text readable on dark cards
- **WHEN** the dark theme is active and a card shows success, warning and danger badges
- **THEN** each badge's text has a contrast ratio of at least 4.5:1 against the card background

#### Scenario: Primary button is readable
- **WHEN** the **New change** primary button is rendered in either theme
- **THEN** its label has a contrast ratio of at least 4.5:1 against the button's filled background

#### Scenario: Status, brand and repository colours do not overlap
- **WHEN** the colours a repository can be assigned are compared with the status roles and the brand accent
- **THEN** none of them coincides, in either theme, and the `info` role's hue is at least 24° away from the brand accent's

#### Scenario: Icons are never the only cue
- **WHEN** a control or label shows an icon, such as the search field, the New change button or the theme control
- **THEN** the icon is hidden from assistive technology and the control still carries its text or accessible name

### Requirement: The board opens with a header band
The combined board SHALL show a header band above its filter row. It SHALL hold the title `All changes`, the number of open (not archived) changes matching the active filters and the number of changes to archive, each as a labelled count, and the **New change** action as the band's only filled primary button, under the same visibility rules the `change-creation` capability gives it. These counts and the action SHALL NOT also appear in the filter row. On a repository board the repository board header SHALL take the same band styling and show the same two counts for that repository beside its other content. The counts SHALL follow the snapshot and the filters without a reload.

#### Scenario: Band on the combined board
- **WHEN** the combined board shows 14 open changes and 3 changes are complete or synced
- **THEN** the band reads `All changes`, shows `Open 14` and `To archive 3`, and offers **New change** as a filled primary button

#### Scenario: Counts follow the filters
- **WHEN** the user filters the combined board to repository `alpha-infra`, which has 5 open changes
- **THEN** the band's open count reads `5` without a reload

#### Scenario: No eligible repository
- **WHEN** no tracked repository is eligible for a new change
- **THEN** the band shows its title and counts and no **New change** button

#### Scenario: Repository board
- **WHEN** the board for `alpha-infra` is shown
- **THEN** the repository header is drawn as the band and shows the open and to-archive counts of `alpha-infra`, and the filter row holds no counts and no **New change** button

### Requirement: Column headers mark the lifecycle stage
Every column header SHALL show a small lifecycle marker before the column name, followed by the name and the column count in a pill. The marker's colour SHALL mean the kind of column: neutral for `New` and the artifact columns, the brand accent for `Ready` and `Implementing`, the `success` role for `Done` and `Synced`, a muted neutral for `Archived`, and the `warning` role for `Unknown`. The marker SHALL be decorative only and hidden from assistive technology: the column name SHALL remain the cue. The existing highlighting of the `Done` and `Synced` counts and the `Archived` column's `25 of <total>` count SHALL be kept.

#### Scenario: Markers along the lifecycle
- **WHEN** the board shows the columns `New`, `Proposal`, `Design`, `Specs`, `Ready`, `Implementing`, `Done`, `Synced`, `Archived`
- **THEN** `New`, `Proposal`, `Design` and `Specs` carry a neutral marker, `Ready` and `Implementing` an accent marker, `Done` and `Synced` a success marker, and `Archived` a muted one

#### Scenario: Marker is not the only cue
- **WHEN** a screen reader reads a column header
- **THEN** it reads the column name and count and nothing for the marker

### Requirement: The board's filters form one filter bar
The board's filters SHALL be presented as one filter bar below the header band, with the same filters and URL persistence as before: a search field with a leading search icon and, while it holds text, a control that clears it; on the combined board a **Repositories** menu button that shows how many repositories are selected (or `All`) and opens a list of every repository with a checkbox, its colour and name, and its error styling when its last scan failed; a **Stale** selector offering `Any activity` and idle thresholds of 7, 14, 30 and 90 days, which also offers the current threshold when the URL holds another value; a **Hide archived** switch; and **Clear filters** while any filter is active. Each selected repository and an active stale threshold SHALL also appear as a removable tag in the bar, and removing a tag SHALL clear that one filter. The **Lanes**/**Stack** layout switch and the number of changes shown SHALL stay at the bar's end. The menu SHALL close on Escape, on a click outside it and on leaving it with the keyboard, SHALL expose its open state to assistive technology, and every control SHALL be operable by keyboard.

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
- **THEN** the `Archived` column is removed and the URL holds `archived=0`, exactly as the former checkbox did

#### Scenario: Clearing the search
- **WHEN** the search field holds `sync` and the user activates its clear control
- **THEN** the field is empty and every card that the other filters allow is shown

### Requirement: Actions have their own area
Wherever a board or the overview offers actions for what it shows — **New change** on the combined board, **Pull**, **Clean up** and **New change** on a repository board — they SHALL sit together in an action area at the end of the header band, separate from titles, counts, checkout chips and badges, at full control size and never squeezed between them. The primary action SHALL be the last and only filled button in that area. When the window is narrow the area SHALL move below the header's content as one group rather than splitting.

#### Scenario: Repository board actions
- **WHEN** the board of `alpha-infra`, a git repository whose last scan succeeded, is shown
- **THEN** **Pull**, **Clean up** and the filled **New change** stand together at the end of its header, apart from its checkout chips and config badges

#### Scenario: Narrow window
- **WHEN** the window is 720px wide
- **THEN** the action area wraps below the title and counts as one group, and every action in it stays fully visible

### Requirement: The dashboard opens with a hero header
Every view SHALL open with a hero header. It SHALL show the product mark and the title `OpenSpec Dashboard` in large type, at least 32px and growing with the window up to 56px, with a one-line tagline under it. The status corner (Open work, scan errors, the theme control, the last-update age and Refresh) SHALL sit in the hero's top-right corner, and the main navigation as large tabs, each with an icon beside its name, SHALL sit below the title. The current view's header band and filter bar SHALL continue on the hero's ground, a soft accent glow with a faint dot grid that fades out before the board, so that title, navigation, view header and filters read as one header; a line SHALL close the hero off from the board. The hero's decoration SHALL be drawn from theme tokens, be purely decorative, and SHALL NOT reduce the contrast of any text in it below the rules of the token set. On narrow windows the status corner SHALL move below the title and the title SHALL shrink, without horizontal scrolling.

#### Scenario: Hero on the combined board
- **WHEN** the combined board is opened in a 1920px wide window
- **THEN** the page shows the mark and `OpenSpec Dashboard` in type of at least 48px, the tagline, the status corner at the top right, the navigation tabs with icons, and then `All changes` with its counts, **New change** and the filter bar on the same glowing ground

#### Scenario: Every view has the hero
- **WHEN** the user moves to Settings or Activity
- **THEN** the same hero with its title and navigation is shown above the view

#### Scenario: Narrow window
- **WHEN** the window is 720px wide
- **THEN** the title is smaller but still the largest text on the page, the status corner sits below it, and nothing scrolls horizontally

### Requirement: The product has its own mark
The dashboard SHALL show its own product mark instead of a generic icon: a ring of four arcs — the four stages of a change — fading behind a leading arc that ends in a bright dot, around a small rounded square, on a rounded accent-gradient tile. The mark in the page SHALL be drawn in the theme's accent tokens and be hidden from assistive technology, as the product name stands beside it. The page SHALL carry the same mark as its favicon, embedded in the page itself so no request is made for it.

#### Scenario: Favicon without a request
- **WHEN** the dashboard is opened offline
- **THEN** the browser tab shows the mark, and no request for an icon is made

#### Scenario: One mark
- **WHEN** the favicon and the mark in the hero are compared
- **THEN** they are the same drawing

### Requirement: The board fits half a screen
The board SHALL offer two layouts of the same columns and cards: **Lanes**, the columns side by side, and **Stack**, each column a full-width section whose repository groups (or, on a repository board, cards) flow in a grid, with the page scrolling vertically so the hero scrolls away. By default the layout SHALL follow the window: **Stack** below 1280px wide, **Lanes** otherwise, switching live as the window is resized. A **Lanes**/**Stack** switch in the filter bar SHALL mark the layout on screen and SHALL make an explicit choice that overrides the default and persists in the URL (`layout=lanes` or `layout=stack`); an unknown value SHALL mean the default. The layout SHALL NOT be a filter: it changes no card or count, and **Clear filters** keeps it. In **Lanes**, a column without cards SHALL shrink to a slim rail that still shows its name and count, and lanes SHALL be narrower on windows narrower than 1600px. Grouping, minimizing, counts, the archived bound and every card's content SHALL be the same in both layouts.

#### Scenario: Half a screen
- **WHEN** the combined board is opened in a window 960px wide
- **THEN** the columns are stacked sections, the cards of each column's repository groups sit side by side in a grid, nothing scrolls horizontally, and the switch marks **Stack**

#### Scenario: Explicit choice
- **WHEN** the user activates **Lanes** in a 960px window
- **THEN** the columns are shown side by side, the URL holds `layout=lanes`, and a reload keeps lanes

#### Scenario: Empty lane
- **WHEN** the `Design` column has no cards in the lanes layout
- **THEN** it is a slim rail showing `Design` and `0`, and the other lanes get the width

#### Scenario: Clearing filters keeps the layout
- **WHEN** the board holds `layout=stack` and a text search and the user activates **Clear filters**
- **THEN** the search is cleared and the board stays stacked
