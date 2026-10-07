## MODIFIED Requirements

### Requirement: The report checks the tools, identity, credentials and home directory
The report SHALL contain these checks and no others:
- **git** (`git`): whether a `git` executable is found on the PATH, and where.
- **Git committer identity** (`git-identity`): whether `user.name` and `user.email` are configured for this user, read
  with `git config --get`; the check SHALL name whichever of the two is missing.
- **OpenSpec CLI** (`openspec-cli`): whether an `openspec` executable is found on the PATH, and where.
- **One check per configured agent** (`agent:<agent id>`): whether the first element of that agent's command is found on
  the PATH, and where. The check SHALL say which agent it is and whether that agent is the default one.
- **GitHub CLI** (`github-cli`): whether a `gh` executable is found on the PATH and whether credentials for it are
  configured on this machine — either `GH_TOKEN` or `GITHUB_TOKEN` is set in the environment, or `gh`'s own host
  configuration file exists and is not empty, which SHALL be established without reading its contents. The check SHALL
  distinguish "not installed" from "no credentials found", and SHALL say that it looked for credentials rather than
  claim there are none.
- **Dashboard home** (`dashboard-home`): whether the dashboard's home directory exists or can be created and whether a
  file can be written in it. While the home migration of the `dashboard-api` capability has steps left to retry, could
  not move the former home `~/.openspec-dashboard/`, or found it left as a directory next to `~/.spec-control/`, a
  writable home SHALL be reported as `warning`, naming what is left and why, with a remedy; otherwise it SHALL say
  nothing about the former home.

#### Scenario: git is found
- **WHEN** `git` is on the PATH
- **THEN** the `git` check is `ok` and states the path it was found at

#### Scenario: Only the email is configured
- **WHEN** `user.email` is configured for this user but `user.name` is not
- **THEN** the `git-identity` check is not `ok` and says that `user.name` is the one that is missing

#### Scenario: One check per agent
- **WHEN** the user has configured three agent profiles
- **THEN** the report has three checks with the identifiers `agent:<id>` of those three profiles, and the one for the default agent says so

#### Scenario: gh installed without credentials
- **WHEN** `gh` is on the PATH, neither `GH_TOKEN` nor `GITHUB_TOKEN` is set and `gh` has no host configuration file
- **THEN** the `github-cli` check is not `ok`, says that `gh` is installed but no credentials were found, and its remedy names `gh auth login`

#### Scenario: The host file is not read
- **WHEN** `gh`'s host configuration file exists and holds a token
- **THEN** the `github-cli` check reads as configured and the file's contents were never read

#### Scenario: gh not installed
- **WHEN** no `gh` executable is on the PATH
- **THEN** the `github-cli` check says that `gh` was not found, not that credentials are missing

#### Scenario: Home directory not writable
- **WHEN** the dashboard's home directory cannot be written to
- **THEN** the `dashboard-home` check is `problem` and names the directory

#### Scenario: A migration step is still pending
- **WHEN** the home was moved but one session worktree could not be re-registered because its repository was missing
- **THEN** the `dashboard-home` check is `warning`, names that worktree and the reason, and says the dashboard retries on the next start

#### Scenario: Former home left next to the new one
- **WHEN** `~/.openspec-dashboard/` and `~/.spec-control/` both exist as directories
- **THEN** the `dashboard-home` check is `warning`, names `~/.openspec-dashboard/` as no longer used, and the dashboard uses `~/.spec-control/`
