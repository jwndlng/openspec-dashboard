## MODIFIED Requirements

### Requirement: Integration adds no write by the dashboard to a repository

Integration SHALL NOT make the dashboard write to a repository. The dashboard MUST NOT run `openspec init`, in process
or as a subprocess, MUST NOT create, edit or delete any file in the folder, and MUST NOT run a git command for the
integration session. Everything written in the folder is written by the user's agent under its own permission prompts.
Adding the repository to `~/.spec-control/config.json` and starting a scan are the only state the dashboard
changes, and both are outside the repository.

#### Scenario: The dashboard writes nothing
- **WHEN** an integration session is started, runs and ends
- **THEN** the dashboard itself has created, changed or deleted no file in the repository and has run no git command for the session

#### Scenario: No init subprocess
- **WHEN** **Integrate** is activated
- **THEN** the only process the dashboard starts is the configured agent
