## ADDED Requirements

### Requirement: Cards open the change detail view

Every card on the combined board and on a repository board SHALL be a link to its change's detail view (`change-detail`), including cards in the `Archived` column. The link SHALL be a real anchor with an `href`, so it can be opened in a new tab, copied and focused with the keyboard, and it SHALL carry the board the card was clicked on together with its active filters, so the detail view can return to it.

Activating a control inside a card — the copy action and any session starter — MUST NOT navigate to the detail view. The card's content, layout, grouping, colouring and counts SHALL be unchanged by being a link.

#### Scenario: Click a card

- **WHEN** the user clicks a card for change `cloud-deployment` of repository `demo-ops`
- **THEN** the detail view for that change is shown

#### Scenario: Open in a new tab

- **WHEN** the user ⌘-clicks or middle-clicks a card
- **THEN** the detail view opens in a new tab and the board in the current tab is unchanged

#### Scenario: Copy action does not navigate

- **WHEN** the user clicks "Copy apply command" on a card
- **THEN** the command is copied and the board stays on screen

#### Scenario: Archived cards link too

- **WHEN** the user clicks a card in the `Archived` column
- **THEN** the detail view for that archived change is shown

#### Scenario: Keyboard

- **WHEN** the user tabs to a card and presses Enter
- **THEN** the detail view for that change is shown
