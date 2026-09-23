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

### Requirement: Cards show repository, name, progress, activity and branch
Each card SHALL display the change name in monospace, a progress bar with `done/total` when tasks exist, the relative age of `lastActivityAt` (e.g. "3d ago"), and a branch badge when `branchMatch` is set. On the combined board each card SHALL also display the repository name; on a single-repository board the repository name SHALL be omitted from cards. Cards in `Done` SHALL additionally show how long the change has been complete.

The branch badge MUST NOT extend beyond the card's content area at any column width. A branch name that fits SHALL be shown in full. A branch name that does not fit SHALL be shortened in the middle with an ellipsis so that both its beginning and its end remain readable, and the branch glyph SHALL remain visible. The full branch name SHALL remain available as the badge's tooltip and as its accessible name. The badge MAY wrap onto its own line within the card but MUST NOT shrink or displace the card's other badges out of the card. The same rules SHALL apply to the current-branch badge in the repository board header.

#### Scenario: Card content
- **WHEN** a change `cloud-deployment` in repo `demo-ops` has `tasks 30/30`, last activity 12 days ago and no branch match, and is shown on the combined board
- **THEN** the card shows `demo-ops`, `cloud-deployment`, a full progress bar labelled `30/30`, `12d ago`, and no branch badge

#### Scenario: Card on a repository board
- **WHEN** the same change is shown on the board for repository `demo-ops`
- **THEN** the card shows `cloud-deployment`, the progress bar, `12d ago` and **Show details**, but not the repository name

#### Scenario: Short branch name is shown in full
- **WHEN** a card has `branchMatch: feat/add-login`
- **THEN** the badge reads `⎇ feat/add-login` with no ellipsis

#### Scenario: Long branch name stays inside the card
- **WHEN** a card has `branchMatch: feat/introduce-tenant-quota-enforcement` and the name does not fit the card width
- **THEN** the badge ends at or before the card's content edge, shows the beginning of the name, an ellipsis, and the end of the name (ending in `quota-enforcement`), and no part of the badge is painted outside the card

#### Scenario: Full name stays available
- **WHEN** the user hovers a shortened branch badge, or a screen reader reads it
- **THEN** the full name `feat/introduce-tenant-quota-enforcement` is presented

#### Scenario: Other badges are not squeezed
- **WHEN** a card shows an age badge and a long branch badge that do not fit on one line
- **THEN** the branch badge moves to its own line and the age badge keeps its full text

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

### Requirement: Cards show a prompt badge for changes with a prompt.md
A card SHALL show a `prompt` badge — text plus colour — when the change has a `prompt.md`. The badge's tooltip and accessible name SHALL contain the prompt's text as written. The badge MUST NOT affect artifact status, column placement, progress or session actions. When the change has no `prompt.md`, no such badge SHALL be shown.

#### Scenario: Change with prompt
- **WHEN** a change `add-audit-trail` has a `prompt.md` containing "Log every mutation"
- **THEN** the card shows a `prompt` badge whose tooltip contains "Log every mutation"

#### Scenario: Change without prompt
- **WHEN** a change has no `prompt.md`
- **THEN** the card shows no prompt badge

### Requirement: Visual design follows the dashboard token set
The UI SHALL define its colours as two token sets sharing the same token names: the dark set defined in design.md (neutral grey backgrounds `#141619`…`#3b3e41`, teal brand `#71c7c5`) and a light set (backgrounds `#f6f8fb`…`#d3dbe6`, teal brand `#1f8a88`). The dark theme's background, text and border tokens SHALL be near-neutral greys with at most a slight cool tint; in the dark theme teal SHALL be used only as an accent (focus, active state, primary actions, progress) and MUST NOT be the colour of panel or card borders, nor the colour of any status label. Both themes SHALL share Space Grotesk for text, JetBrains Mono for identifiers and a 4px radius, with fonts bundled locally. Component styles MUST reference colour tokens only and MUST NOT contain literal colour values. In both themes, text and status colours SHALL have a contrast ratio of at least 4.5:1 against the backgrounds they are rendered on. The token set SHALL keep the status roles, the brand accent and the repository colours in three disjoint colour ranges, so that no status label can be mistaken for a repository accent and no repository can be shown in a colour that means a status. The UI MUST render correctly without network access.

