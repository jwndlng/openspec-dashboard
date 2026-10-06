# Spec Delta

## MODIFIED Requirements

### Requirement: Overview rows summarise each repository
Each row SHALL show the repository name, the total of non-archived changes, the number of changes that are complete but not archived, and the relative age of the repository's last update. A row MUST NOT show the number of changes per board stage column; that breakdown is on the repository's board and on the combined board. Zero counts SHALL be rendered as a neutral placeholder rather than `0`. The to-archive count SHALL be conveyed with text and not by colour alone. A repository with no non-archived changes SHALL be shown de-emphasised with the text "no open changes". A repository whose last scan failed SHALL show a warning indicator exposing the error message while still showing its retained counts.

#### Scenario: Row content
- **WHEN** repository `alpha-infra` has 1 change in `Drafts`, 9 in `Implementing`, 2 in `Done`, 40 archived, and was last updated 1 day ago
- **THEN** its row shows an open total of `12`, a to-archive count of `2`, and `1d ago`

#### Scenario: No stage columns
- **WHEN** the overview is shown in the table layout and the combined board has the columns `Backlog`, `Drafts`, `Ready`, `Implementing`, `Done` and `Archived`
- **THEN** the table has no column headed by any of those stage names, and no row shows a count per stage

#### Scenario: Repository without open changes
- **WHEN** a repository has only archived changes
- **THEN** its row is de-emphasised and reads "no open changes" with its last-updated age

#### Scenario: Failed repository
- **WHEN** a repository has `ok: false` with error `repository path or its openspec/ directory does not exist`
- **THEN** its row shows a warning indicator whose tooltip contains that error

#### Scenario: Snapshot without a repository date
- **WHEN** a repository in the snapshot has no `lastUpdatedAt` but has changes with `lastActivityAt` values
- **THEN** the row uses the newest of those values as its last-updated age

### Requirement: Overview offers a table and a tiles layout
The overview SHALL offer two layouts of the same repositories, `Table` and `Tiles`, selectable with a toggle that marks the active layout. The table SHALL be the default. The chosen layout SHALL persist in the URL query string as `view=tiles`, omitted for the table, and SHALL survive a reload. Switching the layout MUST NOT change the sort, the search, the work-in-progress filter, or which repositories are listed and in which order. A tile SHALL show everything a row shows — the repository name with its path hint and full-path tooltip when names collide, the scan-failure warning, the open and to-archive totals with the to-archive count conveyed with text, "no open changes" de-emphasis, the last-updated age, the carried shared-config profiles when any exist, and the work-in-progress indicator — and in addition a checkout summary: the number of linked worktrees and the number of distinct branches checked out in any checkout, main included, as `<n> worktrees · <m> branches active`, with every checkout listed in its tooltip. A tile MUST NOT show the number of changes per board stage. A tile SHALL NOT list the checkouts or branches themselves; the repository board header does. In a tile the repository name SHALL be a real link, and activating the tile SHALL navigate to the repository board without a page reload, exactly as activating a row does. The tiles SHALL reflow to the available width without horizontal scrolling. The empty state and the "no repository matches" state SHALL be the same in both layouts.

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
- **THEN** its tile shows an open total of `12`, a to-archive count of `2`, `1d ago`, the indicator `1 worktree · 1 uncommitted`, and the checkout summary `1 worktree · 2 branches active`, whose tooltip names `main` as the main checkout and `feat/report` as a worktree, and it shows no count per stage

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
In the tiles layout every tile SHALL have the same width and the same height, whatever its repository holds, and SHALL place its parts in the same positions: a header with the repository's monogram in its repository colour, its name and path hint, the last-updated age and the Pull action; one line of badges (shared-config profiles, scan failure, off-default-branch notice, work-in-progress indicator); the open and to-archive totals as large numbers; and the checkout summary. A tile whose repository has no open changes SHALL keep the same size and show "no open changes" where the totals would be. When the badges do not fit their area, that area SHALL scroll within the tile, keeping every badge reachable, instead of growing the tile. Everything the "Overview offers a table and a tiles layout" requirement lists for a tile SHALL still be shown.

#### Scenario: Uneven repositories
- **WHEN** `alpha-infra` has five worktrees and three config profiles and `quill-docs` has no worktree and no open change
- **THEN** both tiles have the same height, `quill-docs` shows "no open changes", and `alpha-infra` reads `5 worktrees · 5 branches active` rather than listing them

#### Scenario: Grid reflows
- **WHEN** the window narrows
- **THEN** the tiles reflow to fewer per row, keep equal sizes, and the page does not scroll horizontally
