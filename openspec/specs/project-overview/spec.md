# project-overview Specification

## Purpose
Defines the repository-first navigation: the projects overview that lists every enabled repository with its per-stage change counts and last-updated time (sorting, search, same-name disambiguation), and the drill-down to a single repository's board with its header.

## Requirements

### Requirement: Projects overview is the landing page
The dashboard SHALL show a projects overview at `/` listing every repository that is enabled in the configuration and present in the snapshot, one row per repository. A repository that is disabled or removed in the configuration SHALL disappear from the overview, the combined board, the repository boards and the top-bar error indicators as soon as the configuration is saved, without waiting for the next scan, even while the snapshot still contains it. The combined all-repositories board SHALL remain available at `/board`. The top bar SHALL offer navigation to the overview, the combined board and settings, and SHALL mark the overview entry as active on `/` and on any repository board.

#### Scenario: Opening the dashboard
- **WHEN** the user opens `/` with 17 tracked repositories
- **THEN** a list of 17 repository rows is shown instead of the combined board

#### Scenario: Repository disabled in Settings
- **WHEN** the user disables `demo-agent` in Settings, saves, and opens the overview before the next scan has finished
- **THEN** `demo-agent` is not listed, and opening its `/repo/<id>` URL shows "repository not found"

#### Scenario: Combined board still reachable
- **WHEN** the user opens `/board?q=terraform`
- **THEN** the combined board is shown with the search filter `terraform` applied

#### Scenario: No repositories tracked
- **WHEN** the snapshot contains no repositories and none are enabled in the config
- **THEN** the overview shows the "No repositories tracked yet" empty state with a link to Settings

### Requirement: Overview rows summarise each repository
Each row SHALL show the repository name, the number of non-archived changes in each board stage column (using the same column list and order as the combined board, excluding `Archived`), the total of non-archived changes, the number of changes that are complete but not archived, and the relative age of the repository's last update. Zero counts SHALL be rendered as a neutral placeholder rather than `0`. The to-archive count SHALL be conveyed with text and not by colour alone. A repository with no non-archived changes SHALL be shown de-emphasised with the text "no open changes". A repository whose last scan failed SHALL show a warning indicator exposing the error message while still showing its retained counts.

#### Scenario: Row content
- **WHEN** repository `alpha-infra` has 1 change in `Specs`, 9 in `Implementing`, 2 in `Done`, 40 archived, and was last updated 1 day ago
- **THEN** its row shows `1` under Specs, `9` under Implementing, `2` under Done, an open total of `12`, a to-archive count of `2`, and `1d ago`

#### Scenario: Repository without open changes
- **WHEN** a repository has only archived changes
- **THEN** its row is de-emphasised and reads "no open changes" with its last-updated age

#### Scenario: Failed repository
- **WHEN** a repository has `ok: false` with error `repository path or its openspec/ directory does not exist`
- **THEN** its row shows a warning indicator whose tooltip contains that error

#### Scenario: Snapshot without a repository date
- **WHEN** a repository in the snapshot has no `lastUpdatedAt` but has changes with `lastActivityAt` values
- **THEN** the row uses the newest of those values as its last-updated age

### Requirement: Repositories with the same name are distinguishable
When two or more listed repositories have the same display name (compared case-insensitively), each of their rows SHALL show, next to the name, the shortest trailing part of the repository's parent directory that makes it unique among them. Repositories whose name is unique SHALL NOT show a path hint. Repositories with the same name SHALL remain separate rows with separate counts and separate drill-down targets, and search SHALL also match the hint. Every row SHALL expose the full path as a tooltip.

#### Scenario: Same name under two parents
- **WHEN** `/w/acme/chat-groups` and `/w/ops/repo-mirror/repos/chat-groups` are both enabled with the name `chat-groups`
- **THEN** one row reads `chat-groups` with the hint `acme` and the other with the hint `repos`, and each opens its own repository board

#### Scenario: Parents share their last segment
- **WHEN** `/a/x/repos/foo` and `/a/y/repos/foo` are both listed with the name `foo`
- **THEN** their hints are `x/repos` and `y/repos`

#### Scenario: Unique name
- **WHEN** only one listed repository is named `alpha-infra`
- **THEN** its row shows no path hint

