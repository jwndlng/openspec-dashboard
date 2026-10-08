# Spec Delta

## ADDED Requirements

### Requirement: Cards offer Fast-forward
When a card offers its change's starters and **Fast-forward** is available for the change (agent-sessions: "Fast-forward
drafts, implements and ships in one session"), the card SHALL offer it right after **Draft artifacts** as a small control
whose visible text is `FF`, whose accessible name and tooltip say `Fast-forward` and what it does — write the artifacts,
implement and open a pull request — together with the agent's name, and which is disabled with the same explanation as
the other starters when the agent's executable is not found. It SHALL follow every rule the other starters follow: it is
hidden while a session of the change runs, offered again beside a failed session's badge, reports a refused or failed
start on the card, and leaves the user on the board. Activating it SHALL first ask for confirmation as that capability
requires; while the dialog is open the card's starters SHALL be disabled. The same control SHALL be offered in a change's
Console tab wherever **Draft artifacts** is offered there.

#### Scenario: Backlog card offers FF
- **WHEN** a change in `Backlog` is not blocked, agent sessions are enabled and the repository's agent has Draft and Implement prompts
- **THEN** its footer offers **Draft artifacts** followed by `FF`, whose accessible name starts with `Fast-forward`

#### Scenario: FF stays on the board
- **WHEN** the user activates `FF` on a card and confirms
- **THEN** the session starts, the card shows its badge in place of its starters and the board stays open

#### Scenario: No FF on a planned card
- **WHEN** a change is in `Ready`
- **THEN** its card offers **Implement** and no `FF`
