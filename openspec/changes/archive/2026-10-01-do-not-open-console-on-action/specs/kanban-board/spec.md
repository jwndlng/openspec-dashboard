# Spec Delta

## ADDED Requirements

### Requirement: Starting a session from a card stays on the board
Activating a session starter on a card SHALL start the session and SHALL leave the user on the board they activated it
from: the dashboard MUST NOT navigate to the change's detail view, select its Console tab or otherwise move away from
the board because a session started. This SHALL hold for every starter a card offers. Once the session is known, the
card SHALL show its badge in place of its starters, as the "Cards offer session starters and show session state"
requirement gives it, and activating that badge or **Show details** SHALL open the detail view as before. A start that
is refused or fails SHALL still report its reason on the card it was activated from.

Starters offered inside a change's Console tab — the openings for a change no agent has worked on, and the next-step
starters that send a prompt to a running session — are not card starters: they SHALL keep showing the started or
prompted session in that same Console tab.

#### Scenario: Drafting from the board
- **WHEN** the user activates **Draft artifacts** on a card of change `audit-trail` on the `demo-ops` board
- **THEN** the session starts, the `demo-ops` board stays on screen, and the card shows the `working` badge where its
  starter was

#### Scenario: Several starts in a row
- **WHEN** the user activates **Draft artifacts** on the cards of `audit-trail` and then `upgrade-runtime`
- **THEN** both sessions start, the board stays on screen throughout, and each card shows its own session's badge

#### Scenario: Opening the started session
- **WHEN** a session was started from a card and the user then activates that card's badge
- **THEN** the change's detail view opens on its Console tab with that session's terminal shown

#### Scenario: A refused start
- **WHEN** a card's starter is activated and the start is refused
- **THEN** the board stays on screen and the card shows the reason beside its starters

#### Scenario: Starting from the Console tab
- **WHEN** the user activates **Implement** in the Console tab of a change no agent has worked on
- **THEN** the session starts and that same Console tab shows its terminal