#### Scenario: Offline rendering
- **WHEN** the dashboard is opened with no network connectivity
- **THEN** fonts and styles render as designed in the active theme with no external requests

#### Scenario: Same layout in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** only colours change; layout, spacing, typography and radius are identical

#### Scenario: Status badges readable in light theme
- **WHEN** the light theme is active and a card shows success, warning and danger badges
- **THEN** each badge's text has a contrast ratio of at least 4.5:1 against the card background and is still accompanied by a text label

#### Scenario: Dark ground is neutral grey
- **WHEN** the dark theme is active
- **THEN** the page, column, card and panel backgrounds are near-neutral greys whose red, green and blue channels differ by no more than 6 of 255, and panel and card borders are grey rather than teal

#### Scenario: Subtle text readable on dark cards
- **WHEN** the dark theme is active and a card shows heading, body and subtle text
- **THEN** each has a contrast ratio of at least 4.5:1 against the card background

#### Scenario: Status text readable on dark cards
- **WHEN** the dark theme is active and a card shows success, warning and danger badges
- **THEN** each badge's text has a contrast ratio of at least 4.5:1 against the card background

#### Scenario: Status, brand and repository colours do not overlap
- **WHEN** the colours a repository can be assigned are compared with the status roles and the brand accent
- **THEN** none of them coincides, in either theme

### Requirement: Status labels use a semantic colour palette
Every label the board paints in a colour SHALL draw that colour from a fixed set of semantic roles, and each role SHALL
mean one thing across the whole UI. The roles are `info` (blue), `branch` (orange), `success`, `warning`, `danger` and
`neutral`. Each role SHALL be defined as theme tokens for its text and border in both themes; every role SHALL share
the badge's own background so that one contrast check covers them all. Component styles MUST reference those tokens
rather than literal colours or the brand accent.

Labels SHALL use the roles as follows:

- `info` — something in flight: an agent session that is running, including its `quiet` state, and outside the board an
  action that is planned but not yet applied. On a card no label other than a running session's SHALL use it, so that
  on the board blue means exactly "an agent is up".
- `branch` — anything naming a working copy that is not merged yet: the branch badge on a card, on the change detail
  view and in the repository board header, and the `uncommitted`, `unpushed` and `pushed` work-status badges.
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
both themes.

#### Scenario: A live agent is blue
- **WHEN** a card's change has a running session that printed something within the last minute
- **THEN** its badge reads `running` in the `info` role, and no other label on that card uses `info`

#### Scenario: A quiet session keeps the live role
- **WHEN** a running session's terminal has printed nothing for more than a minute
- **THEN** its badge reads `quiet <duration>` in the `info` role, without motion

#### Scenario: Branch and uncommitted work share the orange role
- **WHEN** a card shows the branch badge `feat/add-login` and its worktree holds 3 uncommitted files
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
The board SHALL assign every repository in the snapshot a colour derived deterministically from its repository id, without any configuration. The assignment SHALL be computed over all repositories in the snapshot, independent of the active filters, so that the same set of tracked repositories always yields the same colours across reloads, scans and filter changes. Repositories tracked at the same time SHALL receive distinct colours for up to 19 repositories. The colours a repository can be assigned SHALL exclude the hues the status roles and the brand accent own: every assignable repository hue SHALL differ from every one of those hues by at least 12°, so a repository is never shown in a colour that means "running", "uncommitted", "complete", "needs attention", "error" or "console". The repository colour SHALL be shown on the repository's group header, as an accent on each of its cards including the card's repository label, on its repository filter chip, and on each entry of the Open work list — as an accent on the entry and on the repository name it shows. An entry whose repository is not in the current snapshot SHALL be shown without a repository colour. The colour SHALL adapt to the active theme so that repository-coloured text keeps a contrast ratio of at least 4.5:1 against its background in every supported theme, including the background of the Open work list. Colour MUST NOT be the only cue: wherever a repository colour is shown, the repository name SHALL be shown with it. The error styling of a repository filter chip SHALL take precedence over its repository colour.

#### Scenario: Distinct colours
- **WHEN** 17 repositories are tracked
- **THEN** no two of them have the same colour

#### Scenario: Stable across reload and rescan
- **WHEN** the page is reloaded or a scan completes and the set of tracked repositories is unchanged
- **THEN** every repository has the same colour as before

