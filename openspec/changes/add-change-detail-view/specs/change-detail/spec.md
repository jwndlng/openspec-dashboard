# Spec Delta

## Purpose

Lets the user read one change's OpenSpec artifacts inside the dashboard — its proposal, design, delta specs and tasks — without leaving the board and opening files in the repository by hand.

## ADDED Requirements

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

The detail view SHALL show, above the artifacts: the change name in monospace, the repository name linking to that repository's board, the column the change is in, its task progress as `done/total` with a progress bar when tasks exist, the relative age of its last activity, its creation date and — when archived — its archive date, a branch badge when `branchMatch` is set, and every warning the snapshot carries for the change. All of these SHALL come from the existing snapshot; the detail view MUST NOT introduce facts about a change that the snapshot does not carry.

#### Scenario: Header content

- **WHEN** a change `cloud-deployment` of repository `demo-ops` is in `Implementing` with `tasks 4/12`, created `2026-03-02`, last activity 3 days ago and `branchMatch: feat/cloud-deployment`
- **THEN** the header shows `cloud-deployment`, `demo-ops` as a link to that repository's board, `Implementing`, a progress bar labelled `4/12`, `3d ago`, the creation date and the branch badge

#### Scenario: Warnings are surfaced

- **WHEN** the snapshot carries a warning for the change
- **THEN** the warning text is shown in the header

### Requirement: Artifacts are browsable as tabs

The detail view SHALL show one tab per artifact of the change's schema, in the schema's artifact order, labelled with the artifact's display name. Each tab SHALL show the artifact's state (`done`, `ready` or `blocked`). A tab whose artifact has no file yet SHALL NOT be selectable; selecting it SHALL be impossible and its state SHALL be readable from the tab.

An artifact that resolves to more than one file — the delta specs under `specs/**` — SHALL additionally show a list of its files, by path relative to the change directory, with the first file selected by default. Selecting a file SHALL show that file.

The selected artifact and the selected file SHALL be part of the URL, so the view can be linked to and survives a reload. A URL naming an artifact or a file that does not exist SHALL fall back to the first artifact that has content, without an error.

#### Scenario: Tabs in schema order

- **WHEN** a `spec-driven` change has `proposal` and `specs` done, `design` ready and `tasks` blocked
- **THEN** the view shows the tabs `Proposal`, `Specs`, `Design`, `Tasks` in the schema's order, with `Design` and `Tasks` not selectable and labelled `ready` and `blocked`

#### Scenario: Delta specs file list

- **WHEN** the selected artifact is `specs` and the change has `specs/dashboard-api/spec.md` and `specs/kanban-board/spec.md`
- **THEN** both paths are listed, the first is selected, and selecting the second shows its content

#### Scenario: Selection is linkable

- **WHEN** the user selects the `specs` artifact and its file `specs/kanban-board/spec.md` and reloads the page
- **THEN** the same artifact and file are selected again

#### Scenario: Stale link

- **WHEN** a URL names an artifact or a file that the change does not have
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

Each board card SHALL open the detail view for its change. The detail view SHALL offer a way back to the board it was opened from with that board's filters intact; when the detail view was opened directly by URL, it SHALL link to the board of its repository. Opening a card in a new tab or window SHALL land on the same detail view.

#### Scenario: From a filtered board

- **WHEN** the user has filtered the combined board to a text search and opens a card, then uses the back link
- **THEN** the combined board is shown again with the same search applied

#### Scenario: Opened by URL

- **WHEN** the detail view is opened directly from a pasted URL
- **THEN** the back link leads to the board of that change's repository

#### Scenario: New tab

- **WHEN** the user middle-clicks or ⌘-clicks a card
- **THEN** a new tab opens on that change's detail view

### Requirement: Copy actions in the detail view

The detail view SHALL offer the "Copy apply command" action that cards offer (with the same command, so for a change that lives in a linked worktree it targets that worktree), a "Copy cd command" action that copies `cd <repoPath>`, and a "Copy file path" action that copies the absolute path of the selected file. The dashboard MUST NOT execute any of them.

#### Scenario: Copy the file path

- **WHEN** the file `specs/kanban-board/spec.md` of change `multi-tenant-sync` in `/w/acme/forum-admin` is selected and the user clicks "Copy file path"
- **THEN** the clipboard contains `/w/acme/forum-admin/openspec/changes/multi-tenant-sync/specs/kanban-board/spec.md`

#### Scenario: Copy apply command

- **WHEN** the user clicks "Copy apply command" on the detail view of `multi-tenant-sync` in `/w/acme/forum-admin`
- **THEN** the clipboard contains `cd /w/acme/forum-admin && claude "/opsx:apply multi-tenant-sync"`

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

When the selected file cannot be read, the view SHALL show a message naming the file and the reason, and the rest of the view SHALL stay usable. When the file exceeds the server's size cap, the view SHALL say so and offer the copy-file-path action instead of the content. When a change has no artifact file at all, the view SHALL show its header with an explanation that nothing has been written yet.

#### Scenario: File too large

- **WHEN** the selected file exceeds the server's size cap
- **THEN** the view explains that the file is too large to display and offers "Copy file path"

#### Scenario: Read error

- **WHEN** the server answers with an error for the selected file
- **THEN** the reason is shown in the content area and the tabs, header and copy actions remain usable

#### Scenario: Nothing written yet

- **WHEN** a change directory exists with no artifact file
- **THEN** the header is shown and the content area explains that this change has no artifacts yet
