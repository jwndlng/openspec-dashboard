# project-overview Specification

## Purpose
Defines the repository-first navigation: the projects overview that lists every enabled repository with its per-stage change counts and last-updated time (sorting, search, same-name disambiguation), and the drill-down to a single repository's board with its header.

## Requirements

### Requirement: Projects overview is the landing page
The dashboard SHALL show a projects overview at `/` made of two sections, each under a headline with its count: **Managed projects**, listing every repository that is enabled in the configuration and present in the snapshot, one row per repository, followed by **Unmanaged projects**. A repository that is disabled or removed in the configuration SHALL disappear from Managed projects, the combined board, the repository boards and the top-bar error indicators as soon as the configuration is saved, without waiting for the next scan, even while the snapshot still contains it. A repository that is enabled in the configuration but not yet in the snapshot SHALL be listed under Managed projects as a pending entry showing its name and the text `Scanning…`, with no counts, until a snapshot containing it arrives. When no repository is enabled, the Managed projects headline SHALL be followed by an empty state saying that no repositories are tracked yet and pointing to the section below, and the Unmanaged projects section SHALL still be shown. The combined all-repositories board SHALL remain available at `/board`. The top bar SHALL offer navigation to the overview, the combined board and settings, and SHALL mark the overview entry as active on `/` and on any repository board.

#### Scenario: Opening the dashboard
- **WHEN** the user opens `/` with 17 tracked repositories
- **THEN** the headline `Managed projects · 17` and 17 repository rows are shown instead of the combined board, followed by the Unmanaged projects section

#### Scenario: Repository disabled in Settings
- **WHEN** the user disables `demo-agent` in Settings, saves, and opens the overview before the next scan has finished
- **THEN** `demo-agent` is not under Managed projects, it is listed under Unmanaged projects labelled as disabled, and opening its `/repo/<id>` URL shows "repository not found"

#### Scenario: Combined board still reachable
- **WHEN** the user opens `/board?q=terraform`
- **THEN** the combined board is shown with the search filter `terraform` applied

#### Scenario: No repositories tracked
- **WHEN** the snapshot contains no repositories and none are enabled in the config
- **THEN** the overview shows the "No repositories tracked yet" empty state under the Managed projects headline and, below it, the Unmanaged projects section

#### Scenario: A repository enabled a moment ago
- **WHEN** the user enables `alpha-infra` and the scan that includes it has not finished
- **THEN** Managed projects shows `alpha-infra` with `Scanning…` and no counts, and once the scan finishes the entry shows its counts like every other row

### Requirement: Overview rows summarise each repository
Each row SHALL show the repository name, the number of non-archived changes in each board stage column (using the same column list and order as the combined board, excluding `Archived`), the total of non-archived changes, the number of changes that are complete but not archived, and the relative age of the repository's last update. Zero counts SHALL be rendered as a neutral placeholder rather than `0`. The to-archive count SHALL be conveyed with text and not by colour alone. A repository with no non-archived changes SHALL be shown de-emphasised with the text "no open changes". A repository whose last scan failed SHALL show a warning indicator exposing the error message while still showing its retained counts.

#### Scenario: Row content
- **WHEN** repository `alpha-infra` has 1 change in `Drafts`, 9 in `Implementing`, 2 in `Done`, 40 archived, and was last updated 1 day ago
- **THEN** its row shows `1` under Drafts, `9` under Implementing, `2` under Done, an open total of `12`, a to-archive count of `2`, and `1d ago`

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

### Requirement: Repository rows open the repository's board
Activating a repository row SHALL navigate to `/repo/<repoId>` without a page reload, and the repository name SHALL be a real link so it can be opened in a new tab. The repository board SHALL show only that repository's changes, SHALL show the same lifecycle columns as the combined board, and SHALL NOT show the repository filter. The search, stale and hide-archived filters SHALL remain available and persist in the URL. The archived column, card actions and refresh behaviour SHALL be the same as on the combined board. Opening `/repo/<repoId>` directly SHALL work.

