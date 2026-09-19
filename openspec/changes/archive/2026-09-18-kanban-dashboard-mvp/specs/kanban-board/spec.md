## ADDED Requirements

### Requirement: Board columns are derived from schema and implementation state
The board SHALL place each change in exactly one column using, in order: `Archived` if the change is archived; `Done` if `tasks.total > 0` and `tasks.done == tasks.total`; `Implementing` if `tasks.done > 0`, or if every artifact is done (ready to apply); otherwise the display name of the first artifact in schema order whose status is not `done`. Column order SHALL be the artifact columns of the majority schema, then `Implementing`, `Done`, `Archived`. Columns MUST NOT be hardcoded to the `spec-driven` schema.

#### Scenario: Change with proposal only
- **WHEN** a change has `proposal: done` and `design: ready`
- **THEN** it appears in the `Design` column

#### Scenario: Ready to apply
- **WHEN** all artifacts are done and `tasks` is `done: 0, total: 12`
- **THEN** it appears in `Implementing` showing `0/12`

#### Scenario: Complete but not archived
- **WHEN** `tasks` is `done: 12, total: 12` and the change is not archived
- **THEN** it appears in the `Done` column

#### Scenario: All artifacts done but tasks file empty
- **WHEN** all artifacts are done and `tasks` is `done: 0, total: 0`
- **THEN** it appears in `Implementing` with a "no tasks" warning badge

### Requirement: Cards show repository, name, progress, activity and branch
Each card SHALL display the repository name, the change name in monospace, a progress bar with `done/total` when tasks exist, the relative age of `lastActivityAt` (e.g. "3d ago"), and a branch badge when `branchMatch` is set. Cards in `Done` SHALL additionally show how long the change has been complete.

#### Scenario: Card content
- **WHEN** a change `cloud-deployment` in repo `demo-ops` has `tasks 30/30`, last activity 12 days ago and no branch match
- **THEN** the card shows `demo-ops`, `cloud-deployment`, a full progress bar labelled `30/30`, `12d ago`, and no branch badge

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

### Requirement: Archived column is collapsed and bounded
The `Archived` column SHALL be collapsed by default, expand on click, and show at most the 25 most recently archived changes sorted by archive date descending, with a count of the total archived across tracked repos.

#### Scenario: Collapsed by default
- **WHEN** the board loads with 96 archived changes
- **THEN** the `Archived` column header shows `96` and its cards are hidden until expanded

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
The UI SHALL use the dark token set defined in design.md (backgrounds `#080d16`…`#243350`, teal brand `#71c7c5`, Space Grotesk for text, JetBrains Mono for identifiers, 4px radius) with fonts bundled locally. The UI MUST render correctly without network access.

#### Scenario: Offline rendering
- **WHEN** the dashboard is opened with no network connectivity
- **THEN** fonts and styles render as designed with no external requests
