## MODIFIED Requirements

### Requirement: Copies of a change are merged into one change
All active copies of the same change name across a repository's checkouts SHALL be reported as one change. Its data SHALL be that of the leading copy, chosen by comparing in order: lifecycle stage (`unknown` before `backlog` before `drafts` before `ready`, `implementing`, `done`), number of done artifacts, number of done tasks, latest `lastActivityAt`, then the main checkout before linked worktrees and finally the path, so that the choice is deterministic. The change SHALL report the checkout of the leading copy (`path`, `branch` when it has one, and whether it is the main checkout) and the other checkouts that hold a copy, each with its column — leaving out linked worktrees whose copy shows the same progress as the main checkout's copy, since every branch carries the main branch's committed changes along and such a copy says nothing new. A pending archive leads over every active copy of the same name: the change SHALL be reported once, as archived with that archive's date, with the worktree holding the archive as its checkout and every active copy — the main checkout's included — among its other checkouts with its column; of several pending archives of one name the latest date leads. As the one exception, active copies whose `created` date is later than the pending archive's date SHALL be reported as a separate, active change. A pending archive without any active copy SHALL be reported as archived as well. An active copy in a linked worktree SHALL be ignored when the main checkout has an archived change of the same name, unless the copy's `created` date is later than that archive's date. An active copy in the main checkout SHALL NOT be reported as a change of its own when the main checkout also has an archived change of the same name, unless the copy's `created` date is later than that archive's date: such a copy is a leftover of the archived change, and the archived change with the latest date of that name SHALL list the main checkout among its other checkouts with the column the leftover copy alone would be in. A copy without a `created` date counts as not created later. This folding SHALL apply to a repository that is not a git repository as well, with the repository's own directory as its main checkout; it is the only merging such a repository gets. A change name SHALL therefore be reported at most once as archived and at most once as active, and only as both when the active one was created after the archive. The repository's `lastUpdatedAt` SHALL be no earlier than the latest `lastActivityAt` among its merged changes.

#### Scenario: Further along in a worktree
- **WHEN** `audit-trail` is in `Drafts` in the main checkout and has `tasks` `done: 4, total: 12` in a worktree on `feat/audit-trail`
- **THEN** one change `audit-trail` is reported in `Implementing` with `4/12`, its checkout is that worktree, and the main checkout is listed among its other checkouts as `Drafts`

#### Scenario: Worktrees that merely carry the change along
- **WHEN** `audit-trail` is in `Drafts` in the main checkout, in `Implementing` in one worktree, and unchanged in `Drafts` in three other worktrees cut from the main branch
- **THEN** the change's other checkouts list only the main checkout

#### Scenario: Stale copy behind main
- **WHEN** `audit-trail` has all tasks done in the main checkout and an older copy in `Drafts` in a worktree
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

#### Scenario: Further drafted in a worktree
- **WHEN** `audit-trail` is in `Drafts` with 1 of 4 artifacts written in the main checkout and with 3 of 4 written in a worktree
- **THEN** the worktree's copy leads, and the change is reported in `Drafts` with `3/4` artifacts

#### Scenario: Leftover active copy next to its archive in the main checkout
- **WHEN** the main checkout has `openspec/changes/archive/2026-09-20-audit-trail/` and also an untracked `openspec/changes/audit-trail/` created on `2026-09-10` whose tasks are all done and whose delta specs are applied
- **THEN** `audit-trail` is reported once, archived on `2026-09-20`, and the main checkout is listed among its other checkouts as `Done`; no active `audit-trail` is reported

#### Scenario: Leftover without a created date
- **WHEN** the main checkout has `audit-trail` archived on `2026-09-20` and an active `audit-trail` whose `.openspec.yaml` has no `created` date
- **THEN** `audit-trail` is reported once, as archived, with the main checkout among its other checkouts

#### Scenario: Name reused in the main checkout
- **WHEN** the main checkout has `audit-trail` archived on `2026-09-20` and an active `audit-trail` created on `2026-10-02`
- **THEN** both are reported: the archived change without other checkouts and the new active one

#### Scenario: Archived twice, leftover once
- **WHEN** the main checkout has `audit-trail` archived on `2026-08-01` and on `2026-09-20`, and a leftover active `audit-trail` created on `2026-09-10`
- **THEN** only the archive of `2026-09-20` lists the main checkout among its other checkouts, and no active `audit-trail` is reported

#### Scenario: Leftover in a folder without git
- **WHEN** a tracked folder that is not a git repository has both `openspec/changes/audit-trail/` created on `2026-09-10` and `openspec/changes/archive/2026-09-20-audit-trail/`
- **THEN** `audit-trail` is reported once, as archived, with the folder listed among its other checkouts with the leftover's column
