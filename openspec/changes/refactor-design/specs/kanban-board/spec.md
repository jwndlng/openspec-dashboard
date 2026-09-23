## REMOVED Requirements

### Requirement: Cards say which checkout a change lives in
**Reason**: The card shows only what an overview needs; where a change lives is a detail.
**Migration**: The branch badge, with the worktree path and the other checkouts in its tooltip, is in the change's detail view header (change-detail: "Detail header shows the change's state"). The board still shows each change once per repository.

### Requirement: Cards show the work status of their change's worktree
**Reason**: The worktree's state is a detail, not part of the overview.
**Migration**: The work-status badge, with the same text, colours and staleness rules, is in the change's detail view header; activating it opens the Console tab.

### Requirement: Cards mark an archive that the main checkout does not have yet
**Reason**: Which checkout holds an archive is a detail.
**Migration**: The pending-archive badge, with the same text and tooltip, is in the archived change's detail view header.

### Requirement: Cards show a prompt badge for changes with a prompt.md
**Reason**: The prompt is context for working on a change, not for the overview.
**Migration**: The detail view header shows the prompt's text as plain text.

### Requirement: Cards show repository, name, progress, activity and branch
**Reason**: Replaced by "Cards show only what an overview needs": the card drops the repository name (its group names it), the branch badge and the completion badge.
**Migration**: The branch badge, completion age and the other details are in the change's detail view header (change-detail: "Detail header shows the change's state"); the branch badge rules now apply there and in the repository board header.

### Requirement: Visual design follows the dashboard token set
**Reason**: The teal-on-neutral-grey "Dithered" token set, Space Grotesk and the single 4px radius are replaced by the grey and indigo design; its "Dark ground is neutral grey" scenario no longer holds.
**Migration**: See "Visual design follows the grey and indigo token set" below, which keeps every contrast, token-only, disjoint-colour and offline rule.

## MODIFIED Requirements

### Requirement: Cards offer Show details
Each card SHALL offer a **Show details** action that opens its change's detail view, carrying the board it sits on and that board's filters so the detail view can lead back to them. The action SHALL be a link: opening it in a new tab or window SHALL land on the same detail view, and activating it with the keyboard SHALL open the detail view in the current tab.

**Show details** SHALL be the only part of a card that navigates to the detail view, apart from the **Console** quick link: when agent sessions apply and the change has a session or a session worktree, the card SHALL show a small console link in its top-right corner, beside the session status, that opens the change's detail view directly on its Console tab (carrying the board like **Show details** does). The quick link is an icon; its tooltip and accessible name SHALL say that it opens the agent console of the named change. The card as a whole MUST NOT be a link, and the change name MUST NOT be one; clicking a card's background, its badges or its progress bar MUST NOT navigate anywhere. The session starters and the session badge keep their own behaviour.

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

### Requirement: Cards offer session starters and show session state
When agent sessions are enabled and the card's repository is tracked and not excluded, a card SHALL offer the session starters available for its change — **Draft artifacts** while an artifact is not done, **Implement** in `Ready` or `Implementing`, **Archive** in `Done`, none for archived changes — limited to the starters the repository's agent has a prompt for, and disabled with an explanation when that agent's executable is not found. A card whose change has a running session SHALL instead show a badge beside the change name — `running`, or `quiet <duration>` when the terminal has been silent for more than a minute, or that the agent may need the user — and a card whose latest session failed to start or ended with an error SHALL show that; activating the badge SHALL open the session panel. Status MUST be conveyed by text as well as colour. **Show details** remains available. When agent sessions are disabled or the repository is excluded, cards MUST look and behave exactly as before.

#### Scenario: Done change offers Archive
- **WHEN** a change is in `Done` and agent sessions are enabled
- **THEN** the card offers **Archive** in its footer

#### Scenario: Ready change
- **WHEN** a change is in `Ready`, agent sessions are enabled and its repository is not excluded
- **THEN** the card offers **Implement** and still offers **Show details**

#### Scenario: Running session
- **WHEN** a change has a running session
- **THEN** its card shows a session badge and no starter, and activating the badge opens the session panel

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no card shows a starter or a session badge

### Requirement: Status labels use a semantic colour palette
Every label the board paints in a colour SHALL draw that colour from a fixed set of semantic roles, and each role SHALL
mean one thing across the whole UI. The roles are `info` (blue), `branch` (orange), `success`, `warning`, `danger` and
`neutral`. Each role SHALL be defined as theme tokens for its text, its border and a soft background in both themes: a
label in a role SHALL be drawn on that role's soft background (a translucent tint of the role), so the role reads as a
filled chip. The `neutral` role keeps the badge's own background. Component styles MUST reference those tokens
rather than literal colours or the brand accent.

