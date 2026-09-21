## MODIFIED Requirements

### Requirement: Branch and worktree matching
The scanner SHALL record the repository's current branch and its worktrees (`git worktree list --porcelain`), including detached worktrees (which have no branch) and whether a worktree is prunable. A change whose leading copy was found in a linked worktree SHALL get `branchMatch` set to that worktree's branch. Any other change SHALL get `branchMatch` set to the first branch or worktree branch whose name contains the change name.

#### Scenario: Feature branch checked out in a worktree
- **WHEN** a worktree is on branch `feat/structured-report-format` and a change `structured-report-format` exists
- **THEN** the change has `branchMatch: feat/structured-report-format`

#### Scenario: Branch name does not contain the change name
- **WHEN** change `audit-trail` exists only in a worktree on branch `wip/compliance`
- **THEN** the change has `branchMatch: wip/compliance`

#### Scenario: Detached worktree
- **WHEN** a repository has a worktree with a detached HEAD
- **THEN** that worktree is listed without a branch and no change gets a `branchMatch` from it

## ADDED Requirements

### Requirement: Changes are read from every checkout of a repository
For a git repository the scanner SHALL read active changes (`openspec/changes/*` excluding `archive/`) from the main checkout and from every linked worktree that `git worktree list` reports for it, wherever that worktree is located on disk. A worktree SHALL be skipped when it is prunable, is bare, or has no `openspec/changes` directory. Archived changes and main specs shown by the dashboard SHALL be read from the main checkout only. Every per-change fact — artifact status, task progress, warnings, `lastActivityAt` and `specsSynced` — SHALL be computed for a copy within the checkout it was found in: git commands run with that checkout as working directory, uncommitted modifications in that checkout count towards `lastActivityAt`, the checkout's own `openspec/config.yaml` supplies the fallback schema, and spec sync is judged against that checkout's `openspec/specs/`. Change directory names found in worktrees SHALL pass the same validation as those in the main checkout. Worktree paths MUST come only from `git worktree list` of a tracked repository. Reading worktrees MUST remain read-only and MUST NOT use any git subcommand beyond those already allowed. Linked worktrees SHALL still not be offered as repositories by discovery.

#### Scenario: Change that exists only in a worktree
- **WHEN** change `audit-trail` exists, uncommitted, only in a linked worktree of a tracked repository
- **THEN** it appears in that repository's changes with the artifact status and task progress read from that worktree

#### Scenario: Worktree outside the repository directory
- **WHEN** a linked worktree of the repository lives under a directory unrelated to the repository's path
- **THEN** its active changes are read like those of any other worktree

#### Scenario: Uncommitted edit in a worktree drives last activity
- **WHEN** `tasks.md` of a change in a worktree was modified two minutes ago without committing
- **THEN** the change's `lastActivityAt` is that modification time

#### Scenario: Spec sync is judged in the change's own checkout
- **WHEN** a complete change in a worktree has delta specs that are already merged into that worktree's `openspec/specs/` but not into the main checkout's
- **THEN** `specsSynced` is `true`

#### Scenario: Archives come from main only
- **WHEN** a worktree on an archive branch contains `openspec/changes/archive/2026-09-20-audit-trail/` while the main checkout still has `audit-trail` as an active change
- **THEN** `audit-trail` is reported as active, from the main checkout

#### Scenario: Non-git repository
- **WHEN** a tracked repository is not a git repository
- **THEN** its changes are read from its own directory exactly as before

### Requirement: Copies of a change are merged into one change
All active copies of the same change name across a repository's checkouts SHALL be reported as one change. Its data SHALL be that of the leading copy, chosen by comparing in order: lifecycle stage (`new` before artifact stages before `ready`, `implementing`, `done`, `synced`), number of done artifacts, number of done tasks, latest `lastActivityAt`, then the main checkout before linked worktrees and finally the path, so that the choice is deterministic. The change SHALL report the checkout of the leading copy (`path`, `branch` when it has one, and whether it is the main checkout) and the other checkouts that hold a copy, each with its column — leaving out linked worktrees whose copy shows the same progress as the main checkout's copy, since every branch carries the main branch's committed changes along and such a copy says nothing new. An active copy in a linked worktree SHALL be ignored when the main checkout has an archived change of the same name, unless the copy's `created` date is later than that archive's date. The repository's `lastUpdatedAt` SHALL be no earlier than the latest `lastActivityAt` among its merged changes.

#### Scenario: Further along in a worktree
- **WHEN** `audit-trail` is at `Proposal` in the main checkout and has `tasks` `done: 4, total: 12` in a worktree on `feat/audit-trail`
- **THEN** one change `audit-trail` is reported in `Implementing` with `4/12`, its checkout is that worktree, and the main checkout is listed among its other checkouts as `Proposal`

#### Scenario: Worktrees that merely carry the change along
- **WHEN** `audit-trail` is at `Proposal` in the main checkout, at `Implementing` in one worktree, and unchanged at `Proposal` in three other worktrees cut from the main branch
- **THEN** the change's other checkouts list only the main checkout

#### Scenario: Stale copy behind main
- **WHEN** `audit-trail` has all tasks done in the main checkout and an older copy at `Proposal` in a worktree
- **THEN** the change is reported from the main checkout and the worktree is listed among its other checkouts

#### Scenario: Finished change is not resurrected
- **WHEN** the main checkout has `openspec/changes/archive/2026-09-20-audit-trail/` and a worktree cut before the archive still has `openspec/changes/audit-trail/` created on `2026-09-10`
- **THEN** `audit-trail` is reported only as archived

#### Scenario: Name reused after archiving
- **WHEN** the main checkout has `audit-trail` archived on `2026-09-20` and a worktree has an active `audit-trail` created on `2026-10-02`
- **THEN** both are reported: the archived change and the new active one

#### Scenario: Identical copies
- **WHEN** the same change is at the same stage with the same progress and last activity in the main checkout and in two worktrees
- **THEN** the main checkout is the leading copy, on every scan

#### Scenario: Repository activity in a worktree only
- **WHEN** the only recent activity of a repository is an uncommitted edit to a change in a worktree, ten minutes ago
- **THEN** the repository's `lastUpdatedAt` is that time

### Requirement: Reading worktrees is bounded and isolated
The scanner SHALL read a repository's worktrees with bounded concurrency and SHALL read at most 12 worktrees per repository, preferring those whose `openspec/changes` directory was modified most recently; when worktrees are left out, the repository's warnings SHALL say how many. A worktree that cannot be read, or whose reading fails or times out, SHALL be skipped with a repository warning naming it, and MUST NOT fail the repository's scan or affect changes read from other checkouts. All of it SHALL run within the repository's scan timeout.

#### Scenario: Worktree directory was deleted by hand
- **WHEN** git reports a worktree as prunable because its directory no longer exists
- **THEN** it is skipped, the repository is reported with `ok: true`, and changes from other checkouts are unaffected

#### Scenario: One worktree fails
- **WHEN** reading one worktree throws while two others are readable
- **THEN** the repository's warnings name the failing worktree and the changes from the main checkout and the other two worktrees are reported

#### Scenario: More worktrees than the cap
- **WHEN** a repository has 15 linked worktrees with changes
- **THEN** the 12 with the most recently modified `openspec/changes` are read and the warnings say that 3 were not
