## MODIFIED Requirements

### Requirement: The activity log lives in the dashboard home and is bounded
Events SHALL be appended to `activity.jsonl` in the dashboard home (`~/.openspec-dashboard/`), one JSON object per line, each with a unique sortable id, its time, its detection time, its kind, the repository id and the repository name at that time, and the fields of its kind. The dashboard MUST NOT write activity anywhere else, and never into a tracked repository. Reading SHALL skip lines it cannot parse or whose format version it does not know, and MUST NOT fail because of them. The log SHALL keep only events whose time lies within the last 7 days: an event older than that, or whose time cannot be read, SHALL NOT be shown in the feed, counted as unseen or recorded, also when it is caught up after the dashboard was not running for longer. In addition the log SHALL keep at most its newest 2 000 entries. The file SHALL be compacted to the entries it keeps, by writing a new file and renaming it, on start when it holds anything it does not keep, when it exceeds 5 000 lines, and while the dashboard runs at most once an hour when events are recorded and entries have aged out since the last compaction. Reading the feed MUST NOT write the file. A failure to write the log MUST NOT fail or delay a scan. Entries MUST NOT contain file system paths, terminal output or prompt text.

#### Scenario: Survives a restart
- **WHEN** events were recorded and the dashboard is restarted
- **THEN** the feed shows those events again

#### Scenario: A torn line
- **WHEN** the last line of the log is incomplete because the process was killed while writing
- **THEN** the feed shows all other events and new events are recorded normally

#### Scenario: Bounded
- **WHEN** the log reaches 5 001 lines, all within the last 7 days
- **THEN** it is compacted to its newest 2 000 entries and the older ones are gone

#### Scenario: Older than a week on start
- **WHEN** the dashboard starts and `activity.jsonl` holds events from 10 days, 6 days and 1 hour ago
- **THEN** the feed shows the events from 6 days and 1 hour ago, and the file is rewritten without the one from 10 days ago

#### Scenario: Aging out while running
- **WHEN** the dashboard keeps running and an event recorded 7 days ago passes the 7-day mark
- **THEN** the feed no longer shows it nor counts it, and once new events are recorded the file is rewritten without it within the hour

#### Scenario: Caught up after a long absence
- **WHEN** the dashboard is started after 10 days and change `add-login` was archived 9 days ago, with its last commit then, and change `cache-api-calls` moved to `Ready` 2 days ago
- **THEN** only the move of `cache-api-calls` is recorded, marked as caught up

#### Scenario: Log not writable
- **WHEN** the log file cannot be written
- **THEN** scans, the board and the overview work as before, the feed still shows only the last 7 days, and the problem is reported on the console

### Requirement: Activity view in the top navigation
The top navigation SHALL offer **Activity** after *All changes*, opening a feed at `/activity` that lists events of all repositories newest first, grouped under day headings (`Today`, `Yesterday`, then dates). Each entry SHALL show its time, the repository name with the repository's colour, the change name in monospace where the event concerns a change, and a short statement of what happened, including the columns of a move and the figures of task progress. Events that were caught up SHALL be marked as having happened while the dashboard was not running. The change name SHALL link to the repository's board when the repository is still tracked, and be plain text otherwise. The feed SHALL load 100 entries and offer to load older ones. Once no older entries are left to load, the end of the feed SHALL state that activity is kept for 7 days; the empty state SHALL say so as well. The view MUST work in every supported theme and MUST NOT require network access beyond the dashboard's own API.

#### Scenario: Reading the feed
- **WHEN** the user opens Activity after a change moved to `Ready` today and another was archived yesterday
- **THEN** the feed shows `Today` with the move (`Specs → Ready`) and `Yesterday` with the archive, each with repository, change name and time

#### Scenario: Repository no longer tracked
- **WHEN** an entry belongs to a repository that has since been removed from the configuration
- **THEN** the entry still shows the repository's name as recorded and its change name is not a link

#### Scenario: Nothing yet
- **WHEN** no events have been recorded within the last 7 days
- **THEN** the view explains that activity appears here as the dashboard observes changes and that it is kept for 7 days

#### Scenario: The end of the feed
- **WHEN** the user has loaded every entry the log keeps
- **THEN** **Load older** is no longer offered and the end of the feed states that activity is kept for 7 days
