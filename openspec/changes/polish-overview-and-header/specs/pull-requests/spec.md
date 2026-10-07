# Spec Delta

## MODIFIED Requirements

### Requirement: Pull requests view in the top navigation
The top navigation SHALL offer **Pull requests** after *Activity*, opening a view at `/pull-requests` that lists the pull requests of all enabled repositories. Open pull requests SHALL be listed first, newest opened first, followed by a "Recently merged or closed" group, newest merged or closed first. Each entry SHALL show the repository name with the repository's colour, `#<number>`, the title as a link to the pull request on GitHub that opens in a new browser tab, the author, the head branch in monospace, the relative age since it was opened (or merged or closed), and its state, review decision and checks summary, each conveyed with text or a symbol plus a tooltip and never by colour alone. Entries where review is requested from the signed-in user SHALL be marked. The view SHALL show when the lists were last fetched and a Refresh control, and SHALL list unavailable and failed repositories with their reasons in collapsed notices rather than as entries. A repository that is unavailable because it is not on GitHub or not a git repository is not a failure: it SHALL be summarised as information, as `<n> repository isn't on GitHub` or `<n> repositories aren't on GitHub`, and SHALL NOT be counted as a repository that could not be listed. A repository whose query failed SHALL be summarised as `<n> repository could not be listed` or `<n> repositories could not be listed`, marked as a warning. When both kinds occur, both summaries SHALL be shown, each listing only its own repositories with their reasons. When `gh` is missing or not signed in the view SHALL say so once and explain how to set it up. The view MUST work in every supported theme and MUST NOT make the browser request any host but the dashboard's own API.

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

#### Scenario: Repository not on GitHub
- **WHEN** `quill-docs` has an `origin` that is not on GitHub and every other repository was listed
- **THEN** the view shows a collapsed note `1 repository isn't on GitHub` naming `quill-docs` with "not on GitHub", and
  does not say that any repository could not be listed

#### Scenario: Not on GitHub and failed together
- **WHEN** `plain-notes` is not a git repository and the query for `alpha-infra` timed out
- **THEN** the view shows `1 repository isn't on GitHub` listing `plain-notes` with "not a git repository", and, marked
  as a warning, `1 repository could not be listed` listing `alpha-infra` with "gh timed out"
