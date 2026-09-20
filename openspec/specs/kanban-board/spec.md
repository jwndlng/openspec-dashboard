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
- **THEN** the card shows `cloud-deployment`, the progress bar, `12d ago` and the copy action, but not the repository name

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
The `Archived` column SHALL be presented like every other column: always open, with the same width, header layout, repository grouping and cards, and with no collapse, expand or close control of its own. It SHALL show at most the 25 most recently archived changes sorted by archive date descending. Its header count SHALL be the total number of archived changes matching the active filters; when more than 25 match, the count SHALL read `25 of <total>`. The "hide archived" filter SHALL remain the way to remove the column from the board. This SHALL apply to the combined board and to repository boards alike.

#### Scenario: Open by default
- **WHEN** the board loads with 96 archived changes and "hide archived" is off
- **THEN** the `Archived` column is shown open like the other columns, with the 25 most recently archived changes as cards and a header count of `25 of 96`

#### Scenario: Fewer archived changes than the bound
- **WHEN** a repository board has 7 archived changes
- **THEN** the `Archived` column shows all 7 cards, newest archive first, and the header count reads `7`

#### Scenario: No collapse control
- **WHEN** the `Archived` column is shown
- **THEN** it has no control to collapse, expand or close it, and clicking its header does nothing

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

### Requirement: Copy apply command
Each card SHALL offer a "Copy apply command" action that copies `cd <repoPath> && claude "/opsx:apply <changeName>"` to the clipboard. The dashboard MUST NOT execute the command.

#### Scenario: Copy
- **WHEN** the user clicks "Copy apply command" on change `multi-tenant-sync` in `/Users/x/Workspace/acme/forum-admin`
- **THEN** the clipboard contains `cd /Users/x/Workspace/acme/forum-admin && claude "/opsx:apply multi-tenant-sync"`

### Requirement: Visual design follows the dashboard token set
The UI SHALL define its colours as two token sets sharing the same token names: the dark set defined in design.md (backgrounds `#080d16`…`#243350`, teal brand `#71c7c5`) and a light set (backgrounds `#f6f8fb`…`#d3dbe6`, teal brand `#1f8a88`). Both themes SHALL share Space Grotesk for text, JetBrains Mono for identifiers and a 4px radius, with fonts bundled locally. Component styles MUST reference colour tokens only and MUST NOT contain literal colour values. In both themes, text and status colours SHALL have a contrast ratio of at least 4.5:1 against the backgrounds they are rendered on. The UI MUST render correctly without network access.

#### Scenario: Offline rendering
- **WHEN** the dashboard is opened with no network connectivity
- **THEN** fonts and styles render as designed in the active theme with no external requests

#### Scenario: Same layout in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** only colours change; layout, spacing, typography and radius are identical

#### Scenario: Status badges readable in light theme
- **WHEN** the light theme is active and a card shows success, warning and danger badges
- **THEN** each badge's text has a contrast ratio of at least 4.5:1 against the card background and is still accompanied by a text label

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
The board SHALL assign every repository in the snapshot a colour derived deterministically from its repository id, without any configuration. The assignment SHALL be computed over all repositories in the snapshot, independent of the active filters, so that the same set of tracked repositories always yields the same colours across reloads, scans and filter changes. Repositories tracked at the same time SHALL receive distinct colours for up to 24 repositories. The repository colour SHALL be shown on the repository's group header, as an accent on each of its cards including the card's repository label, and on its repository filter chip. The colour SHALL adapt to the active theme so that repository-coloured text keeps a contrast ratio of at least 4.5:1 against its background in every supported theme. Colour MUST NOT be the only cue: wherever a repository colour is shown, the repository name SHALL be shown with it. The error styling of a repository filter chip SHALL take precedence over its repository colour.

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

#### Scenario: Theme change
- **WHEN** the user switches from the dark to the light theme
- **THEN** each repository keeps the same hue, and repository-coloured text remains legible (contrast ≥ 4.5:1) on the light backgrounds

#### Scenario: Repository in error
- **WHEN** a tracked repository failed to scan
- **THEN** its filter chip shows the error styling rather than its repository colour

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