### Requirement: Overview sorting and search
The overview SHALL be sorted by last updated, newest first, by default. The user SHALL be able to sort by repository name, open count, to-archive count, work in progress and last updated by activating the column header, and activating the active header again SHALL reverse the direction. Sorting by work in progress SHALL order repositories by their number of checkouts needing attention — uncommitted plus unpushed plus stale — highest first by default, and repositories without a work-in-progress summary SHALL count as zero. Ties SHALL be broken by repository name, and repositories without a last-updated value SHALL sort after all others. The overview SHALL provide a free-text search over repository names, and a "work in progress" filter that, when enabled, lists only repositories whose number of checkouts needing attention is greater than zero. Search and the filter SHALL combine. Sort key, direction, search and the filter SHALL apply instantly on the client and persist in the URL query string, with default values omitted. In the tiles layout, where there are no column headers, the same sort keys and the direction SHALL be selectable through a sort control.

#### Scenario: Default order
- **WHEN** repositories were last updated 2 minutes, 1 day and 5 months ago
- **THEN** they are listed in that order

#### Scenario: Sort by to-archive
- **WHEN** the user activates the "To archive" header
- **THEN** repositories with the most complete-but-unarchived changes are listed first and the URL contains `sort=archive`

#### Scenario: Reverse direction
- **WHEN** the overview is sorted by name ascending and the user activates the "Repository" header again
- **THEN** repositories are listed Z→A and the URL contains `dir=desc`

#### Scenario: Sort survives reload
- **WHEN** the user reloads `/?sort=open`
- **THEN** the overview is sorted by open count, highest first

#### Scenario: Search
- **WHEN** the user types `ops` in the search field
- **THEN** only repositories whose name contains `ops` are listed

#### Scenario: Sort by work in progress
- **WHEN** `alpha-infra` has 3 checkouts needing attention, `beta-soc` has 1, `demo-ops` and `gamma-lab` have none, and the user sorts by work in progress
- **THEN** the order is `alpha-infra`, `beta-soc`, `demo-ops`, `gamma-lab` and the URL contains `sort=wip`

#### Scenario: Work-in-progress filter
- **WHEN** the user enables the work-in-progress filter with the same repositories
- **THEN** only `alpha-infra` and `beta-soc` are listed and the URL contains `wip=1`

#### Scenario: Clean worktrees do not match the filter
- **WHEN** a repository has two linked worktrees that are clean and fully pushed, and the filter is enabled
- **THEN** that repository is not listed

#### Scenario: Filter survives reload and combines with search
- **WHEN** the user opens `/?wip=1&q=alpha`
- **THEN** the filter is enabled, the search field reads `alpha`, and only repositories matching both are listed

#### Scenario: Sorting in tiles layout
- **WHEN** the tiles layout is shown and the user picks "Open" in the sort control
- **THEN** the tiles are ordered by open count, highest first, and the URL contains `sort=open`

### Requirement: Drill down to a repository board
Activating a repository row SHALL navigate to `/repo/<repoId>` without a page reload, and the repository name SHALL be a real link so it can be opened in a new tab. The repository board SHALL show only that repository's changes, SHALL derive its columns from that repository's changes alone, and SHALL NOT show the repository filter. The search, stale and hide-archived filters SHALL remain available and persist in the URL. The archived column, card actions and refresh behaviour SHALL be the same as on the combined board. Opening `/repo/<repoId>` directly SHALL work.

#### Scenario: Drill down
- **WHEN** the user clicks the row for `beta-soc`
- **THEN** the URL becomes `/repo/<id of beta-soc>` and only `beta-soc` changes are shown in Kanban columns

#### Scenario: Columns follow the repository's schema
- **WHEN** most repositories use `spec-driven` but repository `gamma-lab` uses a schema whose artifacts are `brief` and `plan`
- **THEN** the board for `gamma-lab` shows `Brief` and `Plan` as its artifact columns and not the `spec-driven` ones

#### Scenario: Deep link
- **WHEN** the user opens `/repo/<id>?stale=14` in a new tab
- **THEN** that repository's board is shown with the stale filter set to 14 days

