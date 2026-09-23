# Spec Delta

## MODIFIED Requirements

### Requirement: Cards offer session starters and show session state
When agent sessions are enabled and the card's repository is tracked and not excluded, a card SHALL offer the session starters available for its change — **Draft artifacts** while an artifact is not done, **Implement** in `Ready` or `Implementing`, **Archive** in `Done`, none for archived changes — limited to the starters the repository's agent has a prompt for, and disabled with an explanation when that agent's executable is not found. A card whose change has a running session SHALL instead show a badge — `running`, or `quiet <duration>` when the terminal has been silent for more than a minute — and a card whose latest session failed to start or ended with an error SHALL show that; activating the badge SHALL open that change's detail view with its Console tab selected and that session shown. Status MUST be conveyed by text as well as colour. **Show details** remains available. When agent sessions are disabled or the repository is excluded, cards MUST look and behave exactly as before.

#### Scenario: Done change offers Archive
- **WHEN** a change is in `Done` and agent sessions are enabled
- **THEN** the card offers **Archive** next to its "complete" badge

#### Scenario: Ready change
- **WHEN** a change is in `Ready`, agent sessions are enabled and its repository is not excluded
- **THEN** the card offers **Implement** and still offers **Show details**

#### Scenario: Running session
- **WHEN** a change has a running session
- **THEN** its card shows a session badge and no starter, and activating the badge opens that change's detail view on its Console tab

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no card shows a starter or a session badge

### Requirement: Cards show the work status of their change's worktree
When agent sessions apply to a card's repository and a session worktree exists for its change, the card SHALL show a work-status badge as text plus colour — the number of uncommitted files, the number of commits not pushed, `pushed`, or `merged` — also when no session is running, next to the running session's badge if there is one. Nothing is shown for `clean` or `missing`. Open work whose last activity is older than 24 hours (`uncommitted`, `unpushed`) or 7 days (`pushed`), with no session running, SHALL be highlighted as stale with its age. The badge of `merged` SHALL state that this is as of the last fetch and that the worktree can be removed. Activating the badge opens that change's detail view on its Console tab, showing the worktree's most recent session.

#### Scenario: Ended session with uncommitted work
- **WHEN** a change's session has ended cleanly and its worktree holds 3 uncommitted files
- **THEN** the card shows "3 uncommitted" and activating it opens that change's detail view on its Console tab with that session shown

#### Scenario: Stale
- **WHEN** a worktree has had unpushed commits for two days and no session is running
- **THEN** the badge is highlighted and says so

### Requirement: Open work list
While agent sessions are enabled the top bar SHALL show an "Open work" control. It is the only view of agent activity that spans repositories. Its count SHALL be the number of running sessions plus the number of worktrees whose status is `uncommitted`, `unpushed` or `pushed`; it is hidden only when there is no running session, no such worktree and none that is `merged`. Opening it SHALL list, across all repositories, every running session and those worktrees together with the `merged` ones — including worktrees of archived or vanished changes and worktrees without a session record — with repository, change, branch, status and age; running sessions SHALL be listed first with their live badge, then stale entries, then the rest. An entry with a session SHALL open its change's detail view on the Console tab with that session shown; an entry without one SHALL offer copying a `cd` command and, after confirmation, removal when that is safe.

#### Scenario: Running sessions are listed
- **WHEN** five sessions are running and no worktree holds unshipped work
- **THEN** the "Open work" control is shown with the count 5 and lists all five with their repository, change, branch and live badge

#### Scenario: Opening a running session
- **WHEN** the user activates a running session's entry
- **THEN** that change's detail view opens on its Console tab with that session's terminal and its earlier output

#### Scenario: Archive worktree of an archived change
- **WHEN** the archive worktree of a change that is already archived holds a commit that is not pushed
- **THEN** it appears in the Open work list although no card offers it, and opening it shows its Console tab

#### Scenario: Nothing open
- **WHEN** no session runs and no session worktree exists
- **THEN** the top bar shows no Open work control

### Requirement: Cards keep offering the next step while a session runs
A card whose change has a running session SHALL show the session badge and, next to it, the starters available in the change's current stage. For Draft and Implement with a running session in the change's own worktree, the starter SHALL send its prompt to that session and open that change's detail view on its Console tab with the terminal focused; its label and tooltip MUST say that it sends the prompt to the running session, and MUST NOT ask the user for a further key press. When the prompt was typed but not submitted, the Console tab SHALL say so as it does for any other text sent on the user's behalf. Archive SHALL open its own session as before. The Console tab SHALL offer the same next-step buttons for the session shown.

