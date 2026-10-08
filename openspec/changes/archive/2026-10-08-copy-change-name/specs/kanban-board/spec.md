# Spec Delta

## ADDED Requirements

### Requirement: Cards copy the change's reference
In addition to what "Cards show only what an overview needs" lists, a card SHALL offer, directly after the change name, the same copy control as the detail header (change-detail: "The detail header copies the change's reference"): activating it SHALL write `<repository name>/<change name>` (e.g. `demo-ops/cloud-deployment`) to the clipboard and briefly confirm it, with a tooltip and accessible name naming the reference it copies. The card SHALL still not show the repository name as text; the reference merely includes it. The control SHALL stay quiet — not drawn — until the card is hovered or the control has keyboard focus, and it SHALL remain reachable with the keyboard. It SHALL NOT open the detail view, start a session or otherwise act on the card, and it SHALL NOT shorten the name, push the console quick link out of its slot or change where the name wraps beyond the width of the icon itself. It is offered on every card, archived ones included.

#### Scenario: Copying from a card
- **WHEN** the user hovers the card `cloud-deployment` in the `demo-ops` group and activates the copy icon next to its name
- **THEN** the clipboard holds exactly `demo-ops/cloud-deployment`, the icon briefly shows that it was copied, and the board stays as it was

#### Scenario: Quiet at rest
- **WHEN** a card is shown and neither hovered nor holding focus
- **THEN** no copy icon is drawn next to its name, and the card's name and age look exactly as before

#### Scenario: Reachable by keyboard
- **WHEN** the user tabs through a card
- **THEN** the copy icon receives focus, becomes visible, and is announced as `Copy demo-ops/cloud-deployment`