#### Scenario: Unknown repository
- **WHEN** the user opens `/repo/doesnotexist`
- **THEN** a "repository not found" message with a link back to the overview is shown

### Requirement: Repository board header
The repository board SHALL show a header with a breadcrumb linking back to the overview, the repository name, its path in monospace, an action that copies `cd <path>` (shell-quoted) to the clipboard, the main checkout's status chip, labelled as such, and a **branches** control reading `<n> branches` (the distinct branches checked out in any checkout) that, when any checkout holds uncommitted, unpushed or stale work, also says how many (`<m> with work`), and that opens a dialog listing one status chip per checkout of the repository — the main checkout and each linked worktree — each with its path — the relative age of the repository's last update, any repository warnings or scan error, and a **New change** action that opens the create-change form for that repository (as specified in the `change-creation` capability). The New change action SHALL be shown only when the repository is enabled and its last scan succeeded and it has an `openspec/` directory to create into; otherwise the action SHALL be absent. A checkout chip SHALL show the checkout's branch, or that it is detached, and, only when they apply, text markers for: the number of uncommitted items, the number of unpushed commits, the number of commits behind the upstream, stale, locked, and status unknown or not inspected. A clean, fully pushed checkout SHALL show its branch alone. Every marker SHALL be conveyed with text or a symbol plus a tooltip that spells it out, never by colour alone; the tooltips for unpushed and behind SHALL state that the numbers reflect the last fetch, and the unpushed tooltip SHALL distinguish commits ahead of a named upstream from commits on a branch that was never pushed. When the snapshot carries no checkout information for the repository, the header SHALL fall back to the current branch when known. The header and the dialog MUST NOT offer any action on a checkout. The dashboard MUST NOT execute the copied command.

#### Scenario: Header content
- **WHEN** repository `alpha-infra` at `/Users/x/Workspace/acme/alpha-infra` has a clean main checkout on `main` and two linked worktrees on `feat/report` and `fix/parser`, and was last updated 1 day ago
- **THEN** the header shows `Projects / alpha-infra`, the path, the chip `main` labelled as the main checkout, a `3 branches` control, `updated 1d ago`, and a `New change` action, and activating `3 branches` opens a dialog with the chips `main`, `feat/report` and `fix/parser` and their paths

#### Scenario: Worktree with uncommitted and unpushed work
- **WHEN** the worktree on `feat/report` has 4 uncommitted items and is 2 commits ahead of `origin/feat/report`
- **THEN** the branches control reads `3 branches` and `1 with work`, and in its dialog the chip `feat/report` shows an uncommitted marker `4` and an unpushed marker `2`, whose tooltip names `origin/feat/report` and says it reflects the last fetch

#### Scenario: Branch never pushed
- **WHEN** a worktree's branch has no upstream and 3 commits on no remote
- **THEN** its chip in the branches dialog shows an unpushed marker `3` whose tooltip says the commits are not on any remote

#### Scenario: Detached and stale worktrees
- **WHEN** one worktree has a detached HEAD and another is prunable
- **THEN** in the branches dialog the first chip reads detached instead of a branch name and the second carries the text `stale`

#### Scenario: Dirty main checkout
- **WHEN** the main checkout has 2 uncommitted items and the repository has no linked worktrees
- **THEN** the header shows one chip for the main checkout with an uncommitted marker `2`

#### Scenario: Snapshot without checkout information
- **WHEN** the repository's snapshot predates working-tree status and reports only the current branch `main`
- **THEN** the header shows `main` and no status markers

#### Scenario: Back to overview
- **WHEN** the user activates `Projects` in the breadcrumb
- **THEN** the overview at `/` is shown without a page reload

#### Scenario: Copy cd
- **WHEN** the user activates "Copy cd" for a repository at `/Users/x/My Repos/foo`
- **THEN** the clipboard contains `cd '/Users/x/My Repos/foo'`

#### Scenario: New change action opens the form
- **WHEN** the user activates the `New change` action on the header
- **THEN** the create-change form opens for that repository and nothing has been written yet

#### Scenario: New change hidden for a failed scan
- **WHEN** the repository's last scan failed
- **THEN** the header shows no `New change` action