Labels SHALL use the roles as follows:

- `info` — something in flight: an agent session that is running, including its `quiet` state, and outside the board an
  action that is planned but not yet applied. On a card no label other than a running session's SHALL use it, so that
  on the board blue means exactly "an agent is up".
- `branch` — anything naming a working copy that is not merged yet: the branch badge on the change detail view and
  in the repository board header, and the `uncommitted`, `unpushed` and `pushed` work-status badges.
- `success` — a complete change and `merged` work.
- `warning` — a condition the user should look at but that is not an error: a missing tasks file, an archive the main
  checkout does not have yet.
- `danger` — a failed or erroring session, a scan warning, and uncommitted or unpushed work that has gone stale.
  Stale `pushed` work stays `warning`: a pushed branch may simply be waiting for review.
- `neutral` — labels that carry no status: the activity age, the `prompt` note, the column a change sits in, and
  markers such as which agent profile is the default.

The brand accent SHALL NOT be the colour of any status label; it stays reserved for focus, active state, primary
actions and progress. Colour MUST NOT be the only cue: every label SHALL keep its text, and its role MUST NOT change
what it says. Every role's text SHALL keep a contrast ratio of at least 4.5:1 against the card and panel backgrounds in
both themes, and so SHALL it against the role's soft background laid over those backgrounds.

#### Scenario: A live agent is blue
- **WHEN** a card's change has a running session that printed something within the last minute
- **THEN** its badge reads `running` in the `info` role, and no other label on that card uses `info`

#### Scenario: A quiet session keeps the live role
- **WHEN** a running session's terminal has printed nothing for more than a minute
- **THEN** its badge reads `quiet <duration>` in the `info` role, without motion

#### Scenario: Branch and uncommitted work share the orange role
- **WHEN** a change's detail view shows the branch badge `feat/add-login` and its worktree holds 3 uncommitted files
- **THEN** both labels are painted in the `branch` role, and both still read their own text

#### Scenario: The brand accent is not a status
- **WHEN** any card on the board is rendered in either theme
- **THEN** none of its labels uses the brand accent colour, while focus rings, primary buttons and the progress bar still do

#### Scenario: Stale open work escalates
- **WHEN** a worktree has had unpushed commits for two days and no session is running
- **THEN** its badge is painted in the `danger` role and still says how long it has been untouched

#### Scenario: A stale pushed branch is only a warning
- **WHEN** a worktree's branch has been pushed and untouched for eight days and no session is running
- **THEN** its badge is painted in the `warning` role, not `danger`

#### Scenario: Roles are legible in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** each role's text keeps a contrast ratio of at least 4.5:1 against the badge's own ground and against the card it sits in

### Requirement: Each repository has its own stable colour
The board SHALL assign every repository in the snapshot a colour derived deterministically from its repository id, without any configuration. The assignment SHALL be computed over all repositories in the snapshot, independent of the active filters, so that the same set of tracked repositories always yields the same colours across reloads, scans and filter changes. Repositories tracked at the same time SHALL receive distinct colours for up to 19 repositories. The colours a repository can be assigned SHALL exclude the hues the status roles and the brand accent own: every assignable repository hue SHALL differ from every one of those hues by at least 12°, so a repository is never shown in a colour that means "running", "uncommitted", "complete", "needs attention" or "error". The repository colour SHALL be shown on the repository's group header, which encloses its cards, on its entry in the repository filter menu and on its active-filter tag, and on each agent session tab in the dock's tab strip — as an accent on the tab and on the repository name it shows. A session tab whose repository is not in the current snapshot SHALL be shown without a repository colour. The repository colour on a tab MUST NOT replace or obscure the marks that say which sessions are shown and which tab is focused; those marks SHALL stay distinguishable from every assignable repository colour. The colour SHALL adapt to the active theme so that repository-coloured text keeps a contrast ratio of at least 4.5:1 against its background in every supported theme, including the background of the dock's tab strip and of a tab whose session is shown. Colour MUST NOT be the only cue: wherever a repository colour is shown, the repository name SHALL be shown with it. The error styling of a repository's filter menu entry SHALL take precedence over its repository colour.