#### Scenario: Drill down
- **WHEN** the user clicks the row for `beta-soc`
- **THEN** the URL becomes `/repo/<id of beta-soc>` and only `beta-soc` changes are shown in Kanban columns

#### Scenario: Same columns for every schema
- **WHEN** most repositories use `spec-driven` but repository `gamma-lab` uses a schema whose artifacts are `brief` and `plan`
- **THEN** the board for `gamma-lab` shows `Backlog`, `Drafts`, `Ready`, `Implementing`, `Done` and `Archived`, and no `Brief` or `Plan` column

#### Scenario: Deep link
- **WHEN** the user opens `/repo/<id>?stale=14` in a new tab
- **THEN** that repository's board is shown with the stale filter set to 14 days

#### Scenario: Unknown repository
- **WHEN** the user opens `/repo/doesnotexist`
- **THEN** a "repository not found" message with a link back to the overview is shown

### Requirement: Repository board header
The repository board SHALL show a header with a breadcrumb linking back to the overview, the repository name, its path in monospace, an action that copies `cd <path>` (shell-quoted) to the clipboard, the main checkout's status chip, labelled as such, and a **branches** control reading `<n> branches` (the distinct branches checked out in any checkout) that, when any checkout holds uncommitted, unpushed or stale work, also says how many (`<m> with work`), and that opens a dialog listing one status chip per checkout of the repository — the main checkout and each linked worktree — each with its path — the relative age of the repository's last update, any repository warnings or scan error, and a **New change** action that opens the create-change form for that repository (as specified in the `change-creation` capability), and, for an enabled git repository whose last scan succeeded, a **Clean up** action that opens the cleanup dialog for that repository (as specified in the `repository-cleanup` capability). The New change action SHALL be shown only when the repository is enabled and its last scan succeeded and it has an `openspec/` directory to create into; otherwise the action SHALL be absent. A checkout chip SHALL show the checkout's branch, or that it is detached, and, only when they apply, text markers for: the number of uncommitted items, the number of unpushed commits, the number of commits behind the upstream, stale, locked, and status unknown or not inspected. A clean, fully pushed checkout SHALL show its branch alone. Every marker SHALL be conveyed with text or a symbol plus a tooltip that spells it out, never by colour alone; the tooltips for unpushed and behind SHALL state that the numbers reflect the last fetch, and the unpushed tooltip SHALL distinguish commits ahead of a named upstream from commits on a branch that was never pushed. When the snapshot carries no checkout information for the repository, the header SHALL fall back to the current branch when known. The header and the dialog MUST NOT offer any action on an individual checkout; worktrees are removed only through the Clean up dialog and the agent-session views. The dashboard MUST NOT execute the copied command.

#### Scenario: Header content
- **WHEN** repository `alpha-infra` at `/Users/x/Workspace/acme/alpha-infra` has a clean main checkout on `main` and two linked worktrees on `feat/report` and `fix/parser`, and was last updated 1 day ago
- **THEN** the header shows `Projects / alpha-infra`, the path, the chip `main` labelled as the main checkout, a `3 branches` control, `updated 1d ago`, a `New change` action and a `Clean up` action, and activating `3 branches` opens a dialog with the chips `main`, `feat/report` and `fix/parser` and their paths

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

#### Scenario: Clean up action
- **WHEN** the user activates the `Clean up` action on the header of a git repository
- **THEN** the cleanup dialog opens for that repository and nothing has been removed yet

#### Scenario: Clean up hidden for a non-git repository
- **WHEN** the repository is not a git repository, or its last scan failed
- **THEN** the header shows no `Clean up` action

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
- **WHEN** repository `alpha-infra` has 1 change in `Drafts`, 9 in `Implementing`, 2 in `Done`, was last updated 1 day ago, and has a clean main checkout on `main` plus a worktree on `feat/report` with 4 uncommitted items
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
The projects overview SHALL open with a header band like the boards': the title `Projects`, the numbers of tracked repositories, open changes and changes to archive as labelled counts, and **New project** and **Pull all** in the band's action area. Below it, a bar SHALL hold the repository search, the **Work in progress** toggle, the `Table`/`Tiles` layout toggle as one segmented control and, in the tiles layout, the sort. Their behaviour and URL persistence are unchanged.

