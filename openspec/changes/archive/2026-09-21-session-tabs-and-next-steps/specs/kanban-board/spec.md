## ADDED Requirements

### Requirement: Cards keep offering the next step while a session runs
A card whose change has a running session SHALL show the session badge and, next to it, the starters available in the change's current stage. For Draft and Implement with a running session in the change's own worktree, the starter SHALL send its prompt to that session and open the panel with the terminal focused; its label and tooltip MUST say that it types into the running session and that Enter sends it. Archive SHALL open its own session as before. The panel header SHALL offer the same next-step buttons for the session shown.

#### Scenario: Draft finished
- **WHEN** a Draft session is still running and the change has moved to `Ready`
- **THEN** the card shows the running (or quiet) badge and an **Implement** button, and pressing it puts the Implement prompt into that session's terminal and opens the panel

#### Scenario: Nothing new to do
- **WHEN** an Implement session is running and the change is `Implementing`
- **THEN** the card offers Implement next to the badge and no other starter

### Requirement: Running sessions can be ended from the card
The badge of a running session SHALL carry a small close control with an accessible name. Activating it MUST NOT end the session directly but open the end-session dialog.

#### Scenario: Close control
- **WHEN** the user activates the close control on a running badge
- **THEN** the end-session dialog opens and the session keeps running until confirmed

### Requirement: The end-session dialog is graded by work status
Ending a session — from a card or from the panel — SHALL go through one dialog that reads the worktree's work status fresh and grades its warning: a plain confirmation for `clean`, `merged` or `missing`; a notice for `pushed` that the work is not merged as of the last fetch; and for `uncommitted` or `unpushed` a strong warning, as text plus colour, naming the number of files or commits that exist only in this worktree, with **Ship instead** offered and the confirming button labelled **End anyway**. The dialog MUST state that the worktree and branch are kept, and SHALL offer worktree removal only when that is safe. Cancelling MUST change nothing.

#### Scenario: Unshipped work
- **WHEN** the user ends a session whose worktree holds 3 uncommitted files
- **THEN** the dialog warns that 3 files exist only in this worktree, offers Ship instead, and ends the session only on **End anyway**

#### Scenario: Nothing unshipped
- **WHEN** the user ends a session whose worktree is `clean`
- **THEN** the dialog asks for a plain confirmation

### Requirement: The session panel has a tab per running session
The session panel SHALL show a tab strip with every running session across repositories — repository, change and its live badge — plus the session currently shown when it has ended. Selecting a tab SHALL show that session's terminal with its earlier output and update the URL; it MUST NOT end, restart or otherwise affect any session. Tabs SHALL be keyboard-operable and expose the selected one to assistive technology. With a single session the strip MAY be omitted.

#### Scenario: Switching
- **WHEN** two sessions are running and the user selects the other tab
- **THEN** the other session's terminal is shown including its earlier output, both sessions keep running, and reloading the page shows the same tab

#### Scenario: Session ends while shown
- **WHEN** the session shown ends
- **THEN** its tab stays until the user selects another or hides the panel
