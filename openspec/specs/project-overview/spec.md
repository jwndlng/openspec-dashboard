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
The overview SHALL be sorted by last updated, newest first, by default. The user SHALL be able to sort by repository name, open count, to-archive count and last updated by activating the column header, and activating the active header again SHALL reverse the direction. Ties SHALL be broken by repository name, and repositories without a last-updated value SHALL sort after all others. The overview SHALL provide a free-text search over repository names. Sort key, direction and search SHALL apply instantly on the client and persist in the URL query string, with default values omitted.

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
The repository board SHALL show a header with a breadcrumb linking back to the overview, the repository name, its path in monospace, an action that copies `cd <path>` (shell-quoted) to the clipboard, the current branch when known, the number of worktrees, the relative age of the repository's last update, any repository warnings or scan error, and a **New change** action that opens the create-change form for that repository (as specified in the `change-creation` capability). The New change action SHALL be shown only when the repository is enabled and its last scan succeeded and it has an `openspec/` directory to create into; otherwise the action SHALL be absent. The dashboard MUST NOT execute the copied command.

#### Scenario: Header content
- **WHEN** repository `alpha-infra` at `/Users/x/Workspace/acme/alpha-infra` is on branch `main` with 3 worktrees and was last updated 1 day ago
- **THEN** the header shows `Projects / alpha-infra`, the path, `main`, `3 worktrees`, `updated 1d ago`, and a `New change` action

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
