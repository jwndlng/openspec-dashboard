## MODIFIED Requirements

### Requirement: Session panel
The board SHALL show agent sessions in a dock at the bottom of the window that spans its full width, addressable in the URL so that it survives reload and working in both routing modes. For each session shown it SHALL present the change, repository, agent, worktree path and branch and the session's state; the session's terminal, coloured from the dashboard's theme tokens and rendered without loading anything from the network; and the actions End session or Clean up (with the remove-worktree confirmation when removal is safe), Resume when available, Delete record for an ended session, and "Copy cd" for the worktree. The page SHALL reserve the dock's height below its content so that no part of the board is hidden behind it. The dock's height SHALL be adjustable by dragging its top edge and by keyboard, within limits that keep both the board and a terminal usable, and SHALL be remembered in the browser; the dock SHALL offer maximising and collapsing to its tab strip. Hiding a session, collapsing the dock or closing it MUST NOT end any session, and the board MUST stay usable above the dock. When no session is shown and none is running there SHALL be no dock.

#### Scenario: Deep link
- **WHEN** the user reloads the page while a session panel is open
- **THEN** the same session's terminal is shown again, including its earlier output

#### Scenario: Hiding the panel
- **WHEN** the user closes the panel while the agent is working
- **THEN** the agent keeps running and the card keeps showing the session badge

#### Scenario: Nothing hidden behind the dock
- **WHEN** the dock is open and the user scrolls the board to its end
- **THEN** the last cards are fully visible above the dock

#### Scenario: Height is remembered
- **WHEN** the user drags the dock to a new height and reloads the page
- **THEN** the dock opens at that height

#### Scenario: Collapsed
- **WHEN** the user collapses the dock while two sessions run
- **THEN** only the tab strip remains at the bottom, both sessions keep running, and selecting a tab expands the dock with that session

## ADDED Requirements

### Requirement: The dock shows up to three sessions side by side
The dock SHALL show one, two or three sessions next to each other in panes of equal width, each with its own header, actions, terminal and default responses, and MUST NOT show more than three at once. The tab strip SHALL list every running session, however many, plus shown sessions that have ended, and SHALL mark, as text or shape as well as colour, which sessions are currently shown. Selecting a tab whose session is not shown SHALL open it in a new pane while fewer than three are shown, and otherwise replace the pane that last had the keyboard focus; selecting a tab whose session is shown SHALL move the keyboard focus to its terminal. Each pane SHALL have a control that removes it from the dock without ending its session; removing the last pane collapses the dock. Opening a session from a card, from Open work or by starting one follows the same rule as selecting its tab. The URL SHALL carry the shown sessions in pane order, and a URL naming a single session SHALL open one pane; sessions in the URL that do not exist are ignored, and no more than the first three are shown. Typing, default responses and next-step prompts MUST reach only the session of the pane they were used in.

#### Scenario: Three at once, more in tabs
- **WHEN** five sessions are running and three of them are shown
- **THEN** three terminals are visible side by side and the tab strip lists all five, marking the three that are shown

#### Scenario: Fourth session replaces the focused pane
- **WHEN** three sessions are shown, the keyboard focus is in the second pane, and the user selects the tab of a fourth session
- **THEN** the second pane shows the fourth session, the other two panes are unchanged, and the replaced session keeps running

#### Scenario: Pane closed
- **WHEN** the user removes one of two panes
- **THEN** the remaining pane takes the full width and the removed session keeps running and stays in the tab strip

#### Scenario: Deep link with several sessions
- **WHEN** the page is loaded with two session ids in the URL
- **THEN** both terminals are shown in that order with their earlier output

#### Scenario: Input stays in its pane
- **WHEN** two sessions are shown and the user presses a default response in the first pane
- **THEN** only the first session's terminal receives it
