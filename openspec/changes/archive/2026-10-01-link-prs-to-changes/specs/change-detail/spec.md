# Spec Delta

## ADDED Requirements

### Requirement: The detail header shows the change's pull request
When a change has a linked pull request (`pull-requests`: "A pull request is linked to a change by its head branch"), the detail header SHALL show it beside the branch the match was made on: `#<number>`, the title as a link opening the pull request on GitHub in a new browser tab, its state (draft, open, merged or closed), its review decision and its checks summary. Each SHALL be conveyed as text or a symbol with a tooltip and never by colour alone, using the same symbols the Pull requests view uses so that the two read alike.

When the change has no linked pull request the header SHALL show the branch as it does today and nothing in place of the pull request. When pull requests are unavailable for the repository the header SHALL say so once, quietly, with the reason the `pull-requests` capability gives — the detail view is where a user who wonders why a card shows no pull request will look.

The header MUST NOT offer any action on the pull request: the dashboard stays read-only towards GitHub.

#### Scenario: Header with a pull request
- **WHEN** the detail view is open for a change whose branch `feat/add-validate-phase` has open pull request `#125`, approved, with passing checks
- **THEN** the header shows `#125` with its title as a link, that it is open, that it is approved and that its checks pass, beside the branch

#### Scenario: Header without a pull request
- **WHEN** the change's branch has no cached pull request
- **THEN** the header shows the branch and nothing in place of a pull request

#### Scenario: Unavailable is explained here
- **WHEN** `gh` is not signed in and the detail view is open
- **THEN** the header says once that pull requests are unavailable, with the reason

#### Scenario: No actions
- **WHEN** the header shows a pull request awaiting review
- **THEN** it offers no way to approve, merge, comment on or close it

#### Scenario: Checks and review are not colour alone
- **WHEN** a screen reader reads the header of a change whose pull request has failing checks
- **THEN** it reads that the checks are failing