#### Scenario: Overview band
- **WHEN** six repositories are tracked with 36 open changes, 5 of them to archive
- **THEN** the band reads `Projects` with `Tracked 6`, `Open 36` and `To archive 5`, and **New project** and **Pull all** stand in its action area

### Requirement: Overview shows open pull requests per repository
The projects overview SHALL show, for each repository, the number of open pull requests from the cached pull-request list of the `pull-requests` capability: as a column in the table layout and as a labelled figure on each tile. The figure SHALL link to `/pull-requests?repo=<id>` without opening the repository's board, and its tooltip SHALL say how many of them await review from the signed-in user and when the list was fetched. A repository whose list was never fetched, is unavailable or failed without an earlier list SHALL show a neutral placeholder whose tooltip gives the reason. The overview MUST NOT contact GitHub, neither on load nor on any interaction other than following the link.

#### Scenario: Counts from the cache
- **WHEN** the cached list of `alpha-infra` has 3 open pull requests, one awaiting the user's review, fetched 1 hour ago
- **THEN** its row shows `3`, and the tooltip says one awaits the user's review and that the list is 1 hour old

#### Scenario: Never fetched
- **WHEN** pull requests were never fetched
- **THEN** every row shows the placeholder, whose tooltip says the list has not been fetched yet, and no `gh` process is started

#### Scenario: Following the count
- **WHEN** the user activates the count of `beta-soc`
- **THEN** the Pull requests view opens filtered to `beta-soc`

### Requirement: Repository board lists the repository's pull requests
The repository board header SHALL offer a **pull requests** control reading `<n> open PRs` from the cached list, or a neutral text when there is no list, that opens a dialog with that repository's pull requests laid out as in the Pull requests view, its fetch time, its unavailable or failed reason when there is one, a Refresh control, and a link to `/pull-requests?repo=<id>`. Opening the dialog SHALL refresh the repository's list when it is older than five minutes or was never fetched, under the rules of the `pull-requests` capability; the board itself MUST NOT contact GitHub. The control SHALL NOT be offered for a repository that is not a git repository.

#### Scenario: Opening the dialog
- **WHEN** the user activates `2 open PRs` on the board of `alpha-infra`, whose list is 10 minutes old
- **THEN** the dialog shows the 2 cached pull requests at once, refreshes the list, and shows the result

#### Scenario: Not on GitHub
- **WHEN** the repository's `origin` is not on `github.com`
- **THEN** the dialog says the repository is not on GitHub and no `gh` process is started

#### Scenario: Non-git repository
- **WHEN** the tracked repository is not a git repository
- **THEN** its board header offers no pull requests control

### Requirement: The overview lists unmanaged projects in one list
Below the managed projects the projects overview SHALL show a section under the headline **Unmanaged projects** with the number of projects it lists. It SHALL list, in one list ordered by name, then path, whatever kind each entry is: repositories in the configuration with `enabled: false`, repositories the latest discovery run reported as candidates, and repositories the latest discovery run reported as integratable. Each entry SHALL show the repository's name, a label saying in words what it is — `disabled`, `OpenSpec` (a candidate) or `no OpenSpec` (integratable) — with a tooltip explaining it, its path, the same-name path hint when its name collides with any other repository listed anywhere on the overview, and, for a candidate that shares its `origin` remote with other known repositories, a badge naming them whose tooltip lists their paths. The section SHALL NOT be split into groups or sub-headings. It SHALL be laid out the same in the `Table` and `Tiles` layouts. The overview's search SHALL filter the section by the same rule as the managed projects, and the Work in progress filter SHALL hide the whole section. The section MUST NOT show counts, work in progress or pull requests for its entries, and it MUST NOT offer any action on a checkout.

