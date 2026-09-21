# Spec Delta

## MODIFIED Requirements

### Requirement: Repository board header
The repository board SHALL show a header with a breadcrumb linking back to the overview, the repository name, its path in monospace, an action that copies `cd <path>` (shell-quoted) to the clipboard, the current branch when known, the number of worktrees, the relative age of the repository's last update, any repository warnings or scan error, and a **New change** action that opens the create-change form for that repository (as specified in the `change-creation` capability). The New change action SHALL be shown only when the repository is enabled and its last scan succeeded and it has an `openspec/` directory to create into; otherwise the action SHALL be absent. The dashboard MUST NOT execute the copied command.

#### Scenario: Header content
- **WHEN** repository `alpha-infra` at `/Users/x/Workspace/acme/alpha-infra` is on branch `main` with 3 worktrees and was last updated 1 day ago
- **THEN** the header shows `Projects / alpha-infra`, the path, `main`, `3 worktrees`, `updated 1d ago`, and a `New change` action

#### Scenario: Back to overview
- **WHEN** the user activates `Projects` in the breadcrumb
- **THEN** the overview at `/` is shown without a page reload

#### Scenario: Copy cd
- **WHEN** the user activates "Copy cd" for a repository at `/Users/x/My Repos/foo`
- **THEN** the clipboard contains `cd '/Users/x/My Repos/foo'`

#### Scenario: New change action opens the form
- **WHEN** the user activates the `New change` action on the header
- **THEN** the create-change form opens for that repository and nothing has been written yet

#### Scenario: New change hidden for a failed scan
- **WHEN** the repository's last scan failed
- **THEN** the header shows no `New change` action
