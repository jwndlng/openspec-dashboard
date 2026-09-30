## REMOVED Requirements

### Requirement: Board columns are derived from schema and implementation state
**Reason**: Replaced by "Board columns follow the lifecycle phases": the per-artifact columns and the `Synced` column are gone, and columns no longer depend on the schema.
**Migration**: `New` is now `Backlog` (no artifact written); every artifact column is now `Drafts`; `Synced` changes are in `Done` until archived.

## MODIFIED Requirements

### Requirement: Cards are grouped by repository within each column
Within every column, including the expanded `Archived` column, the board SHALL group cards by repository: all cards of one repository SHALL be adjacent, under a group header showing the repository name and the number of cards in that group. Groups SHALL be ordered by repository name, case-insensitively, and the order SHALL be the same in every column. Within a group, cards SHALL keep the order they would have had without grouping. A repository with no visible cards in a column SHALL NOT produce a group there. Column counts SHALL remain the total number of cards in the column. Grouping SHALL be applied after filtering, and in the `Archived` column after selecting the most recently archived changes, so it never changes which cards are shown.

#### Scenario: Two repositories in one column
- **WHEN** the `Implementing` column contains changes `a1` and `a2` from repository `alpha` and `b1` from repository `beta`, scanned in the order `a1`, `b1`, `a2`
- **THEN** the column shows a group `alpha` with count `2` containing `a1` then `a2`, followed by a group `beta` with count `1` containing `b1`, and the column count is `3`

#### Scenario: Same group order across columns
- **WHEN** repositories `zeta` and `Alpha` both have cards in `Drafts` and in `Done`
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