#### Scenario: Draft finished
- **WHEN** a Draft session is still running and the change has moved to `Ready`
- **THEN** the card shows the running (or quiet) badge and an **Implement** button, and pressing it sends the Implement prompt to that session and opens the detail view on its Console tab

#### Scenario: The prompt was not sent
- **WHEN** the next step is sent to a session whose agent never shows the typed prompt
- **THEN** the Console tab says that the text was typed but not sent, and the session keeps running

#### Scenario: Nothing new to do
- **WHEN** an Implement session is running and the change is `Implementing`
- **THEN** the card offers Implement next to the badge and no other starter

### Requirement: The end-session dialog is graded by work status
Ending a session — from a card or from the Console tab — SHALL go through one dialog that reads the worktree's work status fresh and grades its warning: a plain confirmation for `clean`, `merged` or `missing`; a notice for `pushed` that the work is not merged as of the last fetch; and for `uncommitted` or `unpushed` a strong warning, as text plus colour, naming the number of files or commits that exist only in this worktree, with **Ship instead** offered and the confirming button labelled **End anyway**. The dialog MUST state that the worktree and branch are kept, and SHALL offer worktree removal only when that is safe. Cancelling MUST change nothing.

#### Scenario: Unshipped work
- **WHEN** the user ends a session whose worktree holds 3 uncommitted files
- **THEN** the dialog warns that 3 files exist only in this worktree, offers Ship instead, and ends the session only on **End anyway**

#### Scenario: Nothing unshipped
- **WHEN** the user ends a session whose worktree is `clean`
- **THEN** the dialog asks for a plain confirmation

### Requirement: Each repository has its own stable colour
The board SHALL assign every repository in the snapshot a colour derived deterministically from its repository id, without any configuration. The assignment SHALL be computed over all repositories in the snapshot, independent of the active filters, so that the same set of tracked repositories always yields the same colours across reloads, scans and filter changes. Repositories tracked at the same time SHALL receive distinct colours for up to 19 repositories. The colours a repository can be assigned SHALL exclude the hues the status roles and the brand accent own: every assignable repository hue SHALL differ from every one of those hues by at least 12°, so a repository is never shown in a colour that means "running", "uncommitted", "complete", "needs attention", "error" or "console". The repository colour SHALL be shown on the repository's group header, as an accent on each of its cards including the card's repository label, on its repository filter chip, and on each entry of the Open work list — as an accent on the entry and on the repository name it shows. An entry whose repository is not in the current snapshot SHALL be shown without a repository colour. The colour SHALL adapt to the active theme so that repository-coloured text keeps a contrast ratio of at least 4.5:1 against its background in every supported theme, including the background of the Open work list. Colour MUST NOT be the only cue: wherever a repository colour is shown, the repository name SHALL be shown with it. The error styling of a repository filter chip SHALL take precedence over its repository colour.

#### Scenario: Distinct colours
- **WHEN** 17 repositories are tracked
- **THEN** no two of them have the same colour

#### Scenario: Stable across reload and rescan
- **WHEN** the page is reloaded or a scan completes and the set of tracked repositories is unchanged
- **THEN** every repository has the same colour as before

#### Scenario: Filters do not change colours
- **WHEN** the user filters the board to repository `vcs-admin` only
- **THEN** `vcs-admin` cards, group headers and filter chip keep the colour they had with no filter applied

#### Scenario: Colour is consistent across the board
- **WHEN** repository `beta-soc` has cards in three columns
- **THEN** its group headers, the accent and repository label on all of its cards, and its filter chip all use the same colour, each alongside the name `beta-soc`

#### Scenario: Session tabs carry the repository colour
- **WHEN** the Open work list holds entries for sessions of `beta-soc` and of `alpha-infra`
- **THEN** each entry shows its repository's accent and its repository name in that repository's colour, the same colour that repository's cards and group headers use, and both entries still show the repository name as text

#### Scenario: Filtering the board does not recolour a tab
- **WHEN** the user filters the board to `alpha-infra` only while a `beta-soc` session is in the Open work list
- **THEN** the `beta-soc` entry keeps the colour it had with no filter applied

#### Scenario: Shown and focused marks survive the tint
- **WHEN** a tinted Open work entry is for a running session and carries its live badge
- **THEN** the badge stays distinguishable from the repository colour and still reads as text

#### Scenario: Session of an untracked repository
- **WHEN** a session's repository is switched off in Settings while its entry is in the list
- **THEN** that entry is shown without a repository colour and stays readable

#### Scenario: Theme change
- **WHEN** the user switches from the dark to the light theme
- **THEN** each repository keeps the same hue, and repository-coloured text remains legible (contrast ≥ 4.5:1) on the light backgrounds, on the board and in the Open work list

