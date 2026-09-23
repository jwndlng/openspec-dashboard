# activity-feed Specification

## Purpose
Defines the activity feed: the history of what the dashboard observed happening across the tracked repositories — how events are derived by comparing consecutive scan snapshots, what a first sight of a repository and a restart mean for them, which agent session events belong to it, where the log is kept and how it is bounded, and how the feed is shown, collapsed, filtered and counted in the UI.

## Requirements

### Requirement: Activity is detected by comparing consecutive snapshots
After every scan the dashboard SHALL compare the new snapshot with the previous one and record what changed as events: a change created, a change moved from one column to another, task progress within a column, a change archived, a change removed, a repository tracked or no longer tracked, and a repository's scan starting to fail or recovering. Changes SHALL be matched by repository and change name. A change that moved and progressed in the same scan SHALL yield one moved event carrying the new progress. While a repository's scan is failing its changes MUST NOT be compared. Detection MUST be a function of the two snapshots only and MUST NOT read or write any repository.

#### Scenario: A change becomes ready
- **WHEN** the previous snapshot shows change `cache-api-calls` of `demo-ops` in `Specs` and the new one shows it in `Ready`
- **THEN** one event is recorded: `cache-api-calls` in `demo-ops` moved from `Specs` to `Ready`

#### Scenario: Task progress
- **WHEN** a change stays in `Implementing` and its tasks go from `3/12` to `7/12`
- **THEN** one task progress event from `3/12` to `7/12` is recorded

#### Scenario: Moved and progressed at once
- **WHEN** a change goes from `Ready` with `0/7` to `Implementing` with `2/7` between two scans
- **THEN** exactly one event is recorded, moved from `Ready` to `Implementing`, carrying `2/7`

#### Scenario: Created, archived, removed
- **WHEN** between two scans change `add-login` appears, change `bump-toolchain` becomes archived and change `old-idea` disappears
- **THEN** a created, an archived and a removed event are recorded for them respectively

#### Scenario: A failing scan is not mistaken for activity
- **WHEN** a repository's scan fails and the dashboard keeps showing its previous changes
- **THEN** one scan-failing event with the error is recorded and no change events for that repository; when it succeeds again a recovered event is recorded and comparison resumes

### Requirement: First sight of a repository is a baseline, not activity
A repository that was not part of the previous snapshot — on first run, after the snapshot cache was deleted, or when the repository was just enabled — SHALL yield exactly one repository-tracked event stating its number of open changes, and MUST NOT yield events for its individual changes. Archived changes that appear for a change not seen before SHALL be recorded only when their archive date lies within the last 7 days.

#### Scenario: First run
- **WHEN** the dashboard scans for the first time with 13 tracked repositories holding 140 changes
- **THEN** 13 repository-tracked events are recorded and no change events

#### Scenario: Enabling a repository
- **WHEN** the user enables repository `beta-soc` and the next scan completes
- **THEN** one repository-tracked event for `beta-soc` is recorded and none for its changes

#### Scenario: Old archives arriving
- **WHEN** a pull brings in archive directories dated months ago that the dashboard had not seen
- **THEN** no archived events are recorded for them

### Requirement: What happened while the dashboard was not running is caught up
Because the previous snapshot is restored from the cache on start, the first scan after a restart SHALL record what changed since the dashboard last ran. Such events SHALL be marked as caught up when the two snapshots are further apart than three poll intervals. An event's time SHALL be the change's last activity time when that lies between the two snapshots, and the time of detection otherwise; the time of detection SHALL always be kept as well.

#### Scenario: After a weekend
- **WHEN** the dashboard is started on Monday, the cached snapshot is from Friday, and change `add-login` was implemented and archived in between, with its last commit on Saturday 14:02
- **THEN** the archived event for `add-login` is recorded, marked as caught up, and timed Saturday 14:02

#### Scenario: No usable activity time
- **WHEN** a change moved between two regular scans and its last activity time is older than the previous snapshot
- **THEN** the event is timed at the moment of detection

### Requirement: Agent session events are part of the activity
When agent sessions are enabled, the dashboard SHALL record a session being started (with its action and agent name), a session ending (with its exit code, or that it failed and why) and Ship being used (with whether the prompt was submitted). With agent sessions disabled no session events exist.

#### Scenario: A session crashes
- **WHEN** the agent of a session for `cache-api-calls` exits with code 1
- **THEN** a session-ended event for that change with exit code 1 is recorded

### Requirement: The activity log lives in the dashboard home and is bounded
Events SHALL be appended to `activity.jsonl` in the dashboard home (`~/.openspec-dashboard/`), one JSON object per line, each with a unique sortable id, its time, its detection time, its kind, the repository id and the repository name at that time, and the fields of its kind. The dashboard MUST NOT write activity anywhere else, and never into a tracked repository. Reading SHALL skip lines it cannot parse or whose format version it does not know, and MUST NOT fail because of them. When the file exceeds 5 000 lines, and on start, it SHALL be compacted to its newest 2 000 entries by writing a new file and renaming it. A failure to write the log MUST NOT fail or delay a scan. Entries MUST NOT contain file system paths, terminal output or prompt text.