### Requirement: The board fits half a screen
The board SHALL offer two layouts of the same columns and cards: **Lanes**, the columns side by side, and **Stack**, each column a full-width section whose repository groups (or, on a repository board, cards) flow in a grid, with the page scrolling vertically so the hero scrolls away. By default the layout SHALL follow the window: **Stack** below 1280px wide, **Lanes** otherwise, switching live as the window is resized. A **Lanes**/**Stack** switch in the filter bar SHALL mark the layout on screen and SHALL make an explicit choice that overrides the default and persists in the URL (`layout=lanes` or `layout=stack`); an unknown value SHALL mean the default. The layout SHALL NOT be a filter: it changes no card or count, and **Clear filters** keeps it. In **Lanes**, a column without cards SHALL shrink to a slim rail that still shows its name and count, and lanes SHALL be narrower on windows narrower than 1600px. Grouping, minimizing, counts, the archived bound and every card's content SHALL be the same in both layouts.

#### Scenario: Half a screen
- **WHEN** the combined board is opened in a window 960px wide
- **THEN** the columns are stacked sections, the cards of each column's repository groups sit side by side in a grid, nothing scrolls horizontally, and the switch marks **Stack**

#### Scenario: Explicit choice
- **WHEN** the user activates **Lanes** in a 960px window
- **THEN** the columns are shown side by side, the URL holds `layout=lanes`, and a reload keeps lanes

#### Scenario: Empty lane
- **WHEN** the `Drafts` column has no cards in the lanes layout
- **THEN** it is a slim rail showing `Drafts` and `0`, and the other lanes get the width

#### Scenario: Clearing filters keeps the layout
- **WHEN** the board holds `layout=stack` and a text search and the user activates **Clear filters**
- **THEN** the search is cleared and the board stays stacked

### Requirement: Cards show only what an overview needs
A card SHALL show only what an overview needs: the change name in monospace, the relative age of `lastActivityAt` under it (e.g. `updated 3d ago`, or the archive date for an archived change), the change's session status beside the name as the "Cards offer session starters and show session state" requirement gives it, a progress bar, and a footer with the next-step starter and **Show details**, and — when the change has a console — the console quick link beside its session status. The progress bar SHALL be, for a change in `Drafts`, the drafting progress: the number of the change's artifacts that are done out of all of its schema's artifacts, labelled `done/total`, with a tooltip and accessible name that say it counts artifacts (e.g. `2 of 4 artifacts written`); for any other change with tasks (`tasks.total > 0`), the task progress labelled `done/total`, with a tooltip and accessible name that say it counts tasks. Both bars SHALL share one shape and style. A card in `Backlog`, and a card outside `Drafts` without tasks, SHALL show no progress bar. A card SHALL additionally show the `no tasks` warning and an error mark for any other warning the snapshot carries. A card SHALL NOT show the repository name — on the combined board every card sits in its repository's group, whose header names it, and a repository board names it in its header — nor the branch badge, the checkouts holding the change, the worktree's work status, the prompt, how long the change has been complete, whether its specs are synced, or which artifacts are written: the change's detail view shows those (change-detail: "Detail header shows the change's state"), and the column and the progress bar say how far the change has come.

The branch badge in the repository board header MUST NOT extend beyond its container at any width. A branch name that fits SHALL be shown in full; one that does not SHALL be shortened in the middle with an ellipsis so that both its beginning and its end remain readable, with the branch glyph visible and the full name as its tooltip and accessible name.

#### Scenario: Card content
- **WHEN** a change `cloud-deployment` in repo `demo-ops` has `tasks 30/30`, last activity 12 days ago and a branch match `feat/cloud-deployment`, and is shown on the combined board
- **THEN** the card sits in the `demo-ops` group and shows `cloud-deployment`, `updated 12d ago`, a full progress bar labelled `30/30` and **Show details**, and shows neither `demo-ops`, the branch, nor a completion badge

#### Scenario: Drafting progress
- **WHEN** a `spec-driven` change has `proposal` and `design` done and `specs` and `tasks` not done
- **THEN** its card in `Drafts` shows a progress bar half filled and labelled `2/4`, whose tooltip and accessible name read `2 of 4 artifacts written`

#### Scenario: Drafting progress for another schema
- **WHEN** a change of a schema with the artifacts `brief`, `plan`, `checklist` has `brief` done
- **THEN** its card in `Drafts` shows a drafting progress bar labelled `1/3`

#### Scenario: Backlog card has no bar
- **WHEN** a change in `Backlog` has a `tasks.md` that is not written yet
- **THEN** its card shows no progress bar

#### Scenario: Task progress replaces drafting progress
- **WHEN** a change moves from `Drafts` to `Ready` with `tasks` `done: 0, total: 12`
- **THEN** its card shows the task progress bar labelled `0/12`, whose tooltip says it counts tasks, and no drafting progress

#### Scenario: Card with a running session
- **WHEN** a change in `Implementing` has a session whose agent is waiting for the user
- **THEN** its card shows the session's status beside the name, the task progress, and the next step in its footer

#### Scenario: Details live in the detail view
- **WHEN** a change has a `prompt.md`, a worktree with uncommitted files and all of its artifacts written
- **THEN** its card shows none of these, and its detail view shows the prompt, the work status and each artifact's state

#### Scenario: Long branch name in the repository header
- **WHEN** the repository board's current branch is `feat/introduce-tenant-quota-enforcement` and it does not fit
- **THEN** its badge shows the beginning, an ellipsis and `quota-enforcement`, stays inside the header, and presents the full name on hover and to a screen reader

### Requirement: Column headers mark the lifecycle stage
Every column header SHALL show a small lifecycle marker before the column name, followed by the name and the column count in a pill. The marker's colour SHALL mean the kind of column: neutral for `Backlog` and `Drafts`, the brand accent for `Ready` and `Implementing`, the `success` role for `Done`, a muted neutral for `Archived`, and the `warning` role for `Unknown`. The marker SHALL be decorative only and hidden from assistive technology: the column name SHALL remain the cue. The existing highlighting of the `Done` count and the `Archived` column's `25 of <total>` count SHALL be kept. Each lifecycle column's name SHALL carry a tooltip saying what it holds.

#### Scenario: Markers along the lifecycle
- **WHEN** the board shows the columns `Backlog`, `Drafts`, `Ready`, `Implementing`, `Done`, `Archived`
- **THEN** `Backlog` and `Drafts` carry a neutral marker, `Ready` and `Implementing` an accent marker, `Done` a success marker, and `Archived` a muted one

#### Scenario: Column hints
- **WHEN** the user hovers the `Drafts` column name
- **THEN** a tooltip says that the column holds changes with some but not all artifacts written

#### Scenario: Marker is not the only cue
- **WHEN** a screen reader reads a column header
- **THEN** it reads the column name and count and nothing for the marker

## ADDED Requirements

### Requirement: Board columns follow the lifecycle phases
The board SHALL place each change in exactly one column, where a column names the phase of the lifecycle the change is in. Using, in order: `Archived` if the change is archived; `Done` if `tasks.total > 0` and `tasks.done == tasks.total`, whether or not the change's delta specs are already synced into the main specs; `Implementing` if `tasks.done > 0`; `Ready` if every artifact is done (ready to apply, nothing ticked yet); `Unknown` if the change's artifacts could not be read; `Backlog` if no artifact is done; otherwise `Drafts` (at least one artifact is done and at least one is not). Which artifacts are done, and in which order they were written, SHALL NOT matter beyond that: every schema's artifacts count alike.

The board SHALL show the columns `Backlog`, `Drafts`, `Ready`, `Implementing`, `Done`, `Archived`, in that order, on the combined board and on every repository board, whether or not a column holds a change; `Unknown` SHALL be shown between `Drafts` and `Ready` only while at least one change on that board is in it. Columns MUST NOT depend on the schemas the tracked changes use: there SHALL be no column per artifact and no `Synced` column.

#### Scenario: Brand-new change
- **WHEN** a change directory exists and none of its artifacts is done
- **THEN** it appears in the `Backlog` column

#### Scenario: Change with a prompt only
- **WHEN** a change has a `prompt.md` and none of its artifacts is done
- **THEN** it appears in the `Backlog` column

#### Scenario: Change with proposal only
- **WHEN** a `spec-driven` change has `proposal: done` and `design`, `specs` and `tasks` not done
- **THEN** it appears in the `Drafts` column

#### Scenario: Specs written before design
- **WHEN** a `spec-driven` change has `proposal` and `specs` done and `design` and `tasks` not done
- **THEN** it appears in the `Drafts` column

#### Scenario: Only a later artifact written
- **WHEN** a `spec-driven` change has `specs` done and `proposal` not done
- **THEN** it appears in the `Drafts` column, not in `Backlog`

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

#### Scenario: Complete and synced, not yet archived
- **WHEN** `tasks` is `done: 12, total: 12`, the change is not archived, and its delta specs are reflected in the main specs
- **THEN** it appears in the `Done` column, counts towards "to archive", and is offered **Archive** like any other change in `Done`

#### Scenario: Archived after syncing
- **WHEN** a change whose specs were synced is archived
- **THEN** it appears in the `Archived` column

#### Scenario: All artifacts done but tasks file empty
- **WHEN** all artifacts are done and `tasks` is `done: 0, total: 0`
- **THEN** it appears in `Ready` with a "no tasks" warning badge

#### Scenario: Column list for the spec-driven schema
- **WHEN** every tracked change uses the `spec-driven` schema
- **THEN** the board shows the columns `Backlog`, `Drafts`, `Ready`, `Implementing`, `Done`, `Archived`, and no `Proposal`, `Design`, `Specs`, `Tasks` or `Synced` column

#### Scenario: Another schema gets the same columns
- **WHEN** every tracked change uses a schema whose artifacts are `brief`, `plan`, `checklist`, and one change has `brief` done
- **THEN** the board shows `Backlog`, `Drafts`, `Ready`, `Implementing`, `Done`, `Archived`, and that change is in `Drafts`

#### Scenario: Lifecycle columns are always present
- **WHEN** no change is in the backlog, being drafted or ready to apply
- **THEN** the board still shows empty `Backlog`, `Drafts` and `Ready` columns in their positions

#### Scenario: Unreadable change
- **WHEN** a change's artifacts could not be read
- **THEN** it appears in the `Unknown` column, between `Drafts` and `Ready`, not in `Backlog`
