# Spec Delta

## ADDED Requirements

### Requirement: Cards offer Show details
Each card SHALL offer a **Show details** action that opens its change's detail view, carrying the board it sits on and that board's filters so the detail view can lead back to them. The action SHALL be a link: opening it in a new tab or window SHALL land on the same detail view, and activating it with the keyboard SHALL open the detail view in the current tab.

**Show details** SHALL be the only part of a card that navigates to the detail view. The card as a whole MUST NOT be a link, and the change name MUST NOT be one; clicking a card's background, its badges or its progress bar MUST NOT navigate anywhere. The session starters, the session badge and the work-status badge keep their own behaviour.

#### Scenario: Opening a change
- **WHEN** the user activates **Show details** on the card of change `multi-tenant-sync`
- **THEN** the detail view of `multi-tenant-sync` is shown

#### Scenario: Card background does not navigate
- **WHEN** the user clicks the card's background, its change name, its progress bar or its age badge
- **THEN** nothing is opened and the board stays as it is

#### Scenario: New tab
- **WHEN** the user middle-clicks or ⌘-clicks **Show details**
- **THEN** a new tab opens on that change's detail view

#### Scenario: Board and filters are carried
- **WHEN** the combined board is filtered to a text search and the user activates **Show details** on a card
- **THEN** the detail view knows that board and that search, so its way back returns to them

## MODIFIED Requirements

### Requirement: Cards show repository, name, progress, activity and branch
Each card SHALL display the change name in monospace, a progress bar with `done/total` when tasks exist, the relative age of `lastActivityAt` (e.g. "3d ago"), and a branch badge when `branchMatch` is set. On the combined board each card SHALL also display the repository name; on a single-repository board the repository name SHALL be omitted from cards. Cards in `Done` SHALL additionally show how long the change has been complete.

The branch badge MUST NOT extend beyond the card's content area at any column width. A branch name that fits SHALL be shown in full. A branch name that does not fit SHALL be shortened in the middle with an ellipsis so that both its beginning and its end remain readable, and the branch glyph SHALL remain visible. The full branch name SHALL remain available as the badge's tooltip and as its accessible name. The badge MAY wrap onto its own line within the card but MUST NOT shrink or displace the card's other badges out of the card. The same rules SHALL apply to the current-branch badge in the repository board header.

#### Scenario: Card content
- **WHEN** a change `cloud-deployment` in repo `demo-ops` has `tasks 30/30`, last activity 12 days ago and no branch match, and is shown on the combined board
- **THEN** the card shows `demo-ops`, `cloud-deployment`, a full progress bar labelled `30/30`, `12d ago`, and no branch badge

#### Scenario: Card on a repository board
- **WHEN** the same change is shown on the board for repository `demo-ops`
- **THEN** the card shows `cloud-deployment`, the progress bar, `12d ago` and **Show details**, but not the repository name

#### Scenario: Short branch name is shown in full
- **WHEN** a card has `branchMatch: feat/add-login`
- **THEN** the badge reads `⎇ feat/add-login` with no ellipsis

#### Scenario: Long branch name stays inside the card
- **WHEN** a card has `branchMatch: feat/introduce-tenant-quota-enforcement` and the name does not fit the card width
- **THEN** the badge ends at or before the card's content edge, shows the beginning of the name, an ellipsis, and the end of the name (ending in `quota-enforcement`), and no part of the badge is painted outside the card

#### Scenario: Full name stays available
- **WHEN** the user hovers a shortened branch badge, or a screen reader reads it
- **THEN** the full name `feat/introduce-tenant-quota-enforcement` is presented

#### Scenario: Other badges are not squeezed
- **WHEN** a card shows an age badge and a long branch badge that do not fit on one line
- **THEN** the branch badge moves to its own line and the age badge keeps its full text

### Requirement: Cards offer session starters and show session state
When agent sessions are enabled and the card's repository is tracked and not excluded, a card SHALL offer the session starters available for its change — **Draft artifacts** while an artifact is not done, **Implement** in `Ready` or `Implementing`, **Archive** in `Done`, none for archived changes — limited to the starters the repository's agent has a prompt for, and disabled with an explanation when that agent's executable is not found. A card whose change has a running session SHALL instead show a badge — `running`, or `quiet <duration>` when the terminal has been silent for more than a minute — and a card whose latest session failed to start or ended with an error SHALL show that; activating the badge SHALL open the session panel. Status MUST be conveyed by text as well as colour. **Show details** remains available. When agent sessions are disabled or the repository is excluded, cards MUST look and behave exactly as before.

#### Scenario: Done change offers Archive
- **WHEN** a change is in `Done` and agent sessions are enabled
- **THEN** the card offers **Archive** next to its "complete" badge

#### Scenario: Ready change
- **WHEN** a change is in `Ready`, agent sessions are enabled and its repository is not excluded
- **THEN** the card offers **Implement** and still offers **Show details**

#### Scenario: Running session
- **WHEN** a change has a running session
- **THEN** its card shows a session badge and no starter, and activating the badge opens the session panel

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no card shows a starter or a session badge

## REMOVED Requirements

### Requirement: Copy apply command
**Reason**: The card's most prominent control copied a shell command to be pasted elsewhere, crowding out the card's actual purpose — opening the change. **Show details** takes its place, and agent sessions are started from the card's session starters, which do not need a copied command.

**Migration**: There is no copy action on a card any more, and the dashboard no longer offers an apply or start command anywhere. Run the command by hand: `cd <checkoutPath> && claude "/opsx:apply <changeName>"` for a change in `Ready` or later, `cd <checkoutPath> && claude "/opsx:continue <changeName>"` otherwise; the repository board header's "Copy cd" still copies `cd <repoPath>`.

### Requirement: Cards open the change detail view
**Reason**: A card is no longer one large link. Opening a change is the job of the card's **Show details** action, covered by the "Cards offer Show details" requirement, which also forbids the card as a whole and its change name from navigating.

**Migration**: Activate **Show details** on the card instead of clicking the card itself; it is still a real anchor, so ⌘-click, middle-click and the keyboard work as before, and it still carries the board and its filters.