#### Scenario: Repository in error
- **WHEN** a tracked repository failed to scan
- **THEN** its filter chip shows the error styling rather than its repository colour

#### Scenario: No repository wears a status colour
- **WHEN** 19 repositories are tracked
- **THEN** every assigned hue is at least 12° away from each of the status role hues, from the brand accent and from the console accent

### Requirement: The running session badge shows activity through motion
The session badge of a running session whose terminal is not quiet SHALL be animated wherever it is shown (cards, the Open work list and the Console tab): its dot pulses and a lighter colour sweeps across its label, in a loop of about two seconds that never hides the label or reduces its contrast below that of the static badge. The `quiet`, ended and failed badges, work-status badges and every other badge MUST NOT be animated, so that motion means exactly "an agent is working now". The animation MUST be decorative only: the label still reads `running`, the dot is hidden from assistive technology, and status remains conveyed by text as well as colour. When the user prefers reduced motion (`prefers-reduced-motion: reduce`) the badge MUST be static and look as it did without this requirement. Colours MUST come from the theme tokens so that both themes apply.

#### Scenario: Running
- **WHEN** a change has a running session that printed something within the last minute
- **THEN** its badge reads `running`, its dot pulses and a colour sweeps across the label

#### Scenario: Quiet session is still
- **WHEN** a running session has been silent for more than a minute
- **THEN** its `quiet` badge is not animated

#### Scenario: Reduced motion
- **WHEN** the user's system asks for reduced motion
- **THEN** the running badge is static and still reads `running`

## REMOVED Requirements

### Requirement: Session panel
**Reason**: The dock is replaced by the Console tab of the change's detail view. A session belongs to one change, and
the detail view already gathers that change in one place, so a second full-width surface with its own navigation, its
own remembered height, its own maximise and collapse states and its own reserved page space is no longer needed. Its
content — terminal, session facts, default responses, End session, Clean up, Resume, Delete record and "Copy cd" — is
required unchanged by "The console is a tab of the detail view" in `change-detail`.

**Migration**: Open a session from its card's badge, from its change's **Show details** or from the Open work list; all
three land on the change's detail view with the Console tab selected. Deep links keep working: the selected tab and
session are part of the detail view's URL, so a reload shows the same terminal with its earlier output. The dock's
height, maximise and collapse states and the space reserved for it below the board have no successor — the overlay
sizes itself. No session is ended by this change.

### Requirement: The dock shows up to three sessions side by side
**Reason**: Panes only exist because the dock spans every repository; one change's detail view shows one change's
sessions. Showing three unrelated terminals at once is the crowding this change removes.

**Migration**: Open each change's detail view to reach its terminal; two changes can no longer be watched side by side
in one window. Open two browser windows or tabs on the two detail views instead — several viewers may attach to one
session at once, so nothing is lost by doing so. The `?session=a,b,c` query parameter is gone; a link carrying it lands
on the board, and a single session is reached through its change's detail URL. The rule that typing, default responses
and next-step prompts reach only the session they were used in is kept by "The console tab selects among the change's
sessions" in `change-detail`.

### Requirement: The session panel has a tab per running session
**Reason**: A cross-repository tab strip of sessions is exactly the navigation this change removes: a tab said little
about which change it belonged to or where that change stood. The Open work list now carries the cross-repository view,
with repository, change, branch, status and age on every entry.

**Migration**: Use the top bar's **Open work** control to see every running session across repositories and to switch
between them; selecting an entry opens that change's detail view on its Console tab. Within one change, its sessions
are listed on the Console tab itself. Selecting either still shows the session's earlier output and affects no session.

### Requirement: Session tabs read as tabs
**Reason**: It describes the chrome of the dock's tab strip — a tab's background and outline against the strip, the
shape difference between a shown and a not-shown session, the marking of the focused pane, and the equality of the
collapsed dock's reserved space with the strip's height. None of those things exist once the dock and its panes are
gone.

**Migration**: The Open work list takes over as the cross-repository view; its entries are list rows, not tabs, and
carry repository, change, branch, status and age as text. The repository accent on those rows, and its contrast, are
kept by "Each repository has its own stable colour". The detail view's own tab strip keeps the chrome it already has,
with the Console tab styled by "The console tab reads as a console" in `change-detail`.

### Requirement: The session panel shows work status and offers Ship
**Reason**: Moved, unchanged in substance, to the Console tab — see "The console tab shows work status and offers Ship"
in `change-detail`. It is stated where the console now lives.

**Migration**: None. Work status and Ship are offered on the Console tab of the change's detail view, with the same
rules: Ship while the status is `uncommitted`, `unpushed` or `pushed`, and for `merged` a suggestion to remove the
worktree with removal preselected in the clean-up dialog.