### Requirement: A main checkout that is off its default branch is flagged
When a repository reports that its main checkout is not on its default branch, the projects overview row and the repository board header SHALL show a notice naming the checked-out branch (or that HEAD is detached) and the default branch, and stating that archived changes, specs and progress shown for the repository come from that branch and may be outdated, and that changes living in worktrees are read from their own checkouts and are not affected. The notice SHALL be conveyed with text and not colour alone, SHALL NOT hide or alter any data, and SHALL NOT be shown when the repository is on its default branch or when its default branch is unknown.

#### Scenario: Feature branch in the main checkout
- **WHEN** repository `harbor-web` reports `defaultBranch: "main"` and its main checkout is on `feat/redesign-settings-page`
- **THEN** its overview row shows a notice that it is on `feat/redesign-settings-page`, not `main`, and its board header explains that archived changes, specs and progress may be outdated

#### Scenario: On the default branch
- **WHEN** a repository is on its default branch
- **THEN** no such notice is shown

#### Scenario: Unknown default branch
- **WHEN** a repository reports no default branch
- **THEN** no such notice is shown

#### Scenario: Data is still shown
- **WHEN** the notice is shown for a repository
- **THEN** its changes, counts and last-updated time are displayed exactly as they would be without the notice

### Requirement: Overview shows work in progress per repository
Each repository on the overview SHALL show a work-in-progress indicator built from the repository's work-in-progress summary, listing only its non-zero parts in the order worktrees, uncommitted, unpushed, stale — for example `2 worktrees · 1 uncommitted · 1 unpushed`. The indicator SHALL be emphasised as a warning when anything is uncommitted, unpushed or stale, and SHALL be plain, de-emphasised text when the repository only has clean worktrees. A repository with no linked worktrees and nothing uncommitted, unpushed or stale, and a repository without a summary, SHALL show no indicator. The state SHALL be conveyed with text, never by colour alone, and the indicator SHALL expose a tooltip stating that unpushed counts reflect the last fetch. The overview MUST NOT offer any action on a checkout.

#### Scenario: Mixed states
- **WHEN** a repository's summary is `worktrees: 2`, `uncommitted: 1`, `unpushed: 1`, `stale: 0`
- **THEN** its indicator reads `2 worktrees · 1 uncommitted · 1 unpushed` and is emphasised as a warning

#### Scenario: Only clean worktrees
- **WHEN** a repository's summary is `worktrees: 3` with everything else zero
- **THEN** its indicator reads `3 worktrees` in plain, de-emphasised text

#### Scenario: Singular
- **WHEN** a repository has exactly one linked worktree
- **THEN** the indicator reads `1 worktree`

#### Scenario: Dirty main checkout only
- **WHEN** a repository's summary is `worktrees: 0`, `uncommitted: 1`
- **THEN** its indicator reads `1 uncommitted`

#### Scenario: Clean repository
- **WHEN** a repository has no linked worktrees and a clean, fully pushed main checkout
- **THEN** no indicator is shown for it

#### Scenario: Failed repository keeps its indicator
- **WHEN** a repository's last scan failed and its retained summary has `uncommitted: 2`
- **THEN** its indicator still reads `2 uncommitted` next to the scan warning

### Requirement: Overview offers a table and a tiles layout
The overview SHALL offer two layouts of the same repositories, `Table` and `Tiles`, selectable with a toggle that marks the active layout. The table SHALL be the default. The chosen layout SHALL persist in the URL query string as `view=tiles`, omitted for the table, and SHALL survive a reload. Switching the layout MUST NOT change the sort, the search, the work-in-progress filter, or which repositories are listed and in which order. A tile SHALL show everything a row shows — the repository name with its path hint and full-path tooltip when names collide, the scan-failure warning, the per-stage counts in the same column order with zero counts de-emphasised, the open and to-archive totals with the to-archive count conveyed with text, "no open changes" de-emphasis, the last-updated age, the carried shared-config profiles when any exist, and the work-in-progress indicator — and in addition a checkout summary: the number of linked worktrees and the number of distinct branches checked out in any checkout, main included, as `<n> worktrees · <m> branches active`, with every checkout listed in its tooltip. A tile SHALL NOT list the checkouts or branches themselves; the repository board header does. In a tile the repository name SHALL be a real link, and activating the tile SHALL navigate to the repository board without a page reload, exactly as activating a row does. The tiles SHALL reflow to the available width without horizontal scrolling. The empty state and the "no repository matches" state SHALL be the same in both layouts.

