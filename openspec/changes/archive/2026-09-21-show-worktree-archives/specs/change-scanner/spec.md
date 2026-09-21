## MODIFIED Requirements

### Requirement: Changes are read from every checkout of a repository
For a git repository the scanner SHALL read active changes (`openspec/changes/*` excluding `archive/`) from the main checkout and from every linked worktree that `git worktree list` reports for it, wherever that worktree is located on disk. When the tracked project sits in a subdirectory of its git repository, it SHALL be read from that same subdirectory of each worktree, never from the worktree's top level. A worktree SHALL be skipped when it is prunable, is bare, or has no `openspec/changes` directory there. Archived changes SHALL be read from the main checkout and, by directory name only, from those same worktrees; an archive of a worktree that the main checkout does not have under the same name with the same or a later date is a *pending archive*, and only pending archives are read further. Main specs shown by the dashboard SHALL be read from the main checkout only. Every per-change fact — artifact status, task progress, warnings, `lastActivityAt` and `specsSynced` — SHALL be computed for a copy within the checkout it was found in: git commands run with that checkout as working directory, uncommitted modifications in that checkout count towards `lastActivityAt`, the checkout's own `openspec/config.yaml` supplies the fallback schema, and spec sync is judged against that checkout's `openspec/specs/`. Change directory names found in worktrees SHALL pass the same validation as those in the main checkout. Worktree paths MUST come only from `git worktree list` of a tracked repository. Reading worktrees MUST remain read-only and MUST NOT use any git subcommand beyond those already allowed. Linked worktrees SHALL still not be offered as repositories by discovery.

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

#### Scenario: Archive that exists only in a worktree
- **WHEN** a worktree on an archive branch contains `openspec/changes/archive/2026-09-20-audit-trail/` while the main checkout still has `audit-trail` as an active change
- **THEN** that archive is read as a pending archive, with its facts computed in that worktree

#### Scenario: Archives come from main only
- **WHEN** a worktree's `openspec/changes/archive/` holds the same forty archives as the main checkout's
- **THEN** each is reported once, from the main checkout, and none of them is read from the worktree

#### Scenario: Project in a subdirectory of its repository
- **WHEN** the tracked project is `services/billing` inside a repository that has its own top-level `openspec/`, and a worktree has progress on a change under its `services/billing/openspec/changes/`
- **THEN** that progress is reported, and nothing from any top-level `openspec/` appears among the project's changes

#### Scenario: Non-git repository
- **WHEN** a tracked repository is not a git repository
- **THEN** its changes are read from its own directory exactly as before

### Requirement: Copies of a change are merged into one change
All active copies of the same change name across a repository's checkouts SHALL be reported as one change. Its data SHALL be that of the leading copy, chosen by comparing in order: lifecycle stage (`new` before artifact stages before `ready`, `implementing`, `done`, `synced`), number of done artifacts, number of done tasks, latest `lastActivityAt`, then the main checkout before linked worktrees and finally the path, so that the choice is deterministic. The change SHALL report the checkout of the leading copy (`path`, `branch` when it has one, and whether it is the main checkout) and the other checkouts that hold a copy, each with its column — leaving out linked worktrees whose copy shows the same progress as the main checkout's copy, since every branch carries the main branch's committed changes along and such a copy says nothing new. A pending archive leads over every active copy of the same name: the change SHALL be reported once, as archived with that archive's date, with the worktree holding the archive as its checkout and every active copy — the main checkout's included — among its other checkouts with its column; of several pending archives of one name the latest date leads. As the one exception, active copies whose `created` date is later than the pending archive's date SHALL be reported as a separate, active change. A pending archive without any active copy SHALL be reported as archived as well. An active copy in a linked worktree SHALL be ignored when the main checkout has an archived change of the same name, unless the copy's `created` date is later than that archive's date. The repository's `lastUpdatedAt` SHALL be no earlier than the latest `lastActivityAt` among its merged changes.

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

#### Scenario: Archived in a worktree, still active in main
- **WHEN** the main checkout has `audit-trail` at `Implementing` with `5/6` and a worktree on `chore/archive-audit-trail` has `openspec/changes/archive/2026-09-20-audit-trail/`
- **THEN** one change `audit-trail` is reported, archived on `2026-09-20`, its checkout is that worktree, and the main checkout is listed among its other checkouts as `Implementing`

#### Scenario: Name reused after a pending archive
- **WHEN** a worktree has `audit-trail` archived on `2026-09-20` and the main checkout has an active `audit-trail` created on `2026-10-02`
- **THEN** both are reported: the archived change from the worktree and the active one