#### Scenario: One list
- **WHEN** `demo-agent` is configured and disabled, discovery reports the candidate `beta-soc` and the integratable repository `chat-groups`
- **THEN** the headline reads `Unmanaged projects · 3` and one list shows `beta-soc` labelled `OpenSpec`, `chat-groups` labelled `no OpenSpec` and `demo-agent` labelled `disabled`, in that order, with no sub-headings

#### Scenario: Search covers the section
- **WHEN** the user searches `beta` with `beta-soc` managed and `beta-tools` discovered
- **THEN** the managed projects show `beta-soc` and the unmanaged projects show only `beta-tools`

#### Scenario: Work in progress filter
- **WHEN** the user turns the Work in progress filter on
- **THEN** the Unmanaged projects section is not shown

#### Scenario: Second clone flagged
- **WHEN** `pkg-tools` is managed and the candidate `ops/repo-mirror/repos/pkg-tools` has the same `origin`
- **THEN** the candidate shows the path hint `ops/repo-mirror/repos` and a badge naming `pkg-tools`, and can still be enabled

### Requirement: Discovery runs from the overview
The overview SHALL run discovery against the saved workspace roots and ignore paths when it is opened and the configuration has at least one workspace root, after every Enable or Ignore it performs, and when the user activates **Rediscover** beside the Unmanaged projects headline. While a run is in progress the section SHALL say so and keep showing the previous result, if any; only the latest run's result SHALL be applied. Per-root errors SHALL be shown in the section with a link to the Workspace roots section of Settings. With no workspace root configured, the section SHALL list the disabled repositories, if any, and a hint with a link to the Workspace roots section of Settings, and SHALL make no discovery request. Discovery MUST NOT run on a timer, during a scan or from any other view as a side effect of the overview.

#### Scenario: Opening the overview
- **WHEN** the user opens `/` and the config has one workspace root holding an untracked OpenSpec repository
- **THEN** discovery runs without any further action and the repository appears under Unmanaged projects, labelled `OpenSpec`

#### Scenario: No roots yet
- **WHEN** the config has no workspace roots
- **THEN** no discovery request is made and the section links to the Workspace roots settings

#### Scenario: A root that is gone
- **WHEN** a saved workspace root no longer exists
- **THEN** the section names that root with its error and a link to the Workspace roots settings, and lists what the other roots hold

#### Scenario: Rediscover
- **WHEN** the user creates a new OpenSpec project under a workspace root and activates Rediscover
- **THEN** the new project appears under Unmanaged projects

### Requirement: Repositories are enabled, disabled and ignored from the overview
Each unmanaged entry SHALL offer the actions that fit what it is: a disabled repository **Enable**; a candidate **Enable** and **Ignore**; an integratable repository **Integrate** and **Ignore**. Each tracked repository on the overview, as a row and as a tile, SHALL offer **Disable**. These actions SHALL take effect when activated, persisting the configuration without a separate save and without a confirmation: Enable on a disabled repository sets it enabled, keeping its name; Enable on a discovered repository adds it to the configuration with `enabled: true` and its default name, disambiguated as for any enabled candidate; Disable sets the repository's `enabled: false`, keeping its name; Ignore adds the entry's path to the ignore paths. After Enable or Disable the repository SHALL move between the two sections at once, without waiting for a scan. While an action is in progress its control SHALL show that it is working and SHALL not be activatable again; when it fails the reason SHALL be shown on that entry and the overview SHALL be unchanged. Activating a row's or tile's Disable MUST NOT open the repository's board.

#### Scenario: Enabling a discovered repository
- **WHEN** the user activates Enable on the discovered repository `beta-soc`
- **THEN** the configuration contains `beta-soc` with `enabled: true` without the user pressing any Save, `beta-soc` is shown under Managed projects as `Scanning…`, and a scan starts

#### Scenario: Re-enabling a disabled repository
- **WHEN** the user activates Enable on the disabled repository renamed "Beta SOC"
- **THEN** it is enabled with the name "Beta SOC" and moves to Managed projects

