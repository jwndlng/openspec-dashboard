# Spec Delta

## MODIFIED Requirements

### Requirement: Pull requests are read through the GitHub CLI, read-only
The dashboard SHALL obtain pull requests by running the GitHub CLI (`gh`) without a shell, using only `gh pr list` with JSON output and `gh api user` to learn the signed-in login. A tracked repository SHALL be queried only when it is a git repository whose `origin` remote points to `github.com`, in any of its URL forms; the repository SHALL be addressed by its `owner/name` and the `gh` process SHALL run with its working directory outside every tracked repository, so that no tracked repository is read or written by it. `gh` SHALL run with prompts disabled, no standard input and a timeout after which it is stopped and reported as failed. The dashboard SHALL rely on `gh`'s own sign-in and MUST NOT read, store, request, log or forward credentials or tokens, and any text it passes to the browser SHALL have credentials embedded in URLs masked. The dashboard MUST NOT run any other `gh` subcommand, except `gh issue list` as the `issue-import` capability specifies, and MUST NOT change anything on GitHub. Enabled repositories that share one GitHub repository SHALL cause one query, whose result applies to each of them.

#### Scenario: HTTPS and SSH remotes
- **WHEN** one tracked repository's `origin` is `https://github.com/acme/alpha-infra.git` and another's is `git@github.com:acme/beta-soc.git`
- **THEN** they are queried as `acme/alpha-infra` and `acme/beta-soc`

#### Scenario: Two clones of one project
- **WHEN** two enabled repositories both have `origin` `github.com/acme/alpha-infra`
- **THEN** `acme/alpha-infra` is queried once and both repositories show its pull requests

#### Scenario: Remote needs a login gh does not have
- **WHEN** `gh` would ask for authentication
- **THEN** nothing prompts, the query fails within the timeout or at once, and the reason is reported

#### Scenario: Refreshing pull requests lists no issues
- **WHEN** the user refreshes pull requests
- **THEN** only `gh pr list` and `gh api user` processes are started, and no `gh issue list`
