# Spec Delta

## Purpose

Gives an overview of the recently opened pull requests of all tracked repositories and of each one, with their review
and check status, read from GitHub through the user's own GitHub CLI and only when the user asks for it.

## ADDED Requirements

### Requirement: Pull requests are read through the GitHub CLI, read-only
The dashboard SHALL obtain pull requests by running the GitHub CLI (`gh`) without a shell, using only `gh pr list` with JSON output and `gh api user` to learn the signed-in login. A tracked repository SHALL be queried only when it is a git repository whose `origin` remote points to `github.com`, in any of its URL forms; the repository SHALL be addressed by its `owner/name` and the `gh` process SHALL run with its working directory outside every tracked repository, so that no tracked repository is read or written by it. `gh` SHALL run with prompts disabled, no standard input and a timeout after which it is stopped and reported as failed. The dashboard SHALL rely on `gh`'s own sign-in and MUST NOT read, store, request, log or forward credentials or tokens, and any text it passes to the browser SHALL have credentials embedded in URLs masked. The dashboard MUST NOT run any other `gh` subcommand and MUST NOT change anything on GitHub. Enabled repositories that share one GitHub repository SHALL cause one query, whose result applies to each of them.

#### Scenario: HTTPS and SSH remotes
- **WHEN** one tracked repository's `origin` is `https://github.com/acme/alpha-infra.git` and another's is `git@github.com:acme/beta-soc.git`
- **THEN** they are queried as `acme/alpha-infra` and `acme/beta-soc`

#### Scenario: Two clones of one project
- **WHEN** two enabled repositories both have `origin` `github.com/acme/alpha-infra`
- **THEN** `acme/alpha-infra` is queried once and both repositories show its pull requests

#### Scenario: Remote needs a login gh does not have
- **WHEN** `gh` would ask for authentication
- **THEN** nothing prompts, the query fails within the timeout or at once, and the reason is reported

### Requirement: GitHub is contacted only when the user asks
The pull-request query SHALL run only when the user activates a **Refresh** control on the Pull requests view or in a repository's pull-request dialog, or when the user opens one of those two and the shown repositories' cached lists are older than five minutes or were never fetched. It MUST NOT run on a timer, during or after a scan, on page load of any other view, on the projects overview, or as a side effect of another operation. While a refresh runs, the control SHALL show that it is running and SHALL NOT start a second one.

#### Scenario: Opening the view with a stale cache
- **WHEN** the user opens `/pull-requests` and the last fetch was 20 minutes ago
- **THEN** the cached lists are shown at once, marked with their age, and a refresh runs and replaces them when it completes

#### Scenario: Opening the view with a fresh cache
- **WHEN** the user opens `/pull-requests` two minutes after the last fetch
- **THEN** the cached lists are shown and GitHub is not contacted

#### Scenario: Explicit refresh
- **WHEN** the user activates Refresh one minute after the last fetch
- **THEN** GitHub is queried regardless of the cache's age

#### Scenario: Overview and scans stay offline
- **WHEN** the dashboard runs for an hour with the projects overview open and scans on its poll interval
- **THEN** no `gh` process is started

### Requirement: What a pull-request list contains
For each queried GitHub repository the list SHALL contain every open pull request, drafts included, and every pull request merged or closed within the last 7 days, up to 100 open and 50 recently closed ones; when a limit is reached the list SHALL say it is truncated. Each pull request SHALL carry its number, title, URL, author login, head and base branch, whether it is a draft, its state (`open`, `merged` or `closed`), when it was opened and, when applicable, merged or closed, its review decision (approved, changes requested, review required, or none), whether review is requested from the signed-in user, and a summary of its checks (passing, failing, pending, or none).

#### Scenario: Merged last week and last month
- **WHEN** a repository has a pull request merged 3 days ago and one merged 30 days ago
- **THEN** the first is listed as merged and the second is not listed

#### Scenario: Check summary
- **WHEN** an open pull request has one failing and three passing checks
- **THEN** its checks summary is failing

#### Scenario: Truncated
- **WHEN** a repository has 140 open pull requests
- **THEN** 100 are listed and the list says it is truncated

