## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Drill down to a repository board
**Reason**: Replaced by "Repository rows open the repository's board", identical except that a repository board no longer derives schema-specific columns from its changes.
**Migration**: None; a repository board shows the same lifecycle columns as the combined board.

## ADDED Requirements

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
