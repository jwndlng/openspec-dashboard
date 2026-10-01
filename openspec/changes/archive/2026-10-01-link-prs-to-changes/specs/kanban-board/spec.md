# Spec Delta

## ADDED Requirements

### Requirement: Cards link to their change's pull request
When a change has a linked pull request (`pull-requests`: "A pull request is linked to a change by its head branch"), its card SHALL show `PR #<number>` on the status line that carries the session status and the console quick link, as a link that opens that pull request on GitHub in a new browser tab. It SHALL convey the pull request's state — draft, open, merged or closed — as text or a symbol with a tooltip, and never by colour alone. Its accessible name SHALL name the repository's pull request, its number and its state.

A card whose change has no linked pull request SHALL show nothing in its place and SHALL NOT reserve space for it, so a board with no pull requests renders exactly as it does without this requirement. A merged or closed pull request SHALL still be shown, more quietly than an open one. Nothing SHALL be shown for an archived change, or when pull requests are unavailable for the repository — the Pull requests view reports the reason, and repeating it per card would be noise.

The link MUST NOT change the card's column, progress bar, counts, warnings or footer, MUST NOT become a board filter or a column count, and MUST NOT be the only way to reach the pull request: the change's detail header carries it in full.

#### Scenario: Card with an open pull request
- **WHEN** a card's change has an open pull request `#125`
- **THEN** the card shows `PR #125` on its status line as a link to that pull request, opening in a new tab, with its state given as text or a symbol

#### Scenario: Card without a pull request
- **WHEN** a card's change has no linked pull request
- **THEN** the card shows no pull-request link and no space is left for one

#### Scenario: Merged pull request
- **WHEN** a card's change has a merged pull request
- **THEN** the card still shows it, marked as merged, more quietly than an open one

#### Scenario: State is not conveyed by colour alone
- **WHEN** a screen reader reads a card with a draft pull request
- **THEN** it reads the pull request's number and that it is a draft

#### Scenario: Archived change
- **WHEN** an archived change's former branch still has a cached pull request
- **THEN** its card in `Archived` shows no pull-request link

#### Scenario: Pull requests unavailable
- **WHEN** `gh` is not installed
- **THEN** no card shows a pull-request link and no card shows an error for it

#### Scenario: The link is not a filter
- **WHEN** the user clears filters on a board whose cards show pull requests
- **THEN** the same cards are shown and the links are unaffected
