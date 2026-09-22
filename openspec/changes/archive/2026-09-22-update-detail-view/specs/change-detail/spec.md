# Spec Delta

## ADDED Requirements

### Requirement: The detail view is an overlay over its board
The detail view SHALL be presented as an overlay: the board it belongs to — the board it was opened from, or the board of the change's repository when it was opened directly by URL — SHALL stay rendered behind it under a dimmed backdrop, and the overlay SHALL sit above the rest of the page. The overlay SHALL fill a bounded area of the window rather than the whole viewport, so that the board behind it stays recognisable.

The overlay SHALL be dismissed by its close control, by pressing `Escape` and by activating the backdrop, each returning to the board behind it with that board's filters intact — the same target the back link leads to. Dismissing the overlay MUST NOT reload the board or reset its filters, its minimized groups or its scroll position.

While the overlay is open the board behind it MUST NOT be operable: it MUST NOT take keyboard focus and its cards, filters and controls MUST NOT react to pointer input. Opening the overlay SHALL move the keyboard focus into it; dismissing it SHALL return the focus to the page. The overlay SHALL be exposed as a modal dialog with an accessible name naming the change.

The overlay MUST NOT end, pause or hide any agent session, and MUST NOT write anything to a repository.

The change's own content — the artifact tabs, the file list and the artifact text — SHALL scroll inside the overlay; the page behind it MUST NOT scroll in its place.

#### Scenario: Board stays visible behind
- **WHEN** the user opens the detail view of a card on a filtered combined board
- **THEN** the overlay is shown over that board, dimmed behind it, with the board's cards still in place

#### Scenario: Escape closes
- **WHEN** the overlay is open and the user presses `Escape`
- **THEN** the overlay closes and the board it was opened from is shown again with the same filters

#### Scenario: Backdrop closes
- **WHEN** the user activates the dimmed area outside the overlay
- **THEN** the overlay closes and the same board is shown again

#### Scenario: Opened by URL
- **WHEN** the detail view is opened directly from a pasted URL
- **THEN** the board of that change's repository is shown behind the overlay, and closing it lands there

#### Scenario: The board behind is inert
- **WHEN** the overlay is open and the user clicks where a card or a filter sits behind it, or tabs through the page
- **THEN** nothing on the board reacts and the focus stays inside the overlay

#### Scenario: Long artifact scrolls inside the overlay
- **WHEN** the selected file is longer than the overlay
- **THEN** its text scrolls within the overlay and the board behind it does not move

## MODIFIED Requirements

### Requirement: Detail header shows the change's state
The detail view SHALL show, above the artifacts: the change name in monospace, the repository name linking to that repository's board, a close control, and every warning the snapshot carries for the change. All of these SHALL come from the existing snapshot; the detail view MUST NOT introduce facts about a change that the snapshot does not carry.

The detail view MUST NOT repeat the change's status labels — the column, the task progress, the relative age of its last activity, its creation or archive date, its schema and its branch badge. Those belong to the card on the board.

#### Scenario: Header content
- **WHEN** a change `cloud-deployment` of repository `demo-ops` is in `Implementing` with `tasks 4/12`, created `2026-03-02`, last activity 3 days ago and `branchMatch: feat/cloud-deployment`
- **THEN** the header shows `cloud-deployment`, `demo-ops` as a link to that repository's board and a close control, and shows neither `Implementing` nor a progress bar, nor the age, the creation date, the schema or the branch badge

#### Scenario: Warnings are surfaced
- **WHEN** the snapshot carries a warning for the change
- **THEN** the warning text is shown in the header

#### Scenario: Archived change
- **WHEN** the detail view is open for an archived change
- **THEN** its artifacts are shown like any other change's, without an archive date in the header

### Requirement: Navigation between board and detail view
Each board card SHALL open the detail view for its change through its **Show details** action, which carries the board and its filters. The detail view SHALL offer a way back to the board it was opened from with that board's filters intact; when the detail view was opened directly by URL, it SHALL lead to the board of its repository. Opening **Show details** in a new tab or window SHALL land on the same detail view.

#### Scenario: From a filtered board
- **WHEN** the user has filtered the combined board to a text search, opens a card's detail view and then closes it
- **THEN** the combined board is shown again with the same search applied

#### Scenario: Opened by URL
- **WHEN** the detail view is opened directly from a pasted URL
- **THEN** closing it leads to the board of that change's repository

#### Scenario: New tab
- **WHEN** the user middle-clicks or ⌘-clicks a card's **Show details**
- **THEN** a new tab opens on that change's detail view

### Requirement: Empty and error states
When the selected file cannot be read, the view SHALL show a message naming the file and the reason, and the rest of the view SHALL stay usable. When the file exceeds the server's size cap, the view SHALL say so and offer an action that copies the file's absolute path instead of the content. When a change has no artifact file at all, the view SHALL show its header with an explanation that nothing has been written yet.

#### Scenario: File too large
- **WHEN** the selected file exceeds the server's size cap
- **THEN** the view explains that the file is too large to display and offers "Copy file path", which copies the file's absolute path

#### Scenario: Read error
- **WHEN** the server answers with an error for the selected file
- **THEN** the reason is shown in the content area and the tabs and the header remain usable

#### Scenario: Nothing written yet
- **WHEN** a change directory exists with no artifact file
- **THEN** the header is shown and the content area explains that this change has no artifacts yet

## REMOVED Requirements

### Requirement: Copy actions in the detail view
**Reason**: The detail view is now an overlay for reading a change's artifacts; its header is reduced to the change's identity and a close control, and the apply and start commands have been removed from the dashboard altogether.

**Migration**: The absolute path of a file is still offered where it replaces content the view cannot show — the too-large state, covered by the "Empty and error states" requirement. For the other two, run the commands by hand: `cd <repoPath>`, and `cd <checkoutPath> && claude "/opsx:apply <changeName>"`. The repository board header still offers "Copy cd".