#### Scenario: Disabling a tracked repository
- **WHEN** the user activates Disable on the row of `demo-agent`
- **THEN** `demo-agent` stays in the configuration with `enabled: false` and its name, leaves Managed projects, is listed under Unmanaged projects labelled `disabled`, and the repository board is not opened

#### Scenario: Ignoring a discovered repository
- **WHEN** the user activates Ignore on the discovered repository `/w/mirror/beta-soc`
- **THEN** `/w/mirror/beta-soc` is added to the saved ignore paths, discovery runs again, and the entry is gone

#### Scenario: The update is refused
- **WHEN** the user activates Enable and the server refuses the request
- **THEN** the entry shows the reason and stays where it was

### Requirement: Repositories without OpenSpec are integrated from the overview
Each unmanaged entry labelled `no OpenSpec` SHALL offer **Integrate**, with the behaviour, the in-place warning and the unavailable reasons the `repo-integration` capability defines. While an integration session for the entry's folder runs, the entry SHALL offer **Setting up…** instead, which shows that session. When integration is unavailable, the section SHALL state the reason once, and the entries SHALL still be listed. When the agent cannot be started, the reason SHALL be shown on that entry. Once the repository is added to the configuration it SHALL leave Unmanaged projects and appear under Managed projects.

#### Scenario: Integrating from the overview
- **WHEN** agent sessions are on and the user activates Integrate on `chat-groups`
- **THEN** the integration session's terminal is shown, and while it runs the entry offers Setting up…

#### Scenario: Integration confirmed
- **WHEN** the integration of `chat-groups` ends with `openspec/config.yaml` in its folder
- **THEN** `chat-groups` is no longer under Unmanaged projects and is shown under Managed projects

#### Scenario: Agent sessions off
- **WHEN** agent sessions are disabled
- **THEN** the `no OpenSpec` entries are listed, Integrate is inactive on each, and the section says that agent sessions are off

### Requirement: Each managed project carries its own settings on the overview
Each managed project on the projects overview, as a table row and as a tile, SHALL offer the settings that belong to that one project, each taking effect when changed: the configuration is persisted without a separate save and without a confirmation, and the overview reflects it at once, without waiting for a scan. The settings are:

- **Agent sessions**: a toggle whose state reads **Enabled** or **Disabled**, exposed to assistive technology as a switch with the project's name in its accessible name. A project without a saved agent-session setting SHALL show **Enabled**. While agent sessions are switched off globally, the toggle SHALL still show the project's own setting but SHALL be inactive, and SHALL say that agent sessions are off with a link to the Agent sessions section of Settings.
- **Agent**: a picker offering "default agent" and every configured agent profile by name, showing the project's current choice. It SHALL be shown only when more than one agent profile is configured and the project's agent sessions are enabled. Choosing "default agent" SHALL clear the project's own choice.
- **PR titles**: a picker offering **No convention** and **Conventional Commits**, showing the project's current choice, with an accessible name that includes the project's name and a tooltip saying that Ship asks the agent to title its pull requests this way. It SHALL be shown only for a project that is a git repository. Choosing **No convention** SHALL clear the project's convention. The setting is used by Ship, as the `agent-sessions` capability specifies; while agent sessions are switched off globally or for the project, the picker SHALL still show and change the project's own setting.
- **Rename**: an action that turns the project's name into a text field in place, prefilled with the current name. Pressing Enter or moving focus out of the field SHALL save the trimmed name; pressing Escape SHALL leave the name unchanged. A name that is empty after trimming MUST NOT be saved, and the field SHALL say why. An unchanged name SHALL be saved without a request. The new name SHALL be shown on the overview, on the repository's board and in the board's repository groups at once.
- **Labels**: an action that opens the project's labels dialog, as the `project-labels` capability specifies.

