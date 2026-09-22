# Spec Delta

## MODIFIED Requirements

### Requirement: Branch and worktree matching
The scanner SHALL record the repository's current branch and every checkout that `git worktree list --porcelain` reports: the main checkout, flagged as such, and each linked worktree. For each checkout it SHALL record the path, the branch when one is checked out, whether HEAD is detached, whether the worktree is locked, and whether it is prunable (its directory no longer exists). A detached worktree MUST NOT be omitted. The main checkout MUST NOT be counted as a worktree: every worktree count the scanner reports SHALL count linked worktrees only. A change SHALL get `branchMatch` set to the first branch or worktree branch whose name contains the change name; checkouts without a branch SHALL NOT take part in the matching.

#### Scenario: Feature branch checked out in a worktree
- **WHEN** a worktree is on branch `feat/structured-report-format` and a change `structured-report-format` exists
- **THEN** the change has `branchMatch: feat/structured-report-format`

#### Scenario: Main checkout is not a worktree
- **WHEN** a repository has its main checkout and two linked worktrees
- **THEN** three checkouts are recorded, one flagged as the main checkout, and the repository's worktree count is `2`

#### Scenario: Repository without linked worktrees
- **WHEN** a repository has only its main checkout
- **THEN** its worktree count is `0`

#### Scenario: Detached worktree
- **WHEN** a linked worktree has a detached HEAD
- **THEN** it is recorded as detached without a branch, is counted as a worktree, and is ignored by branch matching

#### Scenario: Worktree directory was deleted
- **WHEN** the directory of a linked worktree was removed without `git worktree remove`
- **THEN** the worktree is recorded as prunable and the repository is still reported with `ok: true`

#### Scenario: Locked worktree
- **WHEN** a linked worktree is locked
- **THEN** it is recorded as locked

## ADDED Requirements

### Requirement: Working-tree status is reported for every checkout
For the main checkout and each linked worktree of a git repository the scanner SHALL report a working-tree status: the number of modified items (tracked files that differ from `HEAD`, staged or not, including renamed and unmerged files), the number of untracked items (an untracked directory counts as one item), the upstream branch when one is configured, and the number of commits the checkout is ahead of and behind that upstream. For a checkout without an upstream — including a detached HEAD — in a repository that has at least one remote-tracking ref, the scanner SHALL instead report the number of commits reachable from `HEAD` that are on no remote-tracking ref, capped at 100. Each checkout's number of unpushed commits SHALL be the ahead count when an upstream exists, that local-only count when it does not but remote-tracking refs exist, and SHALL be omitted when the repository has no remote-tracking refs. A branch without commits SHALL be reported without error. A prunable worktree MUST NOT be inspected and SHALL carry no status. All values are relative to the last fetch: the scanner MUST NOT contact a remote or fetch. The status MUST be obtained only with the read-only git subcommands already permitted, with optional locks disabled, and MUST NOT modify the index or any file of any checkout. The snapshot MUST contain counts only — never the names, paths or contents of changed files. The working-tree status SHALL NOT alter how `lastActivityAt` and `lastUpdatedAt` are determined.

#### Scenario: Clean checkout
- **WHEN** a linked worktree on `feat/report` has no local changes and is level with its upstream `origin/feat/report`
- **THEN** its status is `modified: 0`, `untracked: 0`, `upstream: origin/feat/report`, `ahead: 0`, `behind: 0`, and its unpushed count is `0`

#### Scenario: Uncommitted work
- **WHEN** a checkout has one edited tracked file, one staged new file, one renamed file and an untracked directory holding 40 files
- **THEN** its status is `modified: 3` and `untracked: 1`

#### Scenario: Ahead and behind the upstream
- **WHEN** a checkout has 2 commits its upstream lacks and lacks 5 commits its upstream has
- **THEN** its status is `ahead: 2`, `behind: 5`, and its unpushed count is `2`

#### Scenario: Branch that was never pushed
- **WHEN** a worktree is on a branch without an upstream, holding 3 commits that are on no remote-tracking ref, and the repository has remote-tracking refs
- **THEN** its status has no upstream and no ahead or behind count, and its unpushed count is `3`

#### Scenario: Repository without a remote
- **WHEN** a repository has no remote-tracking refs
- **THEN** no checkout of it reports an unpushed count

