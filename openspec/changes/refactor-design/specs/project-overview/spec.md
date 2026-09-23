## MODIFIED Requirements

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

## ADDED Requirements

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
