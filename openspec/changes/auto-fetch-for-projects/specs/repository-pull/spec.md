# Spec Delta

## ADDED Requirements

### Requirement: A project can be fetched automatically, fetch only
A project SHALL be able to opt in to **auto fetch** with an interval of 5, 15, 30 or 60 minutes, set per project on the projects overview; without that setting a project SHALL NOT be fetched except by the pull action. While a project has auto fetch on, the dashboard SHALL fetch it once at that interval for as long as the dashboard runs, starting one interval after the dashboard started or after the setting was switched on or changed. An automatic fetch SHALL be exactly the fetch step of the pull action — from the remote of the checked-out branch's upstream, or from `origin` when the branch has no upstream but that remote exists, without submodules, without automatic repository maintenance, under the same credential, prompt, timeout and masking rules — and nothing else: it MUST NOT fast-forward, merge, rebase, reset, stash, prune, switch a branch, resolve change leftovers or run hooks, and MUST NOT change the main checkout's branch, index or working tree or any linked worktree. It writes only what a fetch writes: remote-tracking refs, `FETCH_HEAD` and objects.

An automatic fetch SHALL be skipped, without running git, for a project that is disabled, is not a git repository, has no remote, whose last scan failed, or that is no longer configured; and the dashboard SHALL NOT fetch automatically at all in the demo. Projects SHALL be fetched with bounded concurrency, so that many projects falling due at once do not all fetch at the same moment. A failed automatic fetch SHALL be retried only at the next interval, never sooner.

When an automatic fetch moved any remote-tracking ref, the project SHALL be rescanned and the work statuses of its worktrees SHALL be recomputed rather than served from a cache, so that a branch whose pull request merged shows `merged`, and the conflict signal is computed against the new base, without a page reload. When it moved nothing, no rescan SHALL be started for it. The outcome of the most recent automatic fetch of each project — when it ran, whether it succeeded, and the masked reason when it failed — SHALL be kept in memory only and reported with the project's scan result; it is never an input to columns, counts, statuses or actions.

#### Scenario: Off by default
- **WHEN** a project has no auto-fetch setting and the dashboard runs for two hours
- **THEN** no fetch of that project is run

#### Scenario: Fetching every 15 minutes
- **WHEN** a project has auto fetch every 15 minutes and the dashboard runs for 46 minutes
- **THEN** its remote has been fetched three times, and its main checkout's branch, index and working tree are byte-for-byte as they were

#### Scenario: Behind but never fast-forwarded
- **WHEN** a project with auto fetch on is on its default branch, clean, and its remote gains two commits
- **THEN** after the next automatic fetch its upstream ref has moved, its branch still points at the old commit, and its working tree is unchanged

#### Scenario: A merged branch is detected
- **WHEN** a session's branch was squash-merged on the remote and the project's next automatic fetch brings the new default branch in
- **THEN** the project is rescanned and that worktree's work status reads `merged` without the user pulling or reloading

#### Scenario: Nothing new
- **WHEN** an automatic fetch moves no remote-tracking ref
- **THEN** no rescan is started because of it

#### Scenario: Remote unreachable
- **WHEN** an automatic fetch fails because the remote cannot be reached
- **THEN** nothing in the repository's working tree changed, the failure and its masked reason are reported with the project, and the next attempt is one interval later

#### Scenario: Changing the interval
- **WHEN** a project fetched every 60 minutes is switched to every 5 minutes
- **THEN** its next automatic fetch is 5 minutes after the change, and then every 5 minutes

#### Scenario: Switched off
- **WHEN** a project's auto fetch is switched off while its next fetch is pending
- **THEN** that fetch does not run, and none follows

#### Scenario: Disabled project
- **WHEN** a project with auto fetch on is disabled on the overview
- **THEN** it is not fetched while it is disabled, and its setting is kept

#### Scenario: Demo
- **WHEN** the demo shows a project with auto fetch on
- **THEN** no fetch is run

### Requirement: An automatic fetch and a pull never overlap
At most one fetch of a project SHALL run at a time, whether it was started by a pull or automatically. When the user asks for a pull of a project whose automatic fetch is running, the pull SHALL wait for that fetch to finish and then run as usual, including its own fetch; it MUST NOT be refused because of the automatic fetch. When an automatic fetch falls due while a pull or Resolve and pull of the project is running, that automatic fetch SHALL be skipped and the next one SHALL be one interval later. A successful pull's fetch SHALL count as the project's most recent fetch, so a reported automatic-fetch failure no longer shows after it.

#### Scenario: Pull during an automatic fetch
- **WHEN** the user activates Pull on a project while its automatic fetch is running
- **THEN** the control shows that the pull is running, the pull starts once the automatic fetch has finished, and its outcome is reported as usual rather than as already running

#### Scenario: Automatic fetch during a pull
- **WHEN** an automatic fetch of a project falls due while the user's pull of that project is running
- **THEN** no second fetch is started, and the next automatic fetch is one interval later

#### Scenario: A pull clears a failure
- **WHEN** the last automatic fetch of a project failed and the user then pulls it successfully
- **THEN** the project no longer reports an automatic-fetch failure
