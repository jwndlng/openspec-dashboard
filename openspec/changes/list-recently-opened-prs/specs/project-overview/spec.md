# Spec Delta

## ADDED Requirements

### Requirement: Overview shows open pull requests per repository
The projects overview SHALL show, for each repository, the number of open pull requests from the cached pull-request list of the `pull-requests` capability: as a column in the table layout and as a labelled figure on each tile. The figure SHALL link to `/pull-requests?repo=<id>` without opening the repository's board, and its tooltip SHALL say how many of them await review from the signed-in user and when the list was fetched. A repository whose list was never fetched, is unavailable or failed without an earlier list SHALL show a neutral placeholder whose tooltip gives the reason. The overview MUST NOT contact GitHub, neither on load nor on any interaction other than following the link.

#### Scenario: Counts from the cache
- **WHEN** the cached list of `alpha-infra` has 3 open pull requests, one awaiting the user's review, fetched 1 hour ago
- **THEN** its row shows `3`, and the tooltip says one awaits the user's review and that the list is 1 hour old

#### Scenario: Never fetched
- **WHEN** pull requests were never fetched
- **THEN** every row shows the placeholder, whose tooltip says the list has not been fetched yet, and no `gh` process is started

#### Scenario: Following the count
- **WHEN** the user activates the count of `beta-soc`
- **THEN** the Pull requests view opens filtered to `beta-soc`

### Requirement: Repository board lists the repository's pull requests
The repository board header SHALL offer a **pull requests** control reading `<n> open PRs` from the cached list, or a neutral text when there is no list, that opens a dialog with that repository's pull requests laid out as in the Pull requests view, its fetch time, its unavailable or failed reason when there is one, a Refresh control, and a link to `/pull-requests?repo=<id>`. Opening the dialog SHALL refresh the repository's list when it is older than five minutes or was never fetched, under the rules of the `pull-requests` capability; the board itself MUST NOT contact GitHub. The control SHALL NOT be offered for a repository that is not a git repository.

#### Scenario: Opening the dialog
- **WHEN** the user activates `2 open PRs` on the board of `alpha-infra`, whose list is 10 minutes old
- **THEN** the dialog shows the 2 cached pull requests at once, refreshes the list, and shows the result

#### Scenario: Not on GitHub
- **WHEN** the repository's `origin` is not on `github.com`
- **THEN** the dialog says the repository is not on GitHub and no `gh` process is started

#### Scenario: Non-git repository
- **WHEN** the tracked repository is not a git repository
- **THEN** its board header offers no pull requests control