#### Scenario: Distinct colours
- **WHEN** 17 repositories are tracked
- **THEN** no two of them have the same colour

#### Scenario: Stable across reload and rescan
- **WHEN** the page is reloaded or a scan completes and the set of tracked repositories is unchanged
- **THEN** every repository has the same colour as before

#### Scenario: Filters do not change colours
- **WHEN** the user filters the board to repository `vcs-admin` only
- **THEN** `vcs-admin` group headers, filter menu entry and active-filter tag keep the colour they had with no filter applied

#### Scenario: Colour is consistent across the board
- **WHEN** repository `beta-soc` has cards in three columns
- **THEN** its group headers, around all of its cards, and its filter menu entry all use the same colour, each alongside the name `beta-soc`

#### Scenario: Session tabs carry the repository colour
- **WHEN** the dock shows tabs for sessions of `beta-soc` and of `alpha-infra`
- **THEN** each tab shows its repository's accent and its repository name in that repository's colour, the same colour that repository's cards and group headers use, and both tabs still show the repository name as text

#### Scenario: Filtering the board does not recolour a tab
- **WHEN** the user filters the board to `alpha-infra` only while a `beta-soc` session is in the tab strip
- **THEN** the `beta-soc` tab keeps the colour it had with no filter applied

#### Scenario: Shown and focused marks survive the tint
- **WHEN** a tinted tab's session has a pane in the dock and its tab is the focused one
- **THEN** the tab still shows the mark that says its session is shown and the marking of the focused tab, both distinguishable from the repository colour

#### Scenario: Session of an untracked repository
- **WHEN** a session's repository is switched off in Settings while its tab is in the strip
- **THEN** that tab is shown without a repository colour and stays readable

#### Scenario: Theme change
- **WHEN** the user switches from the dark to the light theme
- **THEN** each repository keeps the same hue, and repository-coloured text remains legible (contrast ≥ 4.5:1) on the light backgrounds, on the board and in the dock's tab strip

#### Scenario: Repository in error
- **WHEN** a tracked repository failed to scan
- **THEN** its entry in the repository filter menu shows the error styling rather than its repository colour

#### Scenario: No repository wears a status colour
- **WHEN** 19 repositories are tracked
- **THEN** every assigned hue is at least 12° away from each of the status role hues and from the brand accent

## ADDED Requirements

### Requirement: Cards show only what an overview needs
A card SHALL show only what an overview needs: the change name in monospace, the relative age of `lastActivityAt` under it (e.g. `updated 3d ago`, or the archive date for an archived change), the change's session status beside the name as the "Cards offer session starters and show session state" requirement gives it, a progress bar with `done/total` when tasks exist, and a footer with the next-step starter and **Show details**, and — when the change has a console — the console quick link beside its session status. A card SHALL additionally show the `no tasks` warning and an error mark for any other warning the snapshot carries. A card SHALL NOT show the repository name — on the combined board every card sits in its repository's group, whose header names it, and a repository board names it in its header — nor the branch badge, the checkouts holding the change, the worktree's work status, the prompt, how long the change has been complete, or which artifacts are written: the change's detail view shows those (change-detail: "Detail header shows the change's state"), and the column says how far the change has come.

The branch badge in the repository board header MUST NOT extend beyond its container at any width. A branch name that fits SHALL be shown in full; one that does not SHALL be shortened in the middle with an ellipsis so that both its beginning and its end remain readable, with the branch glyph visible and the full name as its tooltip and accessible name.

#### Scenario: Card content
- **WHEN** a change `cloud-deployment` in repo `demo-ops` has `tasks 30/30`, last activity 12 days ago and a branch match `feat/cloud-deployment`, and is shown on the combined board
- **THEN** the card sits in the `demo-ops` group and shows `cloud-deployment`, `updated 12d ago`, a full progress bar labelled `30/30` and **Show details**, and shows neither `demo-ops`, the branch, nor a completion badge

#### Scenario: Card with a running session
- **WHEN** a change in `Implementing` has a session whose agent is waiting for the user
- **THEN** its card shows the session's status beside the name, the task progress, and the next step in its footer

#### Scenario: Details live in the detail view
- **WHEN** a change has a `prompt.md`, a worktree with uncommitted files and all of its artifacts written
- **THEN** its card shows none of these, and its detail view shows the prompt, the work status and each artifact's state