### Requirement: Unavailable and failed repositories are reported, not hidden
A repository that cannot be queried SHALL be reported as unavailable with a reason, without an error being raised: a repository that is not a git repository or has no `origin` on `github.com` ("not on GitHub"), a machine without `gh` ("GitHub CLI not installed"), and `gh` not signed in to `github.com` (the reason SHALL name `gh auth login`). A query that fails for another reason, including a timeout, SHALL be reported as failed with the reason, and the repository's previously fetched list SHALL remain shown, marked with its age. The failure of one repository SHALL NOT affect the others.

#### Scenario: gh missing
- **WHEN** the user refreshes pull requests on a machine without `gh`
- **THEN** every GitHub repository is shown as unavailable with "GitHub CLI not installed" and nothing else fails

#### Scenario: Repository on another host
- **WHEN** a tracked repository's `origin` is on `gitlab.example.test`
- **THEN** it is shown as not on GitHub and no `gh` process is started for it

#### Scenario: Failure keeps the last list
- **WHEN** a refresh of `acme/alpha-infra` times out after an earlier refresh listed 4 pull requests
- **THEN** the 4 pull requests remain shown with their age and the failure reason is available

### Requirement: Fetched lists are cached and are never an input
The last successful list per GitHub repository and its fetch time SHALL be kept in memory and in the dashboard home (`~/.openspec-dashboard/`), so that they are shown after a restart without contacting GitHub. The cache SHALL only be displayed: it MUST NOT be an input to scanning, columns, counts of changes, the activity log or any action, and deleting it SHALL lose nothing but the cached lists. Lists of repositories that are no longer enabled SHALL not be shown.

#### Scenario: After a restart
- **WHEN** the dashboard is restarted and the projects overview is opened
- **THEN** the open pull-request counts of the last fetch are shown with no `gh` process started

#### Scenario: Cache deleted
- **WHEN** the cache file is deleted and the dashboard restarted
- **THEN** repositories show that pull requests were not fetched yet, and everything else is unchanged

### Requirement: Pull requests view in the top navigation
The top navigation SHALL offer **Pull requests** after *Activity*, opening a view at `/pull-requests` that lists the pull requests of all enabled repositories. Open pull requests SHALL be listed first, newest opened first, followed by a "Recently merged or closed" group, newest merged or closed first. Each entry SHALL show the repository name with the repository's colour, `#<number>`, the title as a link to the pull request on GitHub that opens in a new browser tab, the author, the head branch in monospace, the relative age since it was opened (or merged or closed), and its state, review decision and checks summary, each conveyed with text or a symbol plus a tooltip and never by colour alone. Entries where review is requested from the signed-in user SHALL be marked. The view SHALL show when the lists were last fetched and a Refresh control, and SHALL list unavailable and failed repositories with their reasons in a collapsed notice rather than as entries. When `gh` is missing or not signed in the view SHALL say so once and explain how to set it up. The view MUST work in every supported theme and MUST NOT make the browser request any host but the dashboard's own API.

#### Scenario: Reading the list
- **WHEN** `alpha-infra` has an open draft opened 2 hours ago and `beta-soc` has an approved open pull request with passing checks opened yesterday, and a pull request of `beta-soc` was merged today
- **THEN** the view lists the draft first, then the approved one, then under "Recently merged or closed" the merged one, each with repository, number, title, author, branch, age and status

#### Scenario: Review requested from me
- **WHEN** review of `beta-soc#42` is requested from the signed-in user
- **THEN** its entry carries a "review requested from you" marker

#### Scenario: Nothing to show
- **WHEN** no enabled repository has an open or recently closed pull request
- **THEN** the view says there are no recent pull requests and when that was last checked

#### Scenario: gh not signed in
- **WHEN** `gh` is installed but not signed in
- **THEN** the view explains once that `gh auth login` is needed, and lists no repository as failed

### Requirement: The Pull requests view can be filtered
The view SHALL offer a repository filter, a state filter (open, recently merged or closed, all; default open and recently closed both shown), and a "review requested from me" filter. The filters SHALL combine, apply instantly on the client without contacting GitHub, and persist in the URL query string with default values omitted. With the repository filter set, the view SHALL show only that repository's pull requests and its unavailable or failed state, if any.

#### Scenario: One project
- **WHEN** the user opens `/pull-requests?repo=<id of beta-soc>`
- **THEN** only `beta-soc`'s pull requests are listed and the repository filter shows `beta-soc`

#### Scenario: What needs my review
- **WHEN** the user enables "review requested from me"
- **THEN** only open pull requests whose review is requested from the signed-in user are listed, and the URL contains the filter
