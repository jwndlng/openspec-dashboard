# Spec Delta

## MODIFIED Requirements

### Requirement: Cards offer session starters and show session state
When agent sessions are enabled and the card's repository is tracked and not excluded, a card SHALL offer the session starters available for its change — **Draft artifacts** while an artifact is not done, **Implement** in `Ready` or `Implementing`, **Archive** in `Done`, none for archived changes — in its footer, limited to the starters the repository's agent has a prompt for, and disabled with an explanation when that agent's executable is not found.

While any session of the card's change is running, the card SHALL show that session's badge **in the place the starters occupy** and SHALL offer no starter at all. The badge SHALL read the running state the terminal can tell — that the agent is working, or that it may need the user with how long the terminal has been silent — and the starters SHALL stay hidden for every one of those states, so no button appears or vanishes as a terminal falls silent. Activating the badge SHALL open that change's detail view with its Console tab selected and that session shown.

A card whose latest session failed to start or ended with an error SHALL show that badge and SHALL still offer the starters its change's stage allows, so the next attempt stays one activation away. A card MUST NOT offer a control that ends a session. Status MUST be conveyed by text as well as colour. **Show details** remains available. When agent sessions are disabled or the repository is excluded, cards MUST look and behave exactly as before.

#### Scenario: Done change offers Archive
- **WHEN** a change is in `Done` and agent sessions are enabled
- **THEN** the card offers **Archive** in its footer

#### Scenario: Ready change
- **WHEN** a change is in `Ready`, agent sessions are enabled and its repository is not excluded
- **THEN** the card offers **Implement** and still offers **Show details**

#### Scenario: Running session
- **WHEN** a change has a running session whose terminal is printing
- **THEN** its card shows the `working` badge where the **Implement** button was, offers no starter and no control that ends the session, and activating the badge opens that change's detail view on its Console tab

#### Scenario: Silent session shows the same badge and no starter
- **WHEN** that session's terminal has printed nothing for 45 seconds
- **THEN** the card's badge says the agent may need the user, and the card still offers no starter

#### Scenario: Failed session keeps its starter
- **WHEN** a change's latest session failed to start and no session of that change is running
- **THEN** its card shows the failure badge and the starter for its stage beside it

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no card shows a starter, a session badge or a console link

### Requirement: Cards show only what an overview needs
A card SHALL show only what an overview needs: the change name in monospace, the relative age of `lastActivityAt` under it (e.g. `updated 3d ago`, or the archive date for an archived change), a progress bar, a console quick link in the card's top right corner, and a footer carrying the change's session status and next-step starter as the "Cards offer session starters and show session state" requirement gives them, together with **Show details**.

The change name and its age SHALL have the top of the card to themselves apart from the console quick link, which SHALL occupy a slot of its own at the top right: the name SHALL wrap within the width that slot leaves and SHALL never be shortened or pushed by a badge. A card SHALL NOT show a separate session-status line between the age and the progress bar: the session status sits in the footer, so a card goes from its age straight to its progress bar whether or not it has a session. **Show details** SHALL have the same height and text size as the next-step starter button in the footer, so the two sit on the footer's line as a pair; at rest it keeps its quieter look than the starter. The progress bar SHALL be, for a change in `Drafts`, the drafting progress: the number of the change's artifacts that are done out of all of its schema's artifacts, labelled `done/total Artifacts`, with a tooltip and accessible name that say it counts artifacts (e.g. `2 of 4 artifacts written`); for any other change with tasks (`tasks.total > 0`), the task progress labelled `done/total Tasks`, with a tooltip and accessible name that say it counts tasks. Both bars SHALL share one shape and style; the word after the count is what tells them apart at a glance. A card in `Backlog`, and a card outside `Drafts` without tasks, SHALL show no progress bar. A card SHALL additionally show the `no tasks` warning and an error mark for any other warning the snapshot carries. A card SHALL NOT show the repository name — on the combined board every card sits in its repository's group, whose header names it, and a repository board names it in its header — nor the branch badge, the checkouts holding the change, the worktree's work status, the prompt, how long the change has been complete, whether its specs are synced, or which artifacts are written: the change's detail view shows those (change-detail: "Detail header shows the change's state"), and the column and the progress bar say how far the change has come.

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
- **THEN** its card shows the task progress bar labelled `0/12 Tasks`