#### Scenario: Long branch name in the repository header
- **WHEN** the repository board's current branch is `feat/introduce-tenant-quota-enforcement` and it does not fit
- **THEN** its badge shows the beginning, an ellipsis and `quota-enforcement`, stays inside the header, and presents the full name on hover and to a screen reader

### Requirement: Visual design follows the grey and indigo token set
The UI SHALL define its colours as two token sets sharing the same token names: a dark set (neutral dark grey backgrounds ascending from `#26272b` for the page to `#4b4c51` for the most elevated surface, light enough that the edges between surfaces and every border stay visible; indigo brand `#6366f1`) and a light set (slate backgrounds from `#f8fafc`, with white raised surfaces, indigo brand `#4f46e5`). In the dark theme the background tokens SHALL be near-neutral greys, in the light theme slate greys with at most a slight cool tint; the indigo brand SHALL be used only as an accent (focus, active state, primary actions, progress) and MUST NOT be the resting colour of panel or card borders, nor the colour of any status label; highlighting the border of the card or control under the pointer is an active state and MAY use it. Borders SHALL be neutral: translucent white in the dark theme and translucent slate in the light theme. Both themes SHALL share Inter for text, JetBrains Mono for identifiers, one radius scale (small controls, fields and cards, panels and columns — rounder the larger the element) and one set of shadow tokens, with fonts bundled locally. Component styles MUST reference colour, radius and shadow tokens only and MUST NOT contain literal colour values. In both themes, text and status colours SHALL have a contrast ratio of at least 4.5:1 against the backgrounds they are rendered on, and so SHALL the text of a filled primary button against that button. The token set SHALL keep the status roles, the brand accent and the repository colours in three disjoint colour ranges, so that no status label can be mistaken for a repository accent or for the accent, and no repository can be shown in a colour that means a status. The UI MUST render correctly without network access, and any icon SHALL be drawn from inline markup, be decorative only, and sit beside text that says the same thing — with one exception, the card's console quick link, whose icon carries its meaning in a tooltip and an accessible name.

#### Scenario: Offline rendering
- **WHEN** the dashboard is opened with no network connectivity
- **THEN** fonts, icons and styles render as designed in the active theme with no external requests

#### Scenario: Same layout in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** only colours and shadows change; layout, spacing, typography and radius are identical

#### Scenario: Status badges readable in light theme
- **WHEN** the light theme is active and a card shows success, warning and danger badges
- **THEN** each badge's text has a contrast ratio of at least 4.5:1 against the card background and is still accompanied by a text label

#### Scenario: Dark ground is a neutral grey, not near-black
- **WHEN** the dark theme is active
- **THEN** the page, column, card and panel backgrounds are greys whose red, green and blue channels differ by no more than 6 of 255, the page background is lighter than `#1a1b1e` and darker than `#2a2b2f`, and panel and card borders are neutral rather than indigo

#### Scenario: Borders are visible
- **WHEN** a column or card is rendered in either theme
- **THEN** its border has a contrast ratio of at least 1.3:1 against the ground it edges

#### Scenario: Subtle text readable on dark cards
- **WHEN** the dark theme is active and a card shows heading, body and subtle text
- **THEN** each has a contrast ratio of at least 4.5:1 against the card background

#### Scenario: Status text readable on dark cards
- **WHEN** the dark theme is active and a card shows success, warning and danger badges
- **THEN** each badge's text has a contrast ratio of at least 4.5:1 against the card background

#### Scenario: Primary button is readable
- **WHEN** the **New change** primary button is rendered in either theme
- **THEN** its label has a contrast ratio of at least 4.5:1 against the button's filled background

#### Scenario: Status, brand and repository colours do not overlap
- **WHEN** the colours a repository can be assigned are compared with the status roles and the brand accent
- **THEN** none of them coincides, in either theme, and the `info` role's hue is at least 24° away from the brand accent's

#### Scenario: Icons are never the only cue
- **WHEN** a control or label shows an icon, such as the search field, the New change button or the theme control
- **THEN** the icon is hidden from assistive technology and the control still carries its text or accessible name

### Requirement: The board opens with a header band
The combined board SHALL show a header band above its filter row. It SHALL hold the title `All changes`, the number of open (not archived) changes matching the active filters and the number of changes to archive, each as a labelled count, and the **New change** action as the band's only filled primary button, under the same visibility rules the `change-creation` capability gives it. These counts and the action SHALL NOT also appear in the filter row. On a repository board the repository board header SHALL take the same band styling and show the same two counts for that repository beside its other content. The counts SHALL follow the snapshot and the filters without a reload.

