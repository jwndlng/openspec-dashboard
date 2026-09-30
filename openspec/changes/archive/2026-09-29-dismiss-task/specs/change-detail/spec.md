# Spec Delta

## ADDED Requirements

### Requirement: The detail header offers Dismiss change
The detail header SHALL offer **Dismiss change** for a change that is not archived and whose directory the snapshot
places in the repository's main checkout — its own checkout or one of its other checkouts is the main checkout. It SHALL
be set apart from the change's facts and drawn as a quiet control that reads as destructive only on hover or focus, so
that it is not mistaken for a next step. For an active change held only by linked worktrees it SHALL be shown disabled,
with a tooltip naming the worktree's branch and saying that such a change leaves the board when that worktree is
removed. It SHALL NOT be shown for an archived change, for a change that is gone from the snapshot, or in the
repository's failed or disabled state. Activating it SHALL open the dismiss confirmation of the `change-dismissal`
capability inside the detail view. After a successful dismissal the detail view SHALL close to the board it was opened
from — unless a linked worktree still holds the change, in which case it stays open on the copy now shown — and a short
notice SHALL say that the change was dismissed and whether its removal was staged.

#### Scenario: Offered for a draft
- **WHEN** the detail view is open for `lint-rules` in `Drafts`, whose directory is in the main checkout
- **THEN** the header offers **Dismiss change**

#### Scenario: Not offered for an archived change
- **WHEN** the detail view is open for an archived change
- **THEN** the header does not offer **Dismiss change**

#### Scenario: Worktree-only change
- **WHEN** the detail view is open for `cloud-deployment`, held only by a linked worktree on `feat/cloud-deployment`
- **THEN** **Dismiss change** is disabled and its tooltip names `feat/cloud-deployment`

#### Scenario: After dismissing
- **WHEN** the user confirms dismissing `lint-rules` and no linked worktree holds it
- **THEN** the detail view closes to the board it was opened from, which no longer shows `lint-rules`, and a notice says it was dismissed and its removal staged

#### Scenario: Refused
- **WHEN** the dismissal is refused because the change changed since the confirmation was shown
- **THEN** the confirmation stays open, says why, and offers to show the current state again

## MODIFIED Requirements

### Requirement: The detail view is an overlay over its board
The detail view SHALL be presented as an overlay: the board it belongs to — the board it was opened from, or the board of the change's repository when it was opened directly by URL — SHALL stay rendered behind it under a dimmed backdrop, and the overlay SHALL sit above the rest of the page. The overlay SHALL fill a bounded area of the window rather than the whole viewport, so that the board behind it stays recognisable.

The overlay SHALL be dismissed by its close control, by pressing `Escape` and by activating the backdrop, each returning to the board behind it with that board's filters intact — the same target the back link leads to. Dismissing the overlay MUST NOT reload the board or reset its filters, its minimized groups or its scroll position.

While the keyboard focus is inside the terminal of the Console tab, `Escape` SHALL be delivered to the agent and MUST NOT dismiss the overlay; the close control and the backdrop keep dismissing it, and `Escape` with the focus anywhere else in the overlay keeps dismissing it. While the dismiss confirmation is open, `Escape` and activating outside it SHALL close only the confirmation, and the overlay stays open.

While the overlay is open the board behind it MUST NOT be operable: it MUST NOT take keyboard focus and its cards, filters and controls MUST NOT react to pointer input. Opening the overlay SHALL move the keyboard focus into it; dismissing it SHALL return the focus to the page. The overlay SHALL be exposed as a modal dialog with an accessible name naming the change.

The overlay MUST NOT end, pause or hide any agent session, and MUST NOT write anything to a repository except by dismissing the change after the user confirmed it, as specified in the `change-dismissal` capability. Dismissing it while a session is shown MUST NOT end that session: the agent keeps running and its card keeps showing the session badge.

The change's own content — the artifact tabs, the file list, the artifact text and the terminal — SHALL scroll inside the overlay; the page behind it MUST NOT scroll in its place.

#### Scenario: Board stays visible behind
- **WHEN** the user opens the detail view of a card on a filtered combined board
- **THEN** the overlay is shown over that board, dimmed behind it, with the board's cards still in place

#### Scenario: Escape closes
- **WHEN** the overlay is open on an artifact tab and the user presses `Escape`
- **THEN** the overlay closes and the board it was opened from is shown again with the same filters

#### Scenario: Escape reaches the agent
- **WHEN** the Console tab is selected, the keyboard focus is in the terminal and the user presses `Escape`
- **THEN** the agent receives it and the overlay stays open

#### Scenario: Escape outside the terminal still closes
- **WHEN** the Console tab is selected, the keyboard focus is on the tab strip and the user presses `Escape`
- **THEN** the overlay closes

#### Scenario: Escape closes the confirmation first
- **WHEN** the dismiss confirmation is open and the user presses `Escape`
- **THEN** the confirmation closes, nothing is deleted, and the detail view stays open

#### Scenario: Backdrop closes
- **WHEN** the user activates the dimmed area outside the overlay
- **THEN** the overlay closes and the same board is shown again

#### Scenario: Closing does not end the session
- **WHEN** the user closes the overlay while the agent is working
- **THEN** the agent keeps running and the card keeps showing the session badge

#### Scenario: Opened by URL
- **WHEN** the detail view is opened directly from a pasted URL
- **THEN** the board of that change's repository is shown behind the overlay, and closing it lands there

#### Scenario: The board behind is inert
- **WHEN** the overlay is open and the user clicks where a card or a filter sits behind it, or tabs through the page
- **THEN** nothing on the board reacts and the focus stays inside the overlay

#### Scenario: Long artifact scrolls inside the overlay
- **WHEN** the selected file is longer than the overlay
- **THEN** its text scrolls within the overlay and the board behind it does not move
