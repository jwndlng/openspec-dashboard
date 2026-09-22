# Spec Delta

## MODIFIED Requirements

### Requirement: Cards keep offering the next step while a session runs
A card whose change has a running session SHALL show the session badge and, next to it, the starters available in the change's current stage. For Draft and Implement with a running session in the change's own worktree, the starter SHALL send its prompt to that session and open the panel with the terminal focused; its label and tooltip MUST say that it sends the prompt to the running session, and MUST NOT ask the user for a further key press. When the prompt was typed but not submitted, the panel SHALL say so as it does for any other text sent on the user's behalf. Archive SHALL open its own session as before. The panel header SHALL offer the same next-step buttons for the session shown.

#### Scenario: Draft finished
- **WHEN** a Draft session is still running and the change has moved to `Ready`
- **THEN** the card shows the running (or quiet) badge and an **Implement** button, and pressing it sends the Implement prompt to that session and opens the panel

#### Scenario: The prompt was not sent
- **WHEN** the next step is sent to a session whose agent never shows the typed prompt
- **THEN** the panel says that the text was typed but not sent, and the session keeps running

#### Scenario: Nothing new to do
- **WHEN** an Implement session is running and the change is `Implementing`
- **THEN** the card offers Implement next to the badge and no other starter