#### Scenario: Filters do not change colours
- **WHEN** the user filters the board to repository `vcs-admin` only
- **THEN** `vcs-admin` cards, group headers and filter chip keep the colour they had with no filter applied

#### Scenario: Colour is consistent across the board
- **WHEN** repository `beta-soc` has cards in three columns
- **THEN** its group headers, the accent and repository label on all of its cards, and its filter chip all use the same colour, each alongside the name `beta-soc`

#### Scenario: Session tabs carry the repository colour
- **WHEN** the Open work list holds entries for sessions of `beta-soc` and of `alpha-infra`
- **THEN** each entry shows its repository's accent and its repository name in that repository's colour, the same colour that repository's cards and group headers use, and both entries still show the repository name as text

#### Scenario: Filtering the board does not recolour a tab
- **WHEN** the user filters the board to `alpha-infra` only while a `beta-soc` session is in the Open work list
- **THEN** the `beta-soc` entry keeps the colour it had with no filter applied

#### Scenario: Shown and focused marks survive the tint
- **WHEN** a tinted Open work entry is for a running session and carries its live badge
- **THEN** the badge stays distinguishable from the repository colour and still reads as text

#### Scenario: Session of an untracked repository
- **WHEN** a session's repository is switched off in Settings while its entry is in the list
- **THEN** that entry is shown without a repository colour and stays readable

#### Scenario: Theme change
- **WHEN** the user switches from the dark to the light theme
- **THEN** each repository keeps the same hue, and repository-coloured text remains legible (contrast ≥ 4.5:1) on the light backgrounds, on the board and in the Open work list

#### Scenario: Repository in error
- **WHEN** a tracked repository failed to scan
- **THEN** its filter chip shows the error styling rather than its repository colour

#### Scenario: No repository wears a status colour
- **WHEN** 19 repositories are tracked
- **THEN** every assigned hue is at least 12° away from each of the status role hues, from the brand accent and from the console accent

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
When agent sessions are enabled and the card's repository is tracked and not excluded, a card SHALL offer the session starters available for its change — **Draft artifacts** while an artifact is not done, **Implement** in `Ready` or `Implementing`, **Archive** in `Done`, none for archived changes — limited to the starters the repository's agent has a prompt for, and disabled with an explanation when that agent's executable is not found. A card whose change has a running session SHALL instead show a badge — `running`, or `quiet <duration>` when the terminal has been silent for more than a minute — and a card whose latest session failed to start or ended with an error SHALL show that; activating the badge SHALL open that change's detail view with its Console tab selected and that session shown. Status MUST be conveyed by text as well as colour. **Show details** remains available. When agent sessions are disabled or the repository is excluded, cards MUST look and behave exactly as before.

#### Scenario: Done change offers Archive
- **WHEN** a change is in `Done` and agent sessions are enabled
- **THEN** the card offers **Archive** next to its "complete" badge

#### Scenario: Ready change
- **WHEN** a change is in `Ready`, agent sessions are enabled and its repository is not excluded
- **THEN** the card offers **Implement** and still offers **Show details**

#### Scenario: Running session
- **WHEN** a change has a running session
- **THEN** its card shows a session badge and no starter, and activating the badge opens that change's detail view on its Console tab

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no card shows a starter or a session badge

### Requirement: Cards say which checkout a change lives in
The board SHALL show a change once per repository regardless of how many checkouts hold a copy of it. When a change's data comes from a linked worktree, its card SHALL show that worktree's branch in the branch badge, and the badge's tooltip SHALL state the worktree's path. When other checkouts hold a copy, the tooltip SHALL list them with their branch (or "main checkout", or "detached") and column. The card MUST NOT require the change to exist in the main checkout.

#### Scenario: Worktree-only change
- **WHEN** change `audit-trail` exists only in a worktree on `feat/audit-trail`
- **THEN** the board shows one `audit-trail` card with the badge `feat/audit-trail` whose tooltip names the worktree path

#### Scenario: Copies in several checkouts
- **WHEN** `audit-trail` is `Implementing` in a worktree and `Proposal` in the main checkout
- **THEN** one card is shown in `Implementing`, and its badge tooltip lists the main checkout with `Proposal`

