## ADDED Requirements

### Requirement: Cards offer session starters and show session state
When agent sessions are enabled and the card's repository is tracked and not excluded, a card SHALL offer the session starters available for its change (**Draft artifacts** while an artifact is not done, **Implement** in `Ready` or `Implementing`, **Archive** in `Done`; none for archived changes). A card whose change has an open session SHALL instead show a session badge — `working` while the session is running or queued, `waiting for you` while it awaits input, `failed` with the reason on hover — and activating the badge SHALL open the session panel. The existing copy actions remain available. When agent sessions are disabled or the repository is excluded, cards MUST look and behave exactly as before.

#### Scenario: Done change offers Archive
- **WHEN** a change is in `Done` and agent sessions are enabled
- **THEN** the card offers **Archive** next to its "complete" badge

#### Scenario: Ready change
- **WHEN** a change is in `Ready`, agent sessions are enabled and its repository is not excluded
- **THEN** the card offers **Implement** and still offers the copy action

#### Scenario: Session waiting for input
- **WHEN** a change has a session in state `waiting`
- **THEN** its card shows the badge `waiting for you` and no starter, and activating the badge opens the session panel

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no card shows a starter or a session badge

### Requirement: Session panel
The board SHALL provide a session panel, addressable in the URL so it survives reload, showing the change, repository, worktree path and branch, session state and accumulated cost/usage; the live transcript; an input box that sends on Enter and is disabled while no message can be accepted; and the actions Stop, Close (with the remove-worktree confirmation when removal is safe), Cancel, "Copy resume command" and "Copy cd" for the worktree. The panel MUST keep the board usable behind it and MUST follow new transcript events without a page reload.

#### Scenario: Deep link
- **WHEN** the user reloads the page while a session panel is open
- **THEN** the same session panel is shown again with its transcript

#### Scenario: Sending a message
- **WHEN** the session is `waiting` and the user types a message and presses Enter
- **THEN** the message appears in the transcript and the state changes to `working`
