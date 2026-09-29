# change-detail Specification

## Purpose
Lets the user read one change's OpenSpec artifacts inside the dashboard — its proposal, design, delta specs and tasks — without leaving the board and opening files in the repository by hand.

## Requirements

### Requirement: Change detail route
The UI SHALL provide a client-side route `/repo/<repoId>/change/<changeName>` that shows exactly one change of one tracked repository, for active and archived changes alike. The repository id and the change name SHALL be URL-encoded in the path and decoded when the route is parsed. A path that cannot be decoded, or that names a repository or change absent from the current snapshot, SHALL render a "not found" state that names what was asked for and offers a link to the projects overview; it MUST NOT render a blank page or throw.

The route SHALL work in both routing modes the UI supports (path routing on the dashboard server, hash routing on static hosting).

#### Scenario: Opening a change
- **WHEN** the user opens `/repo/<id>/change/cloud-deployment` for a repository in the snapshot that has a change `cloud-deployment`
- **THEN** the detail view for that change is shown

#### Scenario: Archived change
- **WHEN** the user opens the detail route for a change that is archived
- **THEN** the detail view is shown with its archived state, like any other change

#### Scenario: Unknown change
- **WHEN** the user opens the detail route for a change name that is not in the snapshot
- **THEN** a "not found" message naming the repository and the change is shown together with a link back to the overview

#### Scenario: Hash routing
- **WHEN** the UI runs in hash routing mode and the user opens `index.html#/repo/<id>/change/cloud-deployment`
- **THEN** the same detail view is shown

### Requirement: Detail header shows the change's state
The detail view SHALL show, above the artifacts: the change name in monospace, the repository name linking to that repository's board, a close control, and every warning the snapshot carries for the change. Below them it SHALL show the change's state and whereabouts that the card on the board leaves out: its column; its task progress as a bar with `done/total` when tasks exist; the relative age of its last activity, or its archive date when archived; how long it has been complete when it is in `Done` or `Synced`; its branch badge when `branchMatch` is set, whose tooltip names the worktree the data comes from and lists the other checkouts holding a copy with their branch and column; for an archive found only in a linked worktree, a badge naming the branch that holds it and stating that the main checkout does not have it yet, with a tooltip listing the checkouts still holding an active copy and how to resolve it; when agent sessions apply and a session worktree exists for the change, the work-status badge (uncommitted files, commits not pushed, `pushed` or `merged`, highlighted as stale by the same rules as before), which opens the change's Console tab; and the text of its `prompt.md`, without the heading the create form writes, as plain text that scrolls when long. Status SHALL be conveyed by text as well as colour. All of these SHALL come from the existing snapshot; the detail view MUST NOT introduce facts about a change that the snapshot does not carry, and it SHALL NOT show the change's creation date or schema. For a change that is gone from the snapshot but whose worktree remains, the header SHALL show only its name, the repository and the close control.

#### Scenario: Header content
- **WHEN** a change `cloud-deployment` of repository `demo-ops` is in `Implementing` with `tasks 4/12`, created `2026-03-02`, last activity 3 days ago and `branchMatch: feat/cloud-deployment`
- **THEN** the header shows `cloud-deployment`, `demo-ops` as a link to that repository's board, a close control, `Implementing`, a progress bar with `4/12`, `updated 3d ago` and the branch badge `feat/cloud-deployment`, and shows neither the creation date nor the schema

#### Scenario: Worktree and other checkouts
- **WHEN** `audit-trail` is `Implementing` in a worktree on `feat/audit-trail` and `Proposal` in the main checkout
- **THEN** its detail header shows the badge `feat/audit-trail`, whose tooltip names the worktree path and lists the main checkout with `Proposal`

#### Scenario: Work status
- **WHEN** a change's session has ended and its worktree holds 3 uncommitted files
- **THEN** the detail header shows "3 uncommitted", and activating it opens the Console tab

#### Scenario: Pending archive
- **WHEN** `audit-trail` is archived only in a worktree on `chore/archive-audit-trail`
- **THEN** its detail header names `chore/archive-audit-trail` and says the main checkout does not have the archive yet

#### Scenario: Prompt
- **WHEN** the change has a `prompt.md` reading `# Prompt`, an empty line and `Log every mutation`
- **THEN** the header shows `Log every mutation` as plain text, without the heading

#### Scenario: Warnings are surfaced
- **WHEN** the snapshot carries a warning for the change
- **THEN** the warning text is shown in the header

#### Scenario: Archived change
- **WHEN** the detail view is open for an archived change
- **THEN** its artifacts are shown like any other change's, and the header shows its archive date

### Requirement: The console is a tab of the detail view
Whenever agent sessions apply to the change's repository — agent sessions on and the repository not excluded — the
detail view SHALL offer a **Console** tab beside the artifact tabs, after them, as the last tab of the strip, whether or
not the change has ever had a session. The tab SHALL be selectable whenever it is offered, whatever state the change's
artifacts are in, and MUST NOT carry an artifact state label.