### Requirement: Cards show the work status of their change's worktree
When agent sessions apply to a card's repository and a session worktree exists for its change, the card SHALL show a work-status badge as text plus colour — the number of uncommitted files, the number of commits not pushed, `pushed`, or `merged` — also when no session is running, next to the running session's badge if there is one. Nothing is shown for `clean` or `missing`. Open work whose last activity is older than 24 hours (`uncommitted`, `unpushed`) or 7 days (`pushed`), with no session running, SHALL be highlighted as stale with its age. The badge of `merged` SHALL state that this is as of the last fetch and that the worktree can be removed. Activating the badge opens that change's detail view on its Console tab, showing the worktree's most recent session.

#### Scenario: Ended session with uncommitted work
- **WHEN** a change's session has ended cleanly and its worktree holds 3 uncommitted files
- **THEN** the card shows "3 uncommitted" and activating it opens that change's detail view on its Console tab with that session shown

#### Scenario: Stale
- **WHEN** a worktree has had unpushed commits for two days and no session is running
- **THEN** the badge is highlighted and says so

### Requirement: Open work list
While agent sessions are enabled the top bar SHALL show an "Open work" control. Now that each terminal lives in its
change's detail view, this list is the only view of agent activity that spans repositories, so it SHALL cover both the
agents running and the work they left behind.

Its count SHALL be the number of running sessions plus the number of worktrees that hold unshipped work with no session
running; it SHALL be hidden only when there is neither of those and no merged worktree either. Opening it SHALL list,
across all repositories, first every running session — oldest first — each with repository, change, the session's
action, agent, branch, its live session badge, the work-status badge of its worktree when there is one, and how long
ago it started; and then every worktree whose work is `uncommitted`, `unpushed`, `pushed` or `merged` and whose session
is not running, stale ones first and merged ones last, each with repository, change, branch, status and age.

Sessions SHALL be listed by session and not by worktree, so that a session running in place — in a tracked folder that
is not a git repository, which has no worktree — is listed like any other. A worktree SHALL be listed at most once, and
a running session's own worktree SHALL count as that session rather than a second time as unshipped.

Worktrees without a session record, and worktrees of archived or vanished changes, SHALL be listed: no card offers
them, and with the dock gone this list is the only way to reach them. An entry with a session SHALL open its change's
detail view on the Console tab with that session shown, and close the list; an entry without one SHALL offer copying a
`cd` command and, after confirmation, removal when that is safe. The list SHALL update as sessions start and end,
without a reload.

#### Scenario: Running sessions are listed first
- **WHEN** five sessions are running and two worktrees hold unpushed work with no session
- **THEN** the control shows the count 7 and the list has the five running sessions first, oldest first, each with its
  action, agent and live badge, and the two worktrees after them

#### Scenario: A session running in place
- **WHEN** a session runs in a tracked folder that is not a git repository, so it has no worktree
- **THEN** it is listed with its repository, change and live badge like any other running session

#### Scenario: Opening a running session
- **WHEN** the user activates a running session's entry
- **THEN** that change's detail view opens on its Console tab with that session's terminal and its earlier output, and
  the list closes

#### Scenario: A worktree counted once
- **WHEN** a running session's own worktree holds three uncommitted files
- **THEN** it appears once, as that running session, and the count does not also count it as unshipped

#### Scenario: A session that ends leaves its work behind
- **WHEN** the list shows a running session whose worktree holds 2 unpushed commits and that session's agent exits
- **THEN** the session's entry leaves the running entries, its worktree is listed after them as unpushed, and the count
  stays the same

#### Scenario: Archive worktree of an archived change
- **WHEN** the archive worktree of a change that is already archived holds a commit that is not pushed
- **THEN** it appears in the Open work list although no card offers it, and opening it shows its Console tab

#### Scenario: Nothing open
- **WHEN** no session runs and no session worktree holds anything
- **THEN** the top bar shows no Open work control

### Requirement: Cards mark an archive that the main checkout does not have yet
A card of an archived change whose checkout is a linked worktree SHALL show a badge, as text plus colour, naming the branch that holds the archive and stating that it is not in the main checkout yet. Its tooltip SHALL name the worktree and list the checkouts that still hold an active copy with their columns, and say that merging the branch and updating the main checkout resolves it. Cards of changes archived in the main checkout MUST look as before.

