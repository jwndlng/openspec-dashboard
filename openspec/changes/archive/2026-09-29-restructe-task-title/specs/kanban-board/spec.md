# Spec Delta

## MODIFIED Requirements

### Requirement: Cards show only what an overview needs
A card SHALL show only what an overview needs: the change name in monospace, the relative age of `lastActivityAt` under it (e.g. `updated 3d ago`, or the archive date for an archived change), the change's session status as the "Cards offer session starters and show session state" requirement gives it, a progress bar, and a footer with the next-step starter and **Show details**, and — when the change has a console — the console quick link beside its session status.

The change name and its age SHALL have the full width of the card's top to themselves: nothing SHALL sit beside them, so the name wraps only when it is longer than the card is wide. The session status and the console quick link SHALL sit together on their own line directly below the age and above the progress bar; a card with neither SHALL show no such line and no space for one. **Show details** SHALL have the same height and text size as the next-step starter button in the footer, so the two sit on the footer's line as a pair; at rest it keeps its quieter look than the starter. The progress bar SHALL be, for a change in `Drafts`, the drafting progress: the number of the change's artifacts that are done out of all of its schema's artifacts, labelled `done/total Artifacts`, with a tooltip and accessible name that say it counts artifacts (e.g. `2 of 4 artifacts written`); for any other change with tasks (`tasks.total > 0`), the task progress labelled `done/total Tasks`, with a tooltip and accessible name that say it counts tasks. Both bars SHALL share one shape and style; the word after the count is what tells them apart at a glance. A card in `Backlog`, and a card outside `Drafts` without tasks, SHALL show no progress bar. A card SHALL additionally show the `no tasks` warning and an error mark for any other warning the snapshot carries. A card SHALL NOT show the repository name — on the combined board every card sits in its repository's group, whose header names it, and a repository board names it in its header — nor the branch badge, the checkouts holding the change, the worktree's work status, the prompt, how long the change has been complete, whether its specs are synced, or which artifacts are written: the change's detail view shows those (change-detail: "Detail header shows the change's state"), and the column and the progress bar say how far the change has come.

The branch badge in the repository board header MUST NOT extend beyond its container at any width. A branch name that fits SHALL be shown in full; one that does not SHALL be shortened in the middle with an ellipsis so that both its beginning and its end remain readable, with the branch glyph visible and the full name as its tooltip and accessible name.

#### Scenario: Card content
- **WHEN** a change `cloud-deployment` in repo `demo-ops` has `tasks 30/30`, last activity 12 days ago and a branch match `feat/cloud-deployment`, and is shown on the combined board
- **THEN** the card sits in the `demo-ops` group and shows `cloud-deployment`, `updated 12d ago`, a full progress bar labelled `30/30 Tasks` and **Show details**, and shows neither `demo-ops`, the branch, nor a completion badge

#### Scenario: Drafting progress
- **WHEN** a `spec-driven` change has `proposal` and `design` done and `specs` and `tasks` not done
- **THEN** its card in `Drafts` shows a progress bar half filled and labelled `2/4 Artifacts`, whose tooltip and accessible name read `2 of 4 artifacts written`

#### Scenario: Drafting progress for another schema
- **WHEN** a change of a schema with the artifacts `brief`, `plan`, `checklist` has `brief` done
- **THEN** its card in `Drafts` shows a drafting progress bar labelled `1/3 Artifacts`

#### Scenario: Backlog card has no bar
- **WHEN** a change in `Backlog` has a `tasks.md` that is not written yet
- **THEN** its card shows no progress bar

#### Scenario: Task progress replaces drafting progress
- **WHEN** a change moves from `Drafts` to `Ready` with `tasks` `done: 0, total: 12`
- **THEN** its card shows the task progress bar labelled `0/12 Tasks`, whose tooltip says it counts tasks, and no drafting progress

#### Scenario: Card with a running session
- **WHEN** a change in `Implementing` has a session whose agent is waiting for the user
- **THEN** its card shows the change name and its age, under them the session's status, then the task progress, and the next step in its footer

#### Scenario: Session status does not squeeze the name
- **WHEN** the change `introduce-tenant-quota-enforcement` has a running session and a session worktree, and its name fits the card's width on one line
- **THEN** its card shows the whole name on one line, with the session badge and the console quick link on the line below the age

#### Scenario: No session, no status line
- **WHEN** a change has neither a session nor a session worktree
- **THEN** its card goes straight from the age to the progress bar, with no empty line between them

#### Scenario: Show details matches the starter
- **WHEN** a card in `Ready` offers **▶ Implement** and **Show details** in its footer
- **THEN** both are drawn with the same height and the same text size

#### Scenario: Details live in the detail view
- **WHEN** a change has a `prompt.md`, a worktree with uncommitted files and all of its artifacts written
- **THEN** its card shows none of these, and its detail view shows the prompt, the work status and each artifact's state

#### Scenario: Long branch name in the repository header
- **WHEN** the repository board's current branch is `feat/introduce-tenant-quota-enforcement` and it does not fit
- **THEN** its badge shows the beginning, an ellipsis and `quota-enforcement`, stays inside the header, and presents the full name on hover and to a screen reader

### Requirement: Cards offer Show details
Each card SHALL offer a **Show details** action that opens its change's detail view, carrying the board it sits on and that board's filters so the detail view can lead back to them. The action SHALL be a link: opening it in a new tab or window SHALL land on the same detail view, and activating it with the keyboard SHALL open the detail view in the current tab.

**Show details** SHALL be the only part of a card that navigates to the detail view, apart from the **Console** quick link: when agent sessions apply and the change has a session or a session worktree, the card SHALL show a small console link on its session-status line under the change name, beside the session status, that opens the change's detail view directly on its Console tab (carrying the board like **Show details** does). The quick link is an icon; its tooltip and accessible name SHALL say that it opens the agent console of the named change. The card as a whole MUST NOT be a link, and the change name MUST NOT be one; clicking a card's background, its badges or its progress bar MUST NOT navigate anywhere. The session starters and the session badge keep their own behaviour.

#### Scenario: Opening a change
- **WHEN** the user activates **Show details** on the card of change `multi-tenant-sync`
- **THEN** the detail view of `multi-tenant-sync` is shown

#### Scenario: Card background does not navigate
- **WHEN** the user clicks the card's background, its change name, its progress bar or its age badge
- **THEN** nothing is opened and the board stays as it is

#### Scenario: New tab
- **WHEN** the user middle-clicks or ⌘-clicks **Show details**
- **THEN** a new tab opens on that change's detail view

#### Scenario: Keyboard
- **WHEN** the user tabs to a card and presses Enter
- **THEN** the detail view for that change is shown

#### Scenario: Console quick link
- **WHEN** the change `multi-tenant-sync` has a running session and the user activates the console link on its card
- **THEN** the detail view of `multi-tenant-sync` opens on its Console tab, and closing it returns to the board with its filters

#### Scenario: No console, no link
- **WHEN** a change has neither a session nor a session worktree
- **THEN** its card shows no console link
