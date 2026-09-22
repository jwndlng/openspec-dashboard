## ADDED Requirements

### Requirement: Cards offer session starters and show session state
When agent sessions are enabled and the card's repository is tracked and not excluded, a card SHALL offer the session starters available for its change — **Draft artifacts** while an artifact is not done, **Implement** in `Ready` or `Implementing`, **Archive** in `Done`, none for archived changes — limited to the starters the repository's agent has a prompt for, and disabled with an explanation when that agent's executable is not found. A card whose change has a running session SHALL instead show a badge — `running`, or `quiet <duration>` when the terminal has been silent for more than a minute — and a card whose latest session failed to start or ended with an error SHALL show that; activating the badge SHALL open the session panel. Status MUST be conveyed by text as well as colour. The existing copy actions remain available. When agent sessions are disabled or the repository is excluded, cards MUST look and behave exactly as before.

#### Scenario: Done change offers Archive
- **WHEN** a change is in `Done` and agent sessions are enabled
- **THEN** the card offers **Archive** next to its "complete" badge

#### Scenario: Ready change
- **WHEN** a change is in `Ready`, agent sessions are enabled and its repository is not excluded
- **THEN** the card offers **Implement** and still offers the copy action

#### Scenario: Running session
- **WHEN** a change has a running session
- **THEN** its card shows a session badge and no starter, and activating the badge opens the session panel

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no card shows a starter or a session badge

### Requirement: Session panel
The board SHALL provide a session panel, addressable in the URL so that it survives reload and working in both routing modes, showing the change, repository, agent, worktree path and branch and the session's state; the session's terminal, filling the panel, coloured from the dashboard's theme tokens and rendered without loading anything from the network; and the actions End session or Clean up (with the remove-worktree confirmation when removal is safe), Resume when available, Delete record for an ended session, and "Copy cd" for the worktree. Hiding the panel MUST NOT end the session, and the board MUST stay usable behind the panel.

#### Scenario: Deep link
- **WHEN** the user reloads the page while a session panel is open
- **THEN** the same session's terminal is shown again, including its earlier output

#### Scenario: Hiding the panel
- **WHEN** the user closes the panel while the agent is working
- **THEN** the agent keeps running and the card keeps showing the session badge