#### Scenario: Survives a restart
- **WHEN** events were recorded and the dashboard is restarted
- **THEN** the feed shows those events again

#### Scenario: A torn line
- **WHEN** the last line of the log is incomplete because the process was killed while writing
- **THEN** the feed shows all other events and new events are recorded normally

#### Scenario: Bounded
- **WHEN** the log reaches 5 001 lines
- **THEN** it is compacted to its newest 2 000 entries and the older ones are gone

#### Scenario: Log not writable
- **WHEN** the log file cannot be written
- **THEN** scans, the board and the overview work as before and the problem is reported on the console

### Requirement: The log is history, never an input
The activity log SHALL record only what the dashboard observed and when. It MUST NOT be read by scanning, by column placement, by any count on the board or the overview, or by any action. Deleting the log SHALL lose the history shown in the feed and nothing else.

#### Scenario: Deleting the log
- **WHEN** the user deletes `activity.jsonl` and restarts the dashboard
- **THEN** the board, the overview, all counts and all actions are exactly as before, and the feed starts again with one tracked event per repository only if the snapshot cache is missing too

### Requirement: Activity view in the top navigation
The top navigation SHALL offer **Activity** after *All changes*, opening a feed at `/activity` that lists events of all repositories newest first, grouped under day headings (`Today`, `Yesterday`, then dates). Each entry SHALL show its time, the repository name with the repository's colour, the change name in monospace where the event concerns a change, and a short statement of what happened, including the columns of a move and the figures of task progress. Events that were caught up SHALL be marked as having happened while the dashboard was not running. The change name SHALL link to the repository's board when the repository is still tracked, and be plain text otherwise. The feed SHALL load 100 entries and offer to load older ones. The view MUST work in every supported theme and MUST NOT require network access beyond the dashboard's own API.

#### Scenario: Reading the feed
- **WHEN** the user opens Activity after a change moved to `Ready` today and another was archived yesterday
- **THEN** the feed shows `Today` with the move (`Specs → Ready`) and `Yesterday` with the archive, each with repository, change name and time

#### Scenario: Repository no longer tracked
- **WHEN** an entry belongs to a repository that has since been removed from the configuration
- **THEN** the entry still shows the repository's name as recorded and its change name is not a link

#### Scenario: Nothing yet
- **WHEN** no events have been recorded
- **THEN** the view explains that activity appears here as the dashboard observes changes

### Requirement: Task progress is shown collapsed
Consecutive task progress events of the same change SHALL be shown as one entry when each lies within 60 minutes of the next, spanning from the first event's starting figures to the last event's resulting figures and timed at the last; any other event of that change in between SHALL end the run. Collapsing MUST NOT alter the recorded events.

#### Scenario: An hour of ticking tasks
- **WHEN** a change's tasks are observed going `3/12 → 4/12`, `4/12 → 6/12` and `6/12 → 7/12` within forty minutes
- **THEN** the feed shows one entry `3/12 → 7/12` timed at the last observation, and the log still holds three events

#### Scenario: A move ends the run
- **WHEN** progress events are followed by a move to `Done` and then further progress events
- **THEN** the feed shows progress, the move, and progress as three entries

### Requirement: The feed can be filtered
The feed SHALL be filterable by repository, using the same **Repositories** menu and removable repository tags as the board's filter bar, and by kind of event in the groups *Changes*, *Tasks*, *Sessions* and *Repositories*, shown as one group of toggles, with **Clear filters** while any filter is active. Filters SHALL apply to older entries loaded on demand as well and SHALL be kept in the URL query string.

#### Scenario: One repository, sessions only
- **WHEN** the user selects repository `demo-ops` and the group *Sessions*
- **THEN** only session events of `demo-ops` are shown, the URL reflects both filters, and reloading the page shows the same selection

### Requirement: Unseen activity is indicated on the navigation entry
The Activity navigation entry SHALL show the number of events newer than the newest event the user had seen when they last opened the feed, capped at `99+`, and no number when there are none. Opening the feed SHALL mark all current events as seen. What was seen SHALL be remembered in the browser; when it cannot be read or written, no number is shown and the feed works normally. On the very first visit nothing counts as unseen.

#### Scenario: New events since the last visit
- **WHEN** the user last opened the feed yesterday and five events were recorded since
- **THEN** the navigation entry shows `5`, and after opening the feed it shows no number

#### Scenario: First visit
- **WHEN** the user has never opened the feed
- **THEN** no number is shown
