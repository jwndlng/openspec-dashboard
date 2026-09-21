## ADDED Requirements

### Requirement: A main checkout that is off its default branch is flagged
When a repository reports that its main checkout is not on its default branch, the projects overview row and the repository board header SHALL show a notice naming the checked-out branch (or that HEAD is detached) and the default branch, and stating that archived changes, specs and progress shown for the repository come from that branch and may be outdated, and that changes living in worktrees are read from their own checkouts and are not affected. The notice SHALL be conveyed with text and not colour alone, SHALL NOT hide or alter any data, and SHALL NOT be shown when the repository is on its default branch or when its default branch is unknown.

#### Scenario: Feature branch in the main checkout
- **WHEN** repository `harbor-web` reports `defaultBranch: "main"` and its main checkout is on `feat/redesign-settings-page`
- **THEN** its overview row shows a notice that it is on `feat/redesign-settings-page`, not `main`, and its board header explains that archived changes, specs and progress may be outdated

#### Scenario: On the default branch
- **WHEN** a repository is on its default branch
- **THEN** no such notice is shown

#### Scenario: Unknown default branch
- **WHEN** a repository reports no default branch
- **THEN** no such notice is shown

#### Scenario: Data is still shown
- **WHEN** the notice is shown for a repository
- **THEN** its changes, counts and last-updated time are displayed exactly as they would be without the notice