#### Scenario: Band on the combined board
- **WHEN** the combined board shows 14 open changes and 3 changes are complete or synced
- **THEN** the band reads `All changes`, shows `Open 14` and `To archive 3`, and offers **New change** as a filled primary button

#### Scenario: Counts follow the filters
- **WHEN** the user filters the combined board to repository `alpha-infra`, which has 5 open changes
- **THEN** the band's open count reads `5` without a reload

#### Scenario: No eligible repository
- **WHEN** no tracked repository is eligible for a new change
- **THEN** the band shows its title and counts and no **New change** button

#### Scenario: Repository board
- **WHEN** the board for `alpha-infra` is shown
- **THEN** the repository header is drawn as the band and shows the open and to-archive counts of `alpha-infra`, and the filter row holds no counts and no **New change** button

### Requirement: Column headers mark the lifecycle stage
Every column header SHALL show a small lifecycle marker before the column name, followed by the name and the column count in a pill. The marker's colour SHALL mean the kind of column: neutral for `New` and the artifact columns, the brand accent for `Ready` and `Implementing`, the `success` role for `Done` and `Synced`, a muted neutral for `Archived`, and the `warning` role for `Unknown`. The marker SHALL be decorative only and hidden from assistive technology: the column name SHALL remain the cue. The existing highlighting of the `Done` and `Synced` counts and the `Archived` column's `25 of <total>` count SHALL be kept.

#### Scenario: Markers along the lifecycle
- **WHEN** the board shows the columns `New`, `Proposal`, `Design`, `Specs`, `Ready`, `Implementing`, `Done`, `Synced`, `Archived`
- **THEN** `New`, `Proposal`, `Design` and `Specs` carry a neutral marker, `Ready` and `Implementing` an accent marker, `Done` and `Synced` a success marker, and `Archived` a muted one

#### Scenario: Marker is not the only cue
- **WHEN** a screen reader reads a column header
- **THEN** it reads the column name and count and nothing for the marker

### Requirement: The board's filters form one filter bar
The board's filters SHALL be presented as one filter bar below the header band, with the same filters and URL persistence as before: a search field with a leading search icon and, while it holds text, a control that clears it; on the combined board a **Repositories** menu button that shows how many repositories are selected (or `All`) and opens a list of every repository with a checkbox, its colour and name, and its error styling when its last scan failed; a **Stale** selector offering `Any activity` and idle thresholds of 7, 14, 30 and 90 days, which also offers the current threshold when the URL holds another value; a **Hide archived** switch; and **Clear filters** while any filter is active. Each selected repository and an active stale threshold SHALL also appear as a removable tag in the bar, and removing a tag SHALL clear that one filter. The **Lanes**/**Stack** layout switch and the number of changes shown SHALL stay at the bar's end. The menu SHALL close on Escape, on a click outside it and on leaving it with the keyboard, SHALL expose its open state to assistive technology, and every control SHALL be operable by keyboard.

#### Scenario: Selecting repositories
- **WHEN** the user opens **Repositories** and checks `alpha-infra` and `beta-soc`
- **THEN** only their cards are shown, the button reads `2`, the bar shows the tags `alpha-infra` and `beta-soc` in their colours, and the URL holds both

#### Scenario: Removing a tag
- **WHEN** the user removes the `beta-soc` tag
- **THEN** only `alpha-infra` stays selected and the menu shows `beta-soc` unchecked

#### Scenario: Custom threshold from the URL
- **WHEN** the board opens with `?stale=10`
- **THEN** the **Stale** selector shows `Idle 10+ days` selected and the tag `Idle 10+ days` is shown

#### Scenario: Hide archived
- **WHEN** the user turns **Hide archived** on
- **THEN** the `Archived` column is removed and the URL holds `archived=0`, exactly as the former checkbox did

#### Scenario: Clearing the search
- **WHEN** the search field holds `sync` and the user activates its clear control
- **THEN** the field is empty and every card that the other filters allow is shown

### Requirement: Actions have their own area
Wherever a board or the overview offers actions for what it shows — **New change** on the combined board, **Pull**, **Clean up** and **New change** on a repository board — they SHALL sit together in an action area at the end of the header band, separate from titles, counts, checkout chips and badges, at full control size and never squeezed between them. The primary action SHALL be the last and only filled button in that area. When the window is narrow the area SHALL move below the header's content as one group rather than splitting.