#### Scenario: Pending archive
- **WHEN** `audit-trail` is archived only in a worktree on `chore/archive-audit-trail` and still `Implementing` in the main checkout
- **THEN** its card is in `Archived` with a badge naming `chore/archive-audit-trail`, and the tooltip says the main checkout still has it in `Implementing`

#### Scenario: Ordinary archive
- **WHEN** a change is archived in the main checkout
- **THEN** its card shows no such badge

### Requirement: The running session badge shows activity through motion
The session badge of a running session whose terminal is not quiet SHALL be animated wherever it is shown (cards, the Open work list and the Console tab): its dot pulses and a lighter colour sweeps across its label, in a loop of about two seconds that never hides the label or reduces its contrast below that of the static badge. The `quiet`, ended and failed badges, work-status badges and every other badge MUST NOT be animated, so that motion means exactly "an agent is working now". The animation MUST be decorative only: the label still reads `running`, the dot is hidden from assistive technology, and status remains conveyed by text as well as colour. When the user prefers reduced motion (`prefers-reduced-motion: reduce`) the badge MUST be static and look as it did without this requirement. Colours MUST come from the theme tokens so that both themes apply.

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
A card whose change has a running session SHALL show the session badge and, next to it, the starters available in the change's current stage. For Draft and Implement with a running session in the change's own worktree, the starter SHALL send its prompt to that session and open that change's detail view on its Console tab with the terminal focused; its label and tooltip MUST say that it sends the prompt to the running session, and MUST NOT ask the user for a further key press. When the prompt was typed but not submitted, the Console tab SHALL say so as it does for any other text sent on the user's behalf. Archive SHALL open its own session as before. The Console tab SHALL offer the same next-step buttons for the session shown.

#### Scenario: Draft finished
- **WHEN** a Draft session is still running and the change has moved to `Ready`
- **THEN** the card shows the running (or quiet) badge and an **Implement** button, and pressing it sends the Implement prompt to that session and opens the detail view on its Console tab

#### Scenario: The prompt was not sent
- **WHEN** the next step is sent to a session whose agent never shows the typed prompt
- **THEN** the Console tab says that the text was typed but not sent, and the session keeps running

#### Scenario: Nothing new to do
- **WHEN** an Implement session is running and the change is `Implementing`
- **THEN** the card offers Implement next to the badge and no other starter

### Requirement: Running sessions can be ended from the card
The badge of a running session SHALL carry a small close control with an accessible name. Activating it MUST NOT end the session directly but open the end-session dialog.

#### Scenario: Close control
- **WHEN** the user activates the close control on a running badge
- **THEN** the end-session dialog opens and the session keeps running until confirmed

### Requirement: The end-session dialog is graded by work status
Ending a session — from a card or from the Console tab — SHALL go through one dialog that reads the worktree's work status fresh and grades its warning: a plain confirmation for `clean`, `merged` or `missing`; a notice for `pushed` that the work is not merged as of the last fetch; and for `uncommitted` or `unpushed` a strong warning, as text plus colour, naming the number of files or commits that exist only in this worktree, with **Ship instead** offered and the confirming button labelled **End anyway**. The dialog MUST state that the worktree and branch are kept, and SHALL offer worktree removal only when that is safe. Cancelling MUST change nothing.

#### Scenario: Unshipped work
- **WHEN** the user ends a session whose worktree holds 3 uncommitted files
- **THEN** the dialog warns that 3 files exist only in this worktree, offers Ship instead, and ends the session only on **End anyway**

#### Scenario: Nothing unshipped
- **WHEN** the user ends a session whose worktree is `clean`
- **THEN** the dialog asks for a plain confirmation

### Requirement: Cards offer Show details
Each card SHALL offer a **Show details** action that opens its change's detail view, carrying the board it sits on and that board's filters so the detail view can lead back to them. The action SHALL be a link: opening it in a new tab or window SHALL land on the same detail view, and activating it with the keyboard SHALL open the detail view in the current tab.

**Show details** SHALL be the only part of a card that navigates to the detail view. The card as a whole MUST NOT be a link, and the change name MUST NOT be one; clicking a card's background, its badges or its progress bar MUST NOT navigate anywhere. The session starters, the session badge and the work-status badge keep their own behaviour.

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

