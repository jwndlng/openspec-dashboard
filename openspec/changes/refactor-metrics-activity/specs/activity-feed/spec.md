## MODIFIED Requirements

### Requirement: The log is history, never an input
The activity log SHALL record only what the dashboard observed and when. It MUST NOT be read by scanning, by column placement, by any count on the board or the overview, or by any action. The Activity view's summary tiles and its metrics — per day, by hour and per project — are part of the feed and SHALL be the only places that count the log. Deleting the log SHALL lose the history shown in the feed, including the summary's figures and the metrics, and nothing else.

#### Scenario: Deleting the log
- **WHEN** the user deletes `activity.jsonl` and restarts the dashboard
- **THEN** the board, the overview, all counts and all actions are exactly as before, and the feed starts again with one tracked event per repository only if the snapshot cache is missing too

### Requirement: The feed is summed up above it
Above the feed, the Activity view SHALL show a row of summary tiles, one per figure, for everything the log keeps, labelled as covering the last 7 days:

- **changes created**: the number of change-created events.
- **changes moved**: the number of change-moved events.
- **changes archived**: the number of change-archived events.
- **tasks completed**: across all task progress events, the sum of each event's increase in finished tasks. An event whose finished count did not rise adds nothing. Figures carried by a move are not counted.
- **sessions run**: the number of session-started events, resumed sessions included.
- **need attention**: the number of events the feed shows in its danger tone. These are a repository's scan starting to fail, and a session that failed or ended with a non-zero exit code.

Each tile SHALL show its figure's value and label, and a trend: the same figure for every day of the per-day metrics, oldest to today, each drawn relative to that figure's busiest day, with today's mark set apart from the other days. The trend SHALL state each day's value on hover and in its accessible description, and a figure that is zero on every day SHALL draw a flat trend. The **need attention** tile SHALL be shown in the danger tone when its value is above zero, with its label always visible, so the state never depends on colour alone.

The figures SHALL count recorded events, not the entries the feed shows, so collapsing task progress MUST NOT change them. They SHALL cover every retained event that matches the view's repository and kind filters, whether or not it is loaded, and SHALL be updated whenever the feed reloads. A figure whose events are all excluded by the kind filter SHALL NOT be shown. The figures describe the feed only: they are part of the history the log provides and MUST NOT appear on, or be used by, the board, the overview or any action. The tiles SHALL NOT be shown when no event matches. The tiles MUST work in every supported theme and at phone width without horizontal scrolling.

#### Scenario: A week in figures
- **WHEN** the log keeps 3 created, 5 moved and 2 archived events, task progress events `0/8 → 3/8`, `3/8 → 5/8` and `5/8 → 4/8`, 4 session-started events, one session that ended with exit code 1 and one scan that started to fail
- **THEN** the tiles show 3 changes created, 5 changes moved, 2 changes archived, 5 tasks completed, 4 sessions run and 2 need attention

#### Scenario: A figure's trend
- **WHEN** 2 changes were created on Monday, none on Tuesday and 4 today
- **THEN** the changes created tile's trend shows Monday at half of today's height, Tuesday empty and today set apart, and hovering Monday's mark states 2

#### Scenario: Beyond the loaded page
- **WHEN** the log keeps 350 change-moved events and the feed has loaded its first 100 entries
- **THEN** the tiles show 350 changes moved

#### Scenario: Collapsing does not change the figures
- **WHEN** three task progress events of one change within forty minutes go `3/12 → 4/12`, `4/12 → 6/12` and `6/12 → 7/12`, and the feed shows them as one entry
- **THEN** the tiles count 4 tasks completed

#### Scenario: Filters apply
- **WHEN** the user selects repository `demo-ops` and the group *Sessions*
- **THEN** only the sessions run and need attention tiles are shown, counted over the events of `demo-ops` alone

#### Scenario: Aged out
- **WHEN** an archived event passes the 7-day mark while the view is open, and the feed reloads after the next scan
- **THEN** changes archived no longer counts it

### Requirement: The feed shows its metrics per day and per project
Below the summary tiles, the Activity view SHALL show charts for everything the log keeps, in three panels: **Per day**, **When** (see the hour-of-day requirement) and **Per project**.

- **Per day**: a column for every calendar day of the user's local time zone from the day that holds the start of the 7-day retention window up to and including today, in order, a day without events shown as an empty column. Each column SHALL be stacked by kind of event in the groups *Changes*, *Tasks*, *Sessions* and *Repositories*, always in that order and each group always in the same colour, sized against a value axis whose scale fits the busiest day, with the day's total of events stated at its top. A legend SHALL name every group drawn. Hovering or focusing a column SHALL show the day, its number of events per group, its total and its number of distinct changes touched. The panel's heading SHALL state the totals: the number of events and the number of distinct changes touched.
- **Per project**: every repository with at least one counted event, ordered by number of events, busiest first, then by name. Each SHALL show the repository's name with a swatch in its colour (neutral when it is no longer tracked), its number of events, its number of distinct changes touched, and a bar relative to the busiest repository, stacked by the same groups in the same colours as the per-day panel. Hovering or focusing a repository SHALL show its number of events per group. When there are more than 6, only the first 6 SHALL be shown, followed by **Show N more**, where N is the number left out; activating it SHALL show all of them and offer **Show fewer**. Activating a repository that is still tracked SHALL filter the feed to that repository alone, exactly as choosing it in the **Repositories** menu; a repository that is no longer tracked SHALL NOT be activatable.