Selecting it SHALL show the selected session's terminal — what the agent printed, as it printed it, with what the
terminal has shown so far before it follows live — together with the session's change, repository, agent, worktree path
and branch, its state, its default responses and its actions: End session or Clean up, Resume when available, Delete
record for an ended session, and "Copy cd" for the worktree. The terminal SHALL be coloured from the dashboard's theme
tokens and SHALL load nothing from the network. It SHALL follow the size of the panel, and SHALL be the part of the
overlay that scrolls, so the page behind it does not move.

With no session to show the tab SHALL say why and leave the user something to do: for a change whose session worktree
has outlived its session record, that there is no terminal to show while its work is still there, with the worktree's
path and a `cd` to copy; for a change that has neither a session nor a session worktree, that no agent has worked on it
yet, together with the starters its stage allows. Neither state SHALL show a terminal, and neither MUST be reported as
an error.

When agent sessions are off for the repository, or the repository is excluded from them, no Console tab SHALL be shown
and the detail view MUST look and behave as it did before.

#### Scenario: A change with a session
- **WHEN** the user opens the detail view of a change whose Implement session is running
- **THEN** the tab strip shows `Proposal`, `Design`, `Specs`, `Tasks` and `Console`, and selecting `Console` shows that
  session's terminal with its earlier output, its worktree path and branch, and its actions

#### Scenario: Console is selectable while artifacts are not
- **WHEN** a change has a running session and no artifact file at all
- **THEN** every artifact tab is unselectable and the `Console` tab is selectable and shows the terminal

#### Scenario: A change no agent has worked on
- **WHEN** the user opens the Console tab of a change in `Ready` that has neither a session nor a session worktree
- **THEN** the tab says that no agent has worked on this change yet, offers **Implement**, shows no terminal and reports
  no error

#### Scenario: Starting from the empty console
- **WHEN** the user activates that **Implement** starter
- **THEN** a session starts for the change and the same Console tab shows its terminal

#### Scenario: A worktree without a session record
- **WHEN** the change's session record is gone and its worktree still holds uncommitted work
- **THEN** the Console tab says there is no terminal to show, names the worktree's path and offers a `cd` to copy

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no detail view shows a `Console` tab

#### Scenario: Long output scrolls in the terminal
- **WHEN** the agent has printed more than fits the panel
- **THEN** the output scrolls inside the terminal and the board behind the overlay does not move

### Requirement: The console tab offers the change's next step
The Console tab SHALL be the place the dashboard offers a change's next step while its session runs. For the selected
session it SHALL offer the starters of the change's current stage whose prompt would go into that very session — Draft
and Implement for a session in the change's own worktree — labelled and described as sending the prompt to the running
session, and MUST NOT ask the user for a further key press. When the prompt was typed but not submitted, the tab SHALL
say so as it does for any other text sent on the user's behalf. Archive SHALL open its own session as before, and no
starter SHALL be offered for a session that a prompt cannot reach.

For a change with no session and no session worktree the tab SHALL offer the starters its stage allows as openings for
a new session, disabled with an explanation when the repository's agent is not found on this machine.

#### Scenario: Draft finished, Implement next
- **WHEN** a Draft session is still running, the change has moved to `Ready`, and its Console tab is open
- **THEN** the tab offers **Implement**, saying it sends the prompt to this session, and activating it types that prompt
  into the terminal without asking the user for another key press

#### Scenario: The prompt was not sent
- **WHEN** the next step is sent to a session whose agent never shows the typed prompt
- **THEN** the Console tab says that the text was typed but not sent, and the session keeps running

#### Scenario: Nothing a prompt can reach
- **WHEN** the selected session is the change's Archive session
- **THEN** the tab offers no next-step starter for it

#### Scenario: The agent is missing
- **WHEN** a change has no session and the repository's agent executable is not found
- **THEN** the Console tab's starters are disabled and say that the agent was not found

### Requirement: Artifacts are browsable as tabs
The detail view SHALL show one tab per artifact of the change's schema, in the schema's artifact order, labelled with the artifact's display name, and — when agent sessions apply to the change's repository — the Console tab after them. Each artifact tab SHALL show the artifact's state (`done`, `ready` or `blocked`). An artifact tab whose artifact has no file yet SHALL NOT be selectable; selecting it SHALL be impossible and its state SHALL be readable from the tab.

An artifact that resolves to more than one file — the delta specs under `specs/**` — SHALL additionally show a list of its files, by path relative to the change directory, with the first file selected by default. Selecting a file SHALL show that file.

The selected tab and the selected file SHALL be part of the URL, so the view can be linked to and survives a reload. A URL naming an artifact or a file that does not exist SHALL fall back to the first artifact that has content, without an error; a URL naming the Console tab for a change whose repository agent sessions do not apply to SHALL fall back the same way.

#### Scenario: Tabs in schema order
- **WHEN** a `spec-driven` change has `proposal` and `specs` done, `design` ready and `tasks` blocked
- **THEN** the view shows the tabs `Proposal`, `Specs`, `Design`, `Tasks` in the schema's order, with `Design` and `Tasks` not selectable and labelled `ready` and `blocked`

