# Spec Delta

## ADDED Requirements

### Requirement: The feed is summed up above it
Above the feed, the Activity view SHALL show a summary strip of six figures for everything the log keeps, labelled as covering the last 7 days:

- **changes created**: the number of change-created events.
- **changes moved**: the number of change-moved events.
- **changes archived**: the number of change-archived events.
- **tasks completed**: across all task progress events, the sum of each event's increase in finished tasks. An event whose finished count did not rise adds nothing. Figures carried by a move are not counted.
- **sessions run**: the number of session-started events, resumed sessions included.
- **need attention**: the number of events the feed shows in its danger tone. These are a repository's scan starting to fail, and a session that failed or ended with a non-zero exit code.

The figures SHALL count recorded events, not the entries the feed shows, so collapsing task progress MUST NOT change them. They SHALL cover every retained event that matches the view's repository and kind filters, whether or not it is loaded, and SHALL be updated whenever the feed reloads. A figure whose events are all excluded by the kind filter SHALL NOT be shown. The figures describe the feed only: they are part of the history the log provides and MUST NOT appear on, or be used by, the board, the overview or any action. The strip SHALL NOT be shown when no event matches.

#### Scenario: A week in figures
- **WHEN** the log keeps 3 created, 5 moved and 2 archived events, task progress events `0/8 → 3/8`, `3/8 → 5/8` and `5/8 → 4/8`, 4 session-started events, one session that ended with exit code 1 and one scan that started to fail
- **THEN** the strip shows 3 changes created, 5 changes moved, 2 changes archived, 5 tasks completed, 4 sessions run and 2 need attention

#### Scenario: Beyond the loaded page
- **WHEN** the log keeps 350 change-moved events and the feed has loaded its first 100 entries
- **THEN** the strip shows 350 changes moved

#### Scenario: Collapsing does not change the figures
- **WHEN** three task progress events of one change within forty minutes go `3/12 → 4/12`, `4/12 → 6/12` and `6/12 → 7/12`, and the feed shows them as one entry
- **THEN** the strip counts 4 tasks completed

#### Scenario: Filters apply
- **WHEN** the user selects repository `demo-ops` and the group *Sessions*
- **THEN** the strip shows only sessions run and need attention, counted over the events of `demo-ops` alone

#### Scenario: Aged out
- **WHEN** an archived event passes the 7-day mark while the view is open, and the feed reloads after the next scan
- **THEN** changes archived no longer counts it

### Requirement: Busy days are collapsed
When a day of the feed has more than 30 loaded entries, the view SHALL show only its newest 20 entries, followed by **Show N more**, where N is the number of that day's loaded entries left out. Activating it SHALL show all of that day's loaded entries and offer **Show fewer**, which collapses the day again. A day's state SHALL be kept when the feed reloads or loads older entries, and SHALL be reset when the filters change. Entries loaded later by **Load older** that belong to a collapsed day SHALL be counted in its N. Each day's heading SHALL stay visible at the top of the view while that day's entries are scrolled, whether the day is collapsed or not. Collapsing a day MUST NOT change paging, **Load older** or the summary strip.

#### Scenario: A busy day
- **WHEN** the loaded feed holds 140 entries for today and 12 for yesterday
- **THEN** today shows its newest 20 entries and **Show 120 more**, then yesterday shows all 12 entries

#### Scenario: Expanding and collapsing
- **WHEN** the user activates **Show 120 more** under today
- **THEN** all 140 of today's entries are shown, followed by **Show fewer**, which returns to the newest 20

#### Scenario: A quiet day
- **WHEN** a day has 30 loaded entries
- **THEN** all 30 are shown and no **Show more** is offered

#### Scenario: A new scan
- **WHEN** the user has expanded today and a scan records new events, so the feed reloads
- **THEN** today stays expanded and shows the new entries at the top

## MODIFIED Requirements

### Requirement: The log is history, never an input
The activity log SHALL record only what the dashboard observed and when. It MUST NOT be read by scanning, by column placement, by any count on the board or the overview, or by any action. The Activity view's summary strip is part of the feed and SHALL be the only place that counts the log. Deleting the log SHALL lose the history shown in the feed, including the summary's figures, and nothing else.

#### Scenario: Deleting the log
- **WHEN** the user deletes `activity.jsonl` and restarts the dashboard
- **THEN** the board, the overview, all counts and all actions are exactly as before, and the feed starts again with one tracked event per repository only if the snapshot cache is missing too
