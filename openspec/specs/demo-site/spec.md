# demo-site Specification

## Purpose
Defines the public demo of the dashboard: a build of the real UI on an in-memory mock API with synthetic sample data, the guarantees that no data from anyone's machine can appear in it, server-less navigation, screenshot generation from the demo build only, and publishing to GitHub Pages with the README entry points.

## Requirements

### Requirement: The demo is the real UI on a mock API
The project SHALL provide a demo build, produced by `bun run build:demo`, that renders the same UI components, styles and views as the normal build but obtains all data from an in-memory mock API instead of HTTP. The output SHALL be a single self-contained `dist/demo/index.html` that makes no network requests and works when served from a site root, from a sub-path, and when opened directly from disk. The normal UI bundle and the compiled binary MUST NOT contain the demo code or its sample data.

#### Scenario: Opened from disk
- **WHEN** `dist/demo/index.html` is opened via `file://` with no network connectivity
- **THEN** the Projects overview renders with the sample repositories, fonts and styles, and no request leaves the page

#### Scenario: Served from a sub-path
- **WHEN** the demo is served at `https://example.org/openspec-dashboard/`
- **THEN** every view is reachable and no navigation leaves that sub-path

#### Scenario: Production bundle is free of demo data
- **WHEN** `bun run build:ui` has run
- **THEN** `dist/ui/index.html` contains neither the demo marker nor any sample repository name

### Requirement: Demo data is synthetic and never read from a machine
All data shown by the demo SHALL come from a sample dataset checked into the repository. The demo build and the demo at runtime MUST NOT read the dashboard's config, its snapshot cache, the file system or any HTTP API. Every repository path in the sample SHALL be under the fictional prefix `/home/demo/`. Session records, agent profiles and terminal transcripts are part of the sample: they SHALL be written by hand for the demo and MUST NOT be captured from a real session, machine or repository. Automated tests SHALL fail if the sample, the seeded sessions, any transcript or the built demo contains a string that looks like a real home directory (`/Users/<name>`, `/home/<name other than demo>`, `C:\Users\<name>`), and SHALL additionally fail if the seeded sessions or any transcript contain an e-mail address, a URL or host name other than the project's own repository and pages hosts. The demo's agent profile SHALL be fictional and vendor-neutral.

#### Scenario: Sample paths are fictional
- **WHEN** the test suite inspects the sample dataset
- **THEN** every repository and worktree path starts with `/home/demo/`

#### Scenario: A real path slips in
- **WHEN** a sample entry is given the path `/Users/alice/Workspace/secret-repo`
- **THEN** `bun run check` fails

#### Scenario: Real terminal output is pasted into a transcript
- **WHEN** a transcript line contains `alice@corp.example` or `https://git.corp.example/team/repo`
- **THEN** `bun run check` fails

#### Scenario: Transcripts use the session's own names
- **WHEN** a transcript is played for a session of change `add-rate-limiting`
- **THEN** every change name, branch and path it prints is that session's own, taken from the sample

### Requirement: The sample showcases the dashboard and stays fresh
The sample SHALL contain at least five repositories and enough changes that every board column has at least one card, including a change with a branch match, a change with the "no tasks" warning, a change with a load warning, a repository whose scan failed, and more than 25 archived changes. Column and stage of each sample change SHALL be derived by the same rules the scanner uses. The sample SHALL also show, on first load and without any action by the visitor: agent sessions in every state the UI distinguishes (running with recent output, running but quiet, ended, failed to start); session worktrees in every work status (`uncommitted`, `unpushed`, `pushed`, `merged`, `clean`), including one that is stale and one whose session record is gone; and shared-config profiles carried by several repositories, at least one of them `outdated`. Sessions, their worktrees and their branches SHALL refer to changes, paths and branches that exist in the sample. All dates in the sample, including session start, last output and work-status ages, SHALL be expressed relative to the moment the demo loads, so relative ages do not grow as the published demo gets older.

#### Scenario: Every column is populated
- **WHEN** the combined board of the demo is shown with no filters
- **THEN** every column has at least one card and `Archived` shows `25 of <total>`

#### Scenario: Ages do not drift
- **WHEN** the demo is opened six months after it was built
- **THEN** a change defined as "3 days old" still shows `3d ago`

#### Scenario: Work in progress is visible at first sight
- **WHEN** the demo is opened and nothing has been clicked
- **THEN** at least one card shows a running session, the detail views of changes with session worktrees show work-status badges for uncommitted, unpushed, pushed and merged work, the top bar shows "Open work" with a count, and Projects shows repositories carrying shared-config profiles with one marked outdated

#### Scenario: Session data matches the board
- **WHEN** the test suite inspects the seeded sessions
- **THEN** every session's repository, change, branch and worktree path exist in the sample snapshot