#### Scenario: Repository board actions
- **WHEN** the board of `alpha-infra`, a git repository whose last scan succeeded, is shown
- **THEN** **Pull**, **Clean up** and the filled **New change** stand together at the end of its header, apart from its checkout chips and config badges

#### Scenario: Narrow window
- **WHEN** the window is 720px wide
- **THEN** the action area wraps below the title and counts as one group, and every action in it stays fully visible

### Requirement: The dashboard opens with a hero header
Every view SHALL open with a hero header. It SHALL show the product mark and the title `OpenSpec Dashboard` in large type, at least 32px and growing with the window up to 56px, with a one-line tagline under it. The status corner (Open work, scan errors, the theme control, the last-update age and Refresh) SHALL sit in the hero's top-right corner, and the main navigation as large tabs, each with an icon beside its name, SHALL sit below the title. The current view's header band and filter bar SHALL continue on the hero's ground, a soft accent glow with a faint dot grid that fades out before the board, so that title, navigation, view header and filters read as one header; a line SHALL close the hero off from the board. The hero's decoration SHALL be drawn from theme tokens, be purely decorative, and SHALL NOT reduce the contrast of any text in it below the rules of the token set. On narrow windows the status corner SHALL move below the title and the title SHALL shrink, without horizontal scrolling.

#### Scenario: Hero on the combined board
- **WHEN** the combined board is opened in a 1920px wide window
- **THEN** the page shows the mark and `OpenSpec Dashboard` in type of at least 48px, the tagline, the status corner at the top right, the navigation tabs with icons, and then `All changes` with its counts, **New change** and the filter bar on the same glowing ground

#### Scenario: Every view has the hero
- **WHEN** the user moves to Settings or Activity
- **THEN** the same hero with its title and navigation is shown above the view

#### Scenario: Narrow window
- **WHEN** the window is 720px wide
- **THEN** the title is smaller but still the largest text on the page, the status corner sits below it, and nothing scrolls horizontally

### Requirement: The product has its own mark
The dashboard SHALL show its own product mark instead of a generic icon: a ring of four arcs — the four stages of a change — fading behind a leading arc that ends in a bright dot, around a small rounded square, on a rounded accent-gradient tile. The mark in the page SHALL be drawn in the theme's accent tokens and be hidden from assistive technology, as the product name stands beside it. The page SHALL carry the same mark as its favicon, embedded in the page itself so no request is made for it.

#### Scenario: Favicon without a request
- **WHEN** the dashboard is opened offline
- **THEN** the browser tab shows the mark, and no request for an icon is made

#### Scenario: One mark
- **WHEN** the favicon and the mark in the hero are compared
- **THEN** they are the same drawing

### Requirement: The board fits half a screen
The board SHALL offer two layouts of the same columns and cards: **Lanes**, the columns side by side, and **Stack**, each column a full-width section whose repository groups (or, on a repository board, cards) flow in a grid, with the page scrolling vertically so the hero scrolls away. By default the layout SHALL follow the window: **Stack** below 1280px wide, **Lanes** otherwise, switching live as the window is resized. A **Lanes**/**Stack** switch in the filter bar SHALL mark the layout on screen and SHALL make an explicit choice that overrides the default and persists in the URL (`layout=lanes` or `layout=stack`); an unknown value SHALL mean the default. The layout SHALL NOT be a filter: it changes no card or count, and **Clear filters** keeps it. In **Lanes**, a column without cards SHALL shrink to a slim rail that still shows its name and count, and lanes SHALL be narrower on windows narrower than 1600px. Grouping, minimizing, counts, the archived bound and every card's content SHALL be the same in both layouts.

#### Scenario: Half a screen
- **WHEN** the combined board is opened in a window 960px wide
- **THEN** the columns are stacked sections, the cards of each column's repository groups sit side by side in a grid, nothing scrolls horizontally, and the switch marks **Stack**

#### Scenario: Explicit choice
- **WHEN** the user activates **Lanes** in a 960px window
- **THEN** the columns are shown side by side, the URL holds `layout=lanes`, and a reload keeps lanes

#### Scenario: Empty lane
- **WHEN** the `Design` column has no cards in the lanes layout
- **THEN** it is a slim rail showing `Design` and `0`, and the other lanes get the width

#### Scenario: Clearing filters keeps the layout
- **WHEN** the board holds `layout=stack` and a text search and the user activates **Clear filters**
- **THEN** the search is cleared and the board stays stacked