While a setting is being saved its control SHALL show that it is working and SHALL not be activatable again; when saving fails the reason SHALL be shown on that project and the setting SHALL show its previous value. Activating any of these controls, or typing in the rename field, MUST NOT open the repository's board. A pending `Scanning…` entry SHALL offer none of these settings.

#### Scenario: Switching a project off for agent sessions
- **WHEN** agent sessions are on and the user switches the toggle on the row of `alpha-infra` to Disabled
- **THEN** the configuration has agent sessions switched off for `alpha-infra` without any Save, the toggle reads Disabled, the cards of `alpha-infra` show no session starter, and the board is not opened

#### Scenario: Projects are enabled by default
- **WHEN** agent sessions are on and a project was enabled on the overview a moment ago
- **THEN** its toggle reads Enabled and its cards offer session starters

#### Scenario: Sessions are off globally
- **WHEN** agent sessions are switched off in Settings
- **THEN** every project's toggle shows its own setting, is inactive, says that agent sessions are off and links to the Agent sessions section of Settings

#### Scenario: Choosing an agent
- **WHEN** two agent profiles are configured and the user picks `my-agent` on the tile of `demo-ops`
- **THEN** the configuration has `my-agent` for `demo-ops` without any Save, and Implement on a `demo-ops` card starts `my-agent`

#### Scenario: One agent configured
- **WHEN** only one agent profile is configured
- **THEN** no project shows an agent picker

#### Scenario: Choosing Conventional Commits for pull request titles
- **WHEN** the user picks **Conventional Commits** under PR titles on the tile of `demo-ops`
- **THEN** the configuration has `prTitleConvention: conventional-commits` for `demo-ops` without any Save, the picker shows Conventional Commits, no scan is started, and the board is not opened

#### Scenario: Clearing the convention
- **WHEN** the user picks **No convention** for a project that has Conventional Commits
- **THEN** the project's entry no longer carries `prTitleConvention`

#### Scenario: A folder without git
- **WHEN** a managed project is a folder that is not a git repository
- **THEN** its row and tile show no PR titles picker

#### Scenario: Renaming a project
- **WHEN** the user activates Rename on the row of `beta-soc`, types `Beta SOC` and presses Enter
- **THEN** the configuration has the name `Beta SOC` without any Save, the row and the repository's board show `Beta SOC`, and no scan was needed for it

#### Scenario: Cancelling a rename
- **WHEN** the user activates Rename, types `x` and presses Escape
- **THEN** the name is unchanged and no request is made

#### Scenario: An empty name
- **WHEN** the user clears the rename field and presses Enter
- **THEN** nothing is saved, the field stays open and says that a name is required

#### Scenario: The update is refused
- **WHEN** the user switches a project's agent sessions to Disabled and the server refuses the request
- **THEN** the project shows the reason and the toggle reads Enabled again

### Requirement: Disabled repositories can be forgotten from the overview
Each entry under Unmanaged projects labelled `disabled` SHALL offer **Forget** beside **Enable**. Forget SHALL take effect when activated, without a separate save and without a confirmation, and SHALL remove the repository from the configuration together with its name and its agent-session settings. Its tooltip SHALL say so, and SHALL say that a repository still under a workspace root is offered again as a discovered repository. After Forget the overview SHALL run discovery again. Forget SHALL NOT be offered on discovered or integratable entries, nor on managed projects. While Forget is in progress its control SHALL show that it is working; when it fails the reason SHALL be shown on that entry and the entry SHALL stay.

#### Scenario: Forgetting a disabled repository
- **WHEN** `demo-agent` is disabled, still lies under a workspace root, and the user activates Forget on its entry
- **THEN** `demo-agent` is no longer in the configuration, without any Save, and after discovery it is listed again labelled `OpenSpec` with its default name

#### Scenario: Forgetting a repository outside the roots
- **WHEN** the user forgets a disabled repository that lies under no workspace root
- **THEN** it is gone from Unmanaged projects

#### Scenario: Only disabled entries
- **WHEN** Unmanaged projects lists a disabled, a discovered and an integratable repository
- **THEN** only the disabled one offers Forget