#### Scenario: Session times do not drift
- **WHEN** the demo is opened six months after it was built
- **THEN** the session defined as "quiet for 12 minutes" still reads as quiet for 12 minutes and the stale worktree is still two days stale

### Requirement: The mock API lets the UI be explored without saving anything
The mock API SHALL implement every API operation the UI uses, including the stream of a session's terminal, and adding an operation to the UI's API interface without a demo implementation SHALL fail type checking. A scan SHALL complete and update the snapshot time so that Refresh finishes. Config edits SHALL apply for the current page session only and SHALL be gone after a reload. Discovery SHALL return canned candidates that are not already tracked. Session operations SHALL be simulated in memory rather than refused, and SHALL be gone after a reload. The demo SHALL show a persistent banner stating that the data is sample data, that agent sessions are simulated, and that nothing is saved, with a link to the repository.

#### Scenario: Refresh completes
- **WHEN** the user clicks Refresh in the demo
- **THEN** the button returns to its idle state within two seconds and the header shows `updated just now`

#### Scenario: Settings edits are not persisted
- **WHEN** the user disables a repository in the demo's Settings, saves, and reloads the page
- **THEN** the repository disappears from the board after saving and is back after the reload

#### Scenario: Missing demo operation
- **WHEN** a developer adds `createChange` to the API interface and implements it only for HTTP
- **THEN** `bun run typecheck` fails until the demo API implements it

#### Scenario: Session actions are not persisted
- **WHEN** the visitor starts a session, ships another and removes a merged worktree, and then reloads the page
- **THEN** the seeded sessions and worktrees are back exactly as on first load

### Requirement: Demo navigation works without a server
In the demo build, routes SHALL be carried in the URL fragment (`#/board`, `#/repo/<id>`, `#/settings`), while filter and overview state SHALL continue to persist in the query string. Reloading or sharing a demo URL SHALL restore the same view and filters. Updating filters MUST NOT discard the current route. The normal build SHALL keep its existing path-based URLs unchanged.

#### Scenario: Deep link into the demo
- **WHEN** `index.html?q=terraform#/board` is opened
- **THEN** the combined board is shown with the search filter `terraform` applied

#### Scenario: Filter change keeps the route
- **WHEN** the user is on `#/repo/<id>` and toggles "hide archived"
- **THEN** the URL still ends in `#/repo/<id>` and a reload shows the same repository board with archived hidden

#### Scenario: Normal build unchanged
- **WHEN** the user opens `/board?repos=a,b` on the locally running dashboard
- **THEN** the combined board opens filtered to those repositories, exactly as before

### Requirement: Screenshots come only from the demo build
`bun run screenshots` SHALL render the demo build in a headless browser at a fixed viewport and write at least a dark-theme and a light-theme image of the combined board to `dist/demo/screenshots/`. The script SHALL take its input exclusively from `dist/demo/index.html`: it MUST NOT start the dashboard server and MUST NOT accept a URL of a running dashboard. It SHALL fail with a clear message when no Chrome/Chromium is found or when an expected image was not produced. Screenshots published in the README or on the demo site SHALL be produced by this script.

#### Scenario: Both themes
- **WHEN** `bun run build:demo && bun run screenshots` is run on a machine with Chrome installed
- **THEN** `dist/demo/screenshots/board-dark.png` and `board-light.png` exist, show the sample board in the respective theme, and `git status --porcelain` is empty

#### Scenario: No browser available
- **WHEN** no Chrome or Chromium can be found
- **THEN** the script exits non-zero and names the `CHROME_BIN` variable as the way to point it at one

### Requirement: The demo is published and linked from the README
On every push to `main`, the demo build and its screenshots SHALL be published to GitHub Pages. No generated demo file or screenshot SHALL be committed to the repository. The README SHALL, near the top, link to the live demo and embed the board screenshot from the published site, choosing the dark or light image according to the reader's colour scheme, with meaningful alternative text.

#### Scenario: Demo follows main
- **WHEN** a UI change is merged to `main`
- **THEN** the published demo and screenshots reflect it after the deploy workflow finishes, with no further commit

#### Scenario: README entry points
- **WHEN** a visitor opens the repository page with a dark GitHub theme
- **THEN** the README shows the dark board screenshot and a "Live demo" link that opens the published demo

### Requirement: Agent sessions are enabled and simulated in the demo
The demo SHALL start with agent sessions enabled and one fictional agent profile reported as available, so that session starters, the running badge, work-status badges, the Open work list and Ship are visible without the visitor changing any setting. The visitor MAY switch agent sessions off in the demo's Settings for the current page session. Starting a session for a card SHALL be validated as the dashboard validates it (tracked repository, existing unarchived change, action available in the change's stage, one open session per change) and SHALL create a running session in memory. Resume, Ship, close, delete, worktree status and worktree removal SHALL behave as in the dashboard from the UI's point of view: Ship SHALL be refused unless the worktree's work status is shippable and SHALL end with the work status `pushed`; removing a worktree SHALL be refused, with a reason, while it holds uncommitted or unpushed work. The demo MUST NOT start a process, open a network connection or write anywhere for any of this.