#### Scenario: Console comes last
- **WHEN** that change's repository has agent sessions enabled
- **THEN** `Console` is shown after `Tasks` and carries no artifact state

#### Scenario: Delta specs file list
- **WHEN** the selected artifact is `specs` and the change has `specs/dashboard-api/spec.md` and `specs/kanban-board/spec.md`
- **THEN** both paths are listed, the first is selected, and selecting the second shows its content

#### Scenario: Selection is linkable
- **WHEN** the user selects the `specs` artifact and its file `specs/kanban-board/spec.md` and reloads the page
- **THEN** the same artifact and file are selected again

#### Scenario: Stale link
- **WHEN** a URL names an artifact or a file that the change does not have
- **THEN** the first artifact with content is shown and no error is reported

#### Scenario: Console in the URL with the feature off
- **WHEN** a URL names the Console tab for a change in a repository agent sessions do not apply to
- **THEN** the first artifact with content is shown and no error is reported

### Requirement: Artifact content is rendered as Markdown
The selected file's content SHALL be rendered as Markdown, supporting at least headings, paragraphs, ordered and unordered lists, nested lists, task list items, tables, fenced and inline code, block quotes, horizontal rules, emphasis, strong emphasis and links. Rendering SHALL happen entirely in the browser from the file's text; no Markdown is rendered on the server.

#### Scenario: Structured document
- **WHEN** a spec file containing headings, a table, a fenced code block and nested lists is shown
- **THEN** each of those is rendered as the corresponding structure, not as literal Markdown source

#### Scenario: Code is not reflowed
- **WHEN** a fenced code block is shown
- **THEN** its content keeps its line breaks and leading whitespace in a monospace font

### Requirement: Repository content is treated as untrusted
Artifact content comes from tracked repositories and MUST be treated as untrusted input. The renderer MUST NOT interpret raw HTML in the Markdown source: HTML tags SHALL either be shown as text or be dropped, and MUST NOT become elements, attributes, scripts, styles or event handlers in the page. The renderer MUST NOT load any remote resource — images, scripts, stylesheets, fonts or frames — from artifact content, whatever the source says.

A link in artifact content SHALL be rendered as a link only when its target uses `http:`, `https:` or `mailto:`, or is relative; any other target (including `javascript:` and `data:`) SHALL be rendered as plain text. Rendered links SHALL open in a new tab and SHALL NOT send a referrer or expose the opener.

#### Scenario: Script tag in an artifact
- **WHEN** a proposal contains `<script>alert(1)</script>` or `<img src=x onerror=alert(1)>`
- **THEN** no script runs, no request is made, and no element with an event handler is created

#### Scenario: Markdown image
- **WHEN** an artifact contains `![diagram](https://example.com/a.png)`
- **THEN** no request to `example.com` is made and the image is not embedded

#### Scenario: Dangerous link target
- **WHEN** an artifact contains `[click](javascript:alert(1))`
- **THEN** the text is shown without a link

#### Scenario: External link
- **WHEN** an artifact contains `[docs](https://example.com/docs)`
- **THEN** the link opens in a new tab without sending a referrer and without giving the opened page access to the dashboard window

### Requirement: Raw source can be shown
The detail view SHALL offer a toggle that shows the selected file's source text verbatim in a monospace block instead of the rendered Markdown, and back. The choice SHALL apply to whichever file is selected.

#### Scenario: Toggle to raw
- **WHEN** the user turns the raw toggle on
- **THEN** the file's source text is shown unrendered, with its Markdown syntax visible

#### Scenario: Raw survives a file change
- **WHEN** the raw toggle is on and the user selects another file
- **THEN** that file is also shown as raw source

### Requirement: Tasks are shown as a read-only checklist
When the tasks artifact is selected, its task list SHALL be rendered as checkboxes reflecting each task's ticked state, together with the same `done/total` progress the card shows. The checkboxes MUST NOT be operable: the dashboard MUST NOT write a change to the repository from this view.

#### Scenario: Checklist
- **WHEN** the tasks artifact has 12 tasks of which 4 are ticked
- **THEN** 12 checkboxes are shown with the first-ticked 4 checked and `4/12` is shown

#### Scenario: Not editable
- **WHEN** the user clicks a checkbox in the tasks view
- **THEN** nothing is sent to the server and the repository is unchanged

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

### Requirement: The detail view follows the regular refresh
The detail view SHALL take the change's header information from the same snapshot the boards use and SHALL re-read the selected file's content on the same poll interval, so that ticking a task or editing an artifact on disk becomes visible without a manual reload. The selected artifact, the selected file, the raw toggle and the scroll position MUST NOT be reset by a refresh that does not change the content.

#### Scenario: Task ticked on disk
- **WHEN** a task is ticked in the repository while the tasks artifact is shown
- **THEN** the checklist and the progress update on the next poll without a page reload

#### Scenario: Refresh keeps the view
- **WHEN** a poll returns unchanged content while the user is reading the third spec file
- **THEN** the same file stays selected and the view does not jump

#### Scenario: Artifact added on disk
- **WHEN** an artifact file is created in the repository while the detail view is open
- **THEN** its tab becomes selectable after the next scan

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
