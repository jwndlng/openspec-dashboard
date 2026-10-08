# Spec Delta

## ADDED Requirements

### Requirement: The feed shows its metrics per day and per project
Below the summary strip, the Activity view SHALL show metrics for everything the log keeps, in two panels:

- **Per day**: one bar for every calendar day of the user's local time zone from the day that holds the start of the 7-day retention window up to and including today, in order, a day without events shown as an empty bar. Each bar SHALL be sized relative to the busiest day and state that day's number of events and number of distinct changes touched. The panel's heading SHALL state the totals: the number of events and the number of distinct changes touched.
- **Per project**: every repository with at least one counted event, ordered by number of events, busiest first, then by name. Each SHALL show the repository's name in its colour (neutral when it is no longer tracked), its number of events, its number of distinct changes touched, and a bar relative to the busiest repository. When there are more than 6, only the first 6 SHALL be shown, followed by **Show N more**, where N is the number left out; activating it SHALL show all of them and offer **Show fewer**. Activating a repository that is still tracked SHALL filter the feed to that repository alone, exactly as choosing it in the **Repositories** menu; a repository that is no longer tracked SHALL NOT be activatable.

An event SHALL count on the day of its time (the time the feed groups it by), also when it was caught up. A change is touched by an event that concerns it; changes SHALL be told apart by repository and change name, so the same name in two repositories counts twice. The metrics SHALL count recorded events, not the entries the feed shows, so collapsing task progress MUST NOT change them. They SHALL cover every retained event that matches the view's repository and kind filters, whether or not it is loaded, and SHALL be updated whenever the feed reloads. The metrics SHALL NOT be shown when no event matches, and the per-project panel SHALL NOT be shown while the repository filter selects a single repository.

The user SHALL be able to hide and show the metrics with one control next to them; the choice SHALL be remembered in the browser, and when it cannot be read or written the metrics are shown. Hiding them MUST NOT hide the summary strip, nor change the feed, its paging or **Load older**.

The metrics describe the feed only: they are part of the history the log provides and MUST NOT appear on, or be used by, the board, the overview or any action. The view MUST work in every supported theme, at phone width without horizontal scrolling, and MUST NOT require network access beyond the dashboard's own API.

#### Scenario: A week per day
- **WHEN** it is Wednesday afternoon, and the log keeps 12 events today touching 3 changes, none yesterday and 40 last Thursday touching 9 changes
- **THEN** the per-day panel shows eight bars from last Wednesday to today, Thursday's the tallest stating 40 events and 9 changes, today's stating 12 events and 3 changes, and yesterday's empty

#### Scenario: Local days
- **WHEN** the user's time zone is `Europe/Zurich` and an event happened at 23:30 UTC on 6 October, which is 01:30 on 7 October in Zurich
- **THEN** it counts on 7 October

#### Scenario: Per project
- **WHEN** the log keeps 30 events of `demo-ops` touching 4 changes, 12 of `alpha-infra` touching 5 changes, and 2 repository events of `beta-soc`
- **THEN** the per-project panel lists `demo-ops` (30 events, 4 changes), `alpha-infra` (12 events, 5 changes) and `beta-soc` (2 events, 0 changes), in that order, with `demo-ops`'s bar the longest

#### Scenario: Many projects
- **WHEN** 9 repositories have counted events
- **THEN** the 6 busiest are listed followed by **Show 3 more**, which lists all 9 and offers **Show fewer**

#### Scenario: Narrowing to a project
- **WHEN** the user activates `alpha-infra` in the per-project panel
- **THEN** the feed, the summary strip and the per-day panel show `alpha-infra` alone, the URL reflects the filter, its tag appears in the filter bar, and the per-project panel is not shown

#### Scenario: Same name in two projects
- **WHEN** change `add-login` has events in `demo-ops` and in `alpha-infra`
- **THEN** the totals count 2 changes touched

#### Scenario: Collapsing does not change the metrics
- **WHEN** three task progress events of one change within forty minutes are shown as one entry
- **THEN** the per-day and per-project panels count 3 events

#### Scenario: Beyond the loaded page
- **WHEN** the log keeps 350 events and the feed has loaded its first 100 entries
- **THEN** the per-day heading states 350 events

#### Scenario: Filters apply
- **WHEN** the user selects the group *Sessions*
- **THEN** both panels count only session events, and a repository without session events is not listed

#### Scenario: Hiding the metrics
- **WHEN** the user hides the metrics and reloads the page
- **THEN** the metrics stay hidden, the summary strip and the feed are shown as before, and showing them again brings both panels back

#### Scenario: Nothing matches
- **WHEN** no retained event matches the filters
- **THEN** neither the summary strip nor the metrics are shown, only the empty state

## MODIFIED Requirements

### Requirement: The log is history, never an input
The activity log SHALL record only what the dashboard observed and when. It MUST NOT be read by scanning, by column placement, by any count on the board or the overview, or by any action. The Activity view's summary strip and its per-day and per-project metrics are part of the feed and SHALL be the only places that count the log. Deleting the log SHALL lose the history shown in the feed, including the summary's figures and the metrics, and nothing else.

#### Scenario: Deleting the log
- **WHEN** the user deletes `activity.jsonl` and restarts the dashboard
- **THEN** the board, the overview, all counts and all actions are exactly as before, and the feed starts again with one tracked event per repository only if the snapshot cache is missing too