#### Scenario: Sessions are on by default
- **WHEN** the demo is opened for the first time
- **THEN** Settings shows agent sessions as enabled with the agent "Demo Agent" available, and cards offer session starters

#### Scenario: Switching sessions off
- **WHEN** the visitor switches agent sessions off in Settings and saves
- **THEN** starters, session badges and the Open work control disappear, and are back after a reload

#### Scenario: Starting a session
- **WHEN** the visitor starts Implement on a card in `Ready`
- **THEN** the card shows a running session, the session panel opens with a terminal, and starting it again returns the same session

#### Scenario: Action not available
- **WHEN** Implement is requested for a change that is still at `Proposal`
- **THEN** the request is refused with the same reason the dashboard gives

#### Scenario: Ship
- **WHEN** the visitor presses Ship on an ended session with 3 uncommitted files
- **THEN** the terminal plays a commit, push and pull-request transcript and the work status becomes `pushed`

#### Scenario: Unsafe removal is refused
- **WHEN** the visitor closes a session whose worktree has unpushed commits and asks to remove the worktree
- **THEN** the session ends, the worktree is kept, and the reason is shown

#### Scenario: Nothing leaves the page
- **WHEN** any session operation is used in the demo
- **THEN** no process is started and no network request is made

### Requirement: The session terminal plays a scripted recording
In the demo, a session's terminal SHALL show a hand-written transcript played into the same terminal view the dashboard uses, with pauses between outputs. Opening the terminal of a session that has been running for some time SHALL show the output up to that point at once and continue from there rather than start over. A transcript MAY stop at a question; it SHALL continue when the visitor sends a line of input — Enter, with or without text before it — and any other input, typed or inserted by a quick-reply button (which types its text and leaves Enter to the visitor, as in the dashboard), SHALL be echoed without further effect. When a transcript ends, the session SHALL end as a session whose agent exited. Closing the panel SHALL stop playback without leaving timers behind. The terminal SHALL state at its top that it is a demo recording and that nothing runs on the page.

#### Scenario: Reopening a running session
- **WHEN** the visitor opens the panel of a session that started four minutes ago
- **THEN** four minutes' worth of transcript is already in the scrollback and new lines keep arriving

#### Scenario: Answering a question
- **WHEN** a transcript waits at "Allow editing src/settings/layout.ts?", the visitor presses the "Yes, go ahead" quick reply and then Enter
- **THEN** the reply's text appears at the question after the button press, and playback continues with the next output after Enter

#### Scenario: End of a transcript
- **WHEN** a transcript reaches its end
- **THEN** the terminal reports that the agent exited and the session is shown as ended

#### Scenario: Labelled as a recording
- **WHEN** any demo terminal is opened
- **THEN** its first line says that it is a demo recording and that nothing runs on the page

### Requirement: Pull is simulated in the demo
The demo's mock API SHALL implement the pull operations in memory without any network access or process: a pull SHALL complete after a short delay with a canned outcome derived from the sample — a fast-forward for repositories on their default branch, "fetched only" for repositories whose main checkout is on another branch — and "Pull all" SHALL return one outcome per git repository in the sample. The sample SHALL contain at least one repository whose main checkout is not on its default branch, so that the notice is shown on first load. Outcomes SHALL NOT persist across a reload.

#### Scenario: Pull in the demo
- **WHEN** the visitor activates Pull for a sample repository on its default branch
- **THEN** the control shows that it is running and then a fast-forward outcome, and no network request is made

#### Scenario: Notice in the demo
- **WHEN** the demo is opened
- **THEN** the sample repository whose main checkout is on a feature branch shows the not-on-default-branch notice, and pulling it reports that it was only fetched

### Requirement: The main console is simulated in the demo
While agent sessions are enabled in the demo, the top bar SHALL show the main console control. Opening the console
SHALL create a console session in memory, subject to the same one-at-a-time rule, and its terminal SHALL play a short
hand-written, vendor-neutral transcript under the same rules as every demo transcript: labelled as a recording,
continuing on a line of input, and ending as an exited agent. The console's folder in the demo SHALL be under
`/home/demo/`. The demo MUST NOT start a process, open a network connection or write anywhere for it.

#### Scenario: Opening the demo console
- **WHEN** the visitor activates the main console control in the demo
- **THEN** the console overlay opens and its terminal starts with the line saying it is a demo recording

#### Scenario: Reopening
- **WHEN** the visitor closes the demo console's overlay and opens it again while the transcript is still playing
- **THEN** the same session is shown with its earlier output

#### Scenario: Nothing leaves the page
- **WHEN** the demo console is opened, answered and ended
- **THEN** no process is started and no network request is made
