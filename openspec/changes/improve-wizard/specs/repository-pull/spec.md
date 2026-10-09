# Spec Delta

## MODIFIED Requirements

### Requirement: Projects are fetched automatically unless switched off, fetch only
Every project SHALL have **auto fetch**, set per project on the projects overview, with an interval of 15 or 30 seconds, 1, 5, 10, 15 or 30 minutes or one hour, or switched **off**. A project without a saved setting SHALL be fetched **every minute**; only a project whose auto fetch the user switched off SHALL NOT be fetched except by the pull action. While a project's auto fetch is not off, the dashboard SHALL fetch it once at that interval for as long as the dashboard runs, starting one interval after the dashboard started, after the setting was switched on or changed, or after setup ended. While setup is pending (`setup: "pending"`, the setup wizard of a fresh installation not finished or skipped yet), no project SHALL be fetched automatically, so that a project tracked in the wizard is not fetched before the user could choose its auto fetch; a fetch that falls due while setup is pending SHALL be skipped without running git, and once setup is marked done every project SHALL be fetched under its own setting, one interval later. An automatic fetch SHALL be exactly the fetch step of the pull action — from the remote of the checked-out branch's upstream, or from `origin` when the branch has no upstream but that remote exists, without submodules, without automatic repository maintenance, under the same credential, prompt, timeout and masking rules — and nothing else: it MUST NOT fast-forward, merge, rebase, reset, stash, prune, switch a branch, resolve change leftovers or run hooks, and MUST NOT change the main checkout's branch, index or working tree or any linked worktree. It writes only what a fetch writes: remote-tracking refs, `FETCH_HEAD` and objects.

An automatic fetch SHALL be skipped, without running git, for a project that is disabled, is not a git repository, has no remote, whose last scan failed, or that is no longer configured; and the dashboard SHALL NOT fetch automatically at all in the demo. Projects SHALL be fetched with bounded concurrency, so that many projects falling due at once do not all fetch at the same moment. A failed automatic fetch SHALL be retried only at the next interval, never sooner. An automatic fetch of a project SHALL NOT be started while the previous automatic fetch of that project is still running or waiting to run, however short the interval; that one is skipped and the next attempt is one interval later.

When an automatic fetch moved any remote-tracking ref, the project SHALL be rescanned and the work statuses of its worktrees SHALL be recomputed rather than served from a cache, so that a branch whose pull request merged shows `merged`, and the conflict signal is computed against the new base, without a page reload. When it moved nothing, no rescan SHALL be started for it. The outcome of the most recent automatic fetch of each project — when it ran, whether it succeeded, and the masked reason when it failed — SHALL be kept in memory only and reported with the project's scan result; it is never an input to columns, counts, statuses or actions.

#### Scenario: On by default
- **WHEN** an enabled git project with a remote has no auto-fetch setting and the dashboard runs for three and a half minutes
- **THEN** its remote has been fetched three times, and its main checkout's branch, index and working tree are byte-for-byte as they were

#### Scenario: Switched off
- **WHEN** a project's auto fetch is switched off and the dashboard runs for two hours
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
- **WHEN** a project fetched every hour is switched to every 15 seconds
- **THEN** its next automatic fetch is 15 seconds after the change, and then every 15 seconds

#### Scenario: A slow fetch is not doubled
- **WHEN** a project fetched every 15 seconds has an automatic fetch that takes 40 seconds
- **THEN** no second fetch of that project starts while it runs, and the next one starts at the first interval after it finished

#### Scenario: Switched off while pending
- **WHEN** a project's auto fetch is switched off while its next fetch is pending
- **THEN** that fetch does not run, and none follows

#### Scenario: Disabled project
- **WHEN** a project with auto fetch on is disabled on the overview
- **THEN** it is not fetched while it is disabled, and its setting is kept

#### Scenario: Demo
- **WHEN** the demo shows a project with auto fetch on
- **THEN** no fetch is run

#### Scenario: Not while setup is pending
- **WHEN** a fresh installation's setup wizard tracked `alpha-infra`, an enabled git project with a remote and no auto-fetch setting, and the user stays in the wizard for five minutes
- **THEN** no fetch of `alpha-infra` is run

#### Scenario: Fetching starts once setup is done
- **WHEN** the user then finishes or skips setup
- **THEN** `alpha-infra` is fetched one minute later, and every minute after that