A group excluded by the kind filter SHALL NOT be drawn nor named in the legend, and the colours of the groups still drawn MUST NOT change. The user SHALL be able to switch the panels between **Chart** and **Table** with one control; the table view SHALL state, for every day, every hour with events and every listed repository, the same numbers the chart draws, so no number is reachable only by hovering or only by telling colours apart. The choice SHALL be remembered in the browser, and when it cannot be read or written the charts are shown.

An event SHALL count on the day of its time (the time the feed groups it by), also when it was caught up. A change is touched by an event that concerns it; changes SHALL be told apart by repository and change name, so the same name in two repositories counts twice. The metrics SHALL count recorded events, not the entries the feed shows, so collapsing task progress MUST NOT change them. They SHALL cover every retained event that matches the view's repository and kind filters, whether or not it is loaded, and SHALL be updated whenever the feed reloads. The metrics SHALL NOT be shown when no event matches, and the per-project panel SHALL NOT be shown while the repository filter selects a single repository.

The user SHALL be able to hide and show the metrics with one control next to them; the choice SHALL be remembered in the browser, and when it cannot be read or written the metrics are shown. Hiding them MUST NOT hide the summary tiles, nor change the feed, its paging or **Load older**.

The metrics describe the feed only: they are part of the history the log provides and MUST NOT appear on, or be used by, the board, the overview or any action. The view MUST work in every supported theme, at phone width without horizontal scrolling, and MUST NOT require network access beyond the dashboard's own API or load anything from another host.

#### Scenario: A week per day
- **WHEN** it is Wednesday afternoon, and the log keeps 12 events today touching 3 changes, none yesterday and 40 last Thursday touching 9 changes
- **THEN** the per-day panel shows eight columns from last Wednesday to today, Thursday's the tallest stating 40, today's stating 12, and yesterday's empty, and focusing Thursday's column states 40 events and 9 changes

#### Scenario: A day by kind
- **WHEN** today holds 5 change events, 3 task progress events and 2 session events
- **THEN** today's column is stacked *Changes* 5, *Tasks* 3 and *Sessions* 2 in that order, states 10 on top, and the legend names *Changes*, *Tasks*, *Sessions* and *Repositories*

#### Scenario: Local days
- **WHEN** the user's time zone is `Europe/Zurich` and an event happened at 23:30 UTC on 6 October, which is 01:30 on 7 October in Zurich
- **THEN** it counts on 7 October

#### Scenario: Per project
- **WHEN** the log keeps 30 events of `demo-ops` touching 4 changes, 12 of `alpha-infra` touching 5 changes, and 2 repository events of `beta-soc`
- **THEN** the per-project panel lists `demo-ops` (30 events, 4 changes), `alpha-infra` (12 events, 5 changes) and `beta-soc` (2 events, 0 changes), in that order, with `demo-ops`'s bar the longest and `beta-soc`'s drawn in the *Repositories* colour alone

#### Scenario: Many projects
- **WHEN** 9 repositories have counted events
- **THEN** the 6 busiest are listed followed by **Show 3 more**, which lists all 9 and offers **Show fewer**

#### Scenario: Narrowing to a project
- **WHEN** the user activates `alpha-infra` in the per-project panel
- **THEN** the feed, the summary tiles, the per-day panel and the **When** panel show `alpha-infra` alone, the URL reflects the filter, its tag appears in the filter bar, and the per-project panel is not shown

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
- **THEN** the panels count only session events, only *Sessions* is drawn and named in the legend, in the same colour as without the filter, and a repository without session events is not listed

#### Scenario: Table view
- **WHEN** the user switches the metrics to **Table** and reloads the page
- **THEN** the panels show tables with each day's events per group, total and changes, each day's hours with events, and each repository's events per group, total and changes, and switching back to **Chart** shows the charts again

#### Scenario: Hiding the metrics
- **WHEN** the user hides the metrics and reloads the page
- **THEN** the metrics stay hidden, the summary tiles and the feed are shown as before, and showing them again brings the panels back

#### Scenario: Nothing matches
- **WHEN** no retained event matches the filters
- **THEN** neither the summary tiles nor the metrics are shown, only the empty state

## ADDED Requirements

### Requirement: The feed shows when activity happened
The metrics SHALL include a **When** panel: a grid with one row for every day of the per-day panel, oldest at the top, and one column for every hour of the day, `00` to `23`, in the user's local time zone, each cell shaded by the number of counted events whose time falls in that hour of that day. Shading SHALL use a single hue in four steps, from fewer to more events relative to the busiest hour of the window, and an hour without events SHALL be shown unshaded. The rows SHALL be labelled with the days as in the per-day panel, the columns with hours at least every 6 hours, and a legend SHALL explain the shading from fewer to more. Hovering a cell SHALL state its day, its hour and its number of events. The panel's heading SHALL name the busiest hour of the day across the window when there are events. On a day with a daylight-saving change, an hour that does not exist SHALL stay empty and an hour that occurs twice SHALL count both.

The panel SHALL follow the same filters, counting, hiding, table view and theme rules as the per-day panel, and SHALL fit at phone width without horizontal scrolling.

#### Scenario: Afternoon work
- **WHEN** today holds 6 events between 14:00 and 14:59 local time and 1 at 09:10, and no other day holds events
- **THEN** today's row shows the 14:00 cell in the darkest step, the 09:00 cell in the lightest step, every other cell unshaded, and the heading names 14:00 as the busiest hour

#### Scenario: Local hours
- **WHEN** the user's time zone is `Europe/Zurich` and an event happened at 23:30 UTC on 6 October
- **THEN** it counts in the 01:00 cell of 7 October

#### Scenario: Hover
- **WHEN** the user hovers the 14:00 cell of today's row holding 6 events
- **THEN** a tooltip states today, 14:00–15:00 and 6 events