#### Scenario: Card with a running session
- **WHEN** a change in `Implementing` has a session whose agent is waiting for the user
- **THEN** its card shows the change name and its age, under them the task progress, and in its footer the session's status in the starter's place beside **Show details**

#### Scenario: The console slot does not squeeze the name
- **WHEN** the change `introduce-tenant-quota-enforcement` has a running session and its name fits the width the console slot leaves
- **THEN** its card shows the whole name on one line, with the console quick link at the top right and no badge beside the name

#### Scenario: The age is followed by the progress bar
- **WHEN** a change has neither a session nor a session worktree
- **THEN** its card goes straight from the age to the progress bar, with no status line and no space for one

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

**Show details** SHALL be the only part of a card that navigates to the detail view, apart from the **Console** quick link and the session badge. Whenever agent sessions apply to the card's repository — agent sessions on and the repository not excluded — the card SHALL show the console quick link in its top right corner, whether or not the change has a session or a session worktree, so the way into a change's terminal is always in the same place; it SHALL open the change's detail view directly on its Console tab, carrying the board like **Show details** does. The quick link is an icon; its tooltip and accessible name SHALL say that it opens the agent console of the named change. When agent sessions do not apply to the repository the card SHALL show no console quick link. The card as a whole MUST NOT be a link, and the change name MUST NOT be one; clicking a card's background, its badges or its progress bar MUST NOT navigate anywhere. The session starters keep their own behaviour.

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

#### Scenario: The link is there before any session
- **WHEN** a change in a repository with agent sessions enabled has neither a session nor a session worktree
- **THEN** its card still shows the console quick link at the top right, in the same place as every other card's, and activating it opens that change's Console tab

#### Scenario: No console, no link
- **WHEN** agent sessions are disabled, or the card's repository is excluded from them
- **THEN** its card shows no console quick link

### Requirement: The end-session dialog is graded by work status
Ending a session SHALL be offered from the Console tab and nowhere else, and SHALL go through one dialog that reads the worktree's work status fresh and grades its warning: a plain confirmation for `clean`, `merged` or `missing`; a notice for `pushed` that the work is not merged as of the last fetch; and for `uncommitted` or `unpushed` a strong warning, as text plus colour, naming the number of files or commits that exist only in this worktree, with **Ship instead** offered and the confirming button labelled **End anyway**. The dialog MUST state that the worktree and branch are kept, and SHALL offer worktree removal only when that is safe. Cancelling MUST change nothing.

#### Scenario: Unshipped work
- **WHEN** the user ends a session whose worktree holds 3 uncommitted files
- **THEN** the dialog warns that 3 files exist only in this worktree, offers Ship instead, and ends the session only on **End anyway**

#### Scenario: Nothing unshipped
- **WHEN** the user ends a session whose worktree is `clean`
- **THEN** the dialog asks for a plain confirmation

#### Scenario: The board does not end sessions
- **WHEN** a session is running and the user looks for a way to end it on the board
- **THEN** no card offers one, and the way to it is the change's Console tab

## REMOVED Requirements

### Requirement: Running sessions can be ended from the card
**Reason**: A card is otherwise read-only, and a one-click control next to a badge that updates every few seconds put ending an agent's work a mis-click away. Ending a session belongs where the session is.
**Migration**: **End session** on the change's Console tab, reached from the card's console quick link or by activating the session badge, opens the same graded end-session dialog. Nothing about the dialog or about ending a session changes.

### Requirement: Cards keep offering the next step while a session runs
**Reason**: The card's footer now holds the running session's badge in the starter's place, so there is no starter on the card to send a prompt into a running session. Offering both put the status and a button that types into that same terminal side by side in a card that shows no terminal.
**Migration**: The next-step buttons for a running session live on the change's Console tab, beside the terminal they type into — see change-detail: "The console tab offers the change's next step". Their behaviour, including the report when a prompt was typed but not submitted, is unchanged; only the card no longer duplicates them.