#### Scenario: Detached checkout with local commits
- **WHEN** a detached worktree holds 1 commit that is on no remote-tracking ref
- **THEN** its unpushed count is `1`

#### Scenario: Branch without commits
- **WHEN** a checkout is on a branch that has no commits yet and contains two untracked files
- **THEN** its status is `untracked: 2` and the repository is reported with `ok: true`

#### Scenario: Prunable worktree is not inspected
- **WHEN** a linked worktree is prunable
- **THEN** no git command runs in its path and it carries no status

#### Scenario: Scanning leaves every checkout untouched
- **WHEN** a repository with a dirty linked worktree is scanned
- **THEN** the index file and the working-tree files of the main checkout and of every linked worktree are byte-identical before and after the scan

#### Scenario: No file names in the snapshot
- **WHEN** a checkout has a modified file `secret-plan.md`
- **THEN** the snapshot contains the count but the string `secret-plan.md` appears nowhere in it

### Requirement: Checkout inspection is bounded and failure-isolated
The scanner SHALL inspect the checkouts of a repository with a bounded concurrency and within the repository's existing scan timeout. It SHALL always inspect the main checkout and SHALL inspect at most 12 linked worktrees per repository; further linked worktrees SHALL still be listed, marked as not inspected and without a status. When the status of a checkout cannot be determined — the command fails or times out — that checkout SHALL be reported with an unknown status, and this MUST NOT fail the repository's scan nor affect the status of its other checkouts. Only paths reported by `git worktree list` for a tracked repository SHALL be used as the working directory of such a command. When a repository's scan fails, its previously recorded checkouts and their statuses SHALL be retained. A repository that is not a git repository SHALL report no checkouts.

#### Scenario: More worktrees than the cap
- **WHEN** a repository has 15 linked worktrees
- **THEN** all 15 are listed, 12 of them with a status, and 3 marked as not inspected

#### Scenario: Status fails for one worktree
- **WHEN** the status command fails in one of three linked worktrees
- **THEN** that worktree is reported with an unknown status, the other two and the main checkout carry their status, and the repository is reported with `ok: true`

#### Scenario: Status times out
- **WHEN** the status command does not return within the command timeout for a worktree
- **THEN** that worktree is reported with an unknown status and the scan of the repository completes

#### Scenario: Failed scan keeps the previous values
- **WHEN** a repository was scanned successfully with two worktrees and its next scan fails
- **THEN** it is reported with `ok: false` and still lists those two worktrees with their last known status

#### Scenario: Non-git repository
- **WHEN** a tracked repository is not a git repository
- **THEN** it reports no checkouts and no work-in-progress summary

### Requirement: Repository work-in-progress summary
For every successfully scanned git repository the scanner SHALL report a work-in-progress summary consisting of: the number of linked worktrees; the number of checkouts, main checkout included, with uncommitted changes (modified plus untracked items greater than zero); the number of checkouts with an unpushed count greater than zero; the number of stale (prunable) worktrees; and the number of checkouts whose status is unknown. The summary SHALL be derived solely from the recorded checkouts, so that it never disagrees with them. It SHALL be omitted for a repository that is not a git repository, and SHALL be retained from the last successful scan when a repository's scan fails. A snapshot cached by a version that did not record the summary SHALL still load, with the summary absent.

#### Scenario: Mixed states
- **WHEN** a repository has a clean main checkout and three linked worktrees: one with uncommitted changes, one clean with 2 unpushed commits, one prunable
- **THEN** its summary is `worktrees: 3`, `uncommitted: 1`, `unpushed: 1`, `stale: 1`, `unknown: 0`

#### Scenario: Dirty main checkout without worktrees
- **WHEN** a repository has no linked worktrees and its main checkout has modified files
- **THEN** its summary is `worktrees: 0`, `uncommitted: 1`, `unpushed: 0`, `stale: 0`, `unknown: 0`

#### Scenario: One checkout with both
- **WHEN** a single worktree has uncommitted changes and unpushed commits
- **THEN** it counts once under `uncommitted` and once under `unpushed`

#### Scenario: Uninspected and unknown checkouts
- **WHEN** one worktree's status is unknown and another was not inspected because of the cap
- **THEN** `unknown` is `1`, and neither of them counts as uncommitted or unpushed

#### Scenario: Snapshot from an older version
- **WHEN** the cached snapshot was written by a version without working-tree status
- **THEN** it is served on startup without error and its repositories carry no summary until the first scan completes