#### Scenario: Switching to tiles
- **WHEN** the user activates `Tiles` on `/?sort=open&q=ops`
- **THEN** the same repositories are shown as tiles in the same order and the URL becomes `/?sort=open&q=ops&view=tiles`

#### Scenario: Table is the default
- **WHEN** the user opens `/`
- **THEN** the table is shown, `Table` is marked active, and the URL has no `view` parameter

#### Scenario: Layout survives reload
- **WHEN** the user reloads `/?view=tiles`
- **THEN** the tiles layout is shown

#### Scenario: Switching back
- **WHEN** the user activates `Table` on `/?view=tiles`
- **THEN** the table is shown and `view` is removed from the URL

#### Scenario: Unknown view value
- **WHEN** the user opens `/?view=galaxy`
- **THEN** the table is shown

#### Scenario: Tile content
- **WHEN** repository `alpha-infra` has 1 change in `Specs`, 9 in `Implementing`, 2 in `Done`, was last updated 1 day ago, and has a clean main checkout on `main` plus a worktree on `feat/report` with 4 uncommitted items
- **THEN** its tile shows those stage counts, an open total of `12`, a to-archive count of `2`, `1d ago`, the indicator `1 worktree · 1 uncommitted`, and the checkout summary `1 worktree · 2 branches active`, whose tooltip names `main` as the main checkout and `feat/report` as a worktree

#### Scenario: Drill down from a tile
- **WHEN** the user clicks the tile for `beta-soc`
- **THEN** the URL becomes `/repo/<id of beta-soc>` without a page reload

#### Scenario: Open a tile in a new tab
- **WHEN** the user opens the repository name of a tile in a new tab
- **THEN** that repository's board loads in the new tab

#### Scenario: Same-named repositories in tiles
- **WHEN** `/w/acme/chat-groups` and `/w/ops/repo-mirror/repos/chat-groups` are both listed in the tiles layout
- **THEN** their tiles show the hints `acme` and `repos`

#### Scenario: Nothing matches
- **WHEN** the tiles layout is shown and the search matches no repository
- **THEN** the same "no repository matches" message as in the table is shown

### Requirement: Tiles have one size and one layout
In the tiles layout every tile SHALL have the same width and the same height, whatever its repository holds, and SHALL place its parts in the same positions: a header with the repository's monogram in its repository colour, its name and path hint, the last-updated age and the Pull action; one line of badges (shared-config profiles, scan failure, off-default-branch notice, work-in-progress indicator); the open and to-archive totals as large numbers; the per-stage counts; and the checkout summary. A tile whose repository has no open changes SHALL keep the same size and show "no open changes" where the totals and stage counts would be. When the badges do not fit their area, that area SHALL scroll within the tile, keeping every badge reachable, instead of growing the tile. Everything the "Overview offers a table and a tiles layout" requirement lists for a tile SHALL still be shown.

#### Scenario: Uneven repositories
- **WHEN** `alpha-infra` has five worktrees and three config profiles and `quill-docs` has no worktree and no open change
- **THEN** both tiles have the same height, `quill-docs` shows "no open changes", and `alpha-infra` reads `5 worktrees · 5 branches active` rather than listing them

#### Scenario: Grid reflows
- **WHEN** the window narrows
- **THEN** the tiles reflow to fewer per row, keep equal sizes, and the page does not scroll horizontally

### Requirement: The overview has a header band with its actions
The projects overview SHALL open with a header band like the boards': the title `Projects`, the numbers of tracked repositories, open changes and changes to archive as labelled counts, and **Pull all** in the band's action area. Below it, a bar SHALL hold the repository search, the **Work in progress** toggle, the `Table`/`Tiles` layout toggle as one segmented control and, in the tiles layout, the sort. Their behaviour and URL persistence are unchanged.

#### Scenario: Overview band
- **WHEN** six repositories are tracked with 36 open changes, 5 of them to archive
- **THEN** the band reads `Projects` with `Tracked 6`, `Open 36` and `To archive 5`, and **Pull all** stands in its action area
