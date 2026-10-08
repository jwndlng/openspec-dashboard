# Spec Delta

## MODIFIED Requirements

### Requirement: Activity endpoint
`GET /api/activity` SHALL return `{ events, nextBefore?, newestId?, newerThanSince?, summary?, metrics? }`: recorded activity newest first, with consecutive task progress of one change already collapsed. Only events the activity log keeps — those within its 7-day retention window — SHALL be returned, pointed at or counted: an event older than that MUST NOT appear in `events`, MUST NOT be the reason for a `nextBefore`, MUST NOT be `newestId`, MUST NOT count towards `newerThanSince` and MUST NOT count towards `summary` or `metrics`. It SHALL accept `limit` (1–500, default 100), `before` (an event id; only older events are returned), `repos` (comma-separated repository ids), `kinds` (comma-separated event kinds), `since` (an event id, possibly empty) and `tz` (an IANA time zone name such as `Europe/Zurich`; `UTC` when absent). `nextBefore` SHALL be present when older events matching the filters exist; `newestId` SHALL be the id of the newest recorded event regardless of filters, and absent when there is none. When `since` is given, `newerThanSince` SHALL be the number of recorded events newer than that id regardless of filters — all of them for an empty `since`. When the request has no `before`, `summary` SHALL hold the figures of the Activity view's summary strip — `created`, `moved`, `archived`, `tasksCompleted`, `sessions` and `attention` — and `metrics` SHALL hold the Activity view's per-day and per-project metrics — `events` (the number of events), `changes` (the number of distinct changes touched, told apart by repository id and change name), `days` (for every calendar day in `tz` from the day holding the start of the retention window up to and including the current day, oldest first, `{ day, events, changes }` with `day` as `YYYY-MM-DD`, zero for a day without events) and `repos` (for every repository with at least one counted event, `{ repoId, repoName, events, changes }` with the repository name of its newest counted event, ordered by `events` descending, then by name). Both SHALL be computed over every retained event that matches `repos` and `kinds`, independent of `limit`, and counted on recorded events rather than collapsed entries; an event SHALL count on the day of its time in `tz`. A request with `before` SHALL carry neither `summary` nor `metrics`. Invalid parameters, an unknown time zone among them, MUST return `400` with a message. The endpoint MUST NOT modify anything, and it MUST NOT return file system paths, terminal output or prompt text.

#### Scenario: Nothing recorded
- **WHEN** no activity has been recorded
- **THEN** the response holds `"events": []`, a `summary` whose figures are all `0`, and a `metrics` with `events: 0`, `changes: 0`, no `repos`, and one entry per day of the retention window, each with `events: 0` and `changes: 0`

#### Scenario: Paging
- **WHEN** 250 events exist and the client requests `limit=100`, then repeats the request with `before` set to the returned `nextBefore`
- **THEN** the first response holds the newest 100 events, a `nextBefore`, and a `summary` and `metrics` counting all 250 events, the second holds the next 100 and neither `summary` nor `metrics`, and no event appears twice

#### Scenario: Filtering
- **WHEN** the client requests `repos=<id of demo-ops>&kinds=session-started,session-ended`
- **THEN** only those kinds of events of that repository are returned, `summary` and `metrics` count only those events, `metrics.repos` lists `demo-ops` alone, and `newestId` is still the newest event overall

#### Scenario: Days in the client's time zone
- **WHEN** an event happened at `2026-10-06T23:30:00Z` and the client requests `tz=Europe/Zurich`
- **THEN** it counts in the `metrics.days` entry for `2026-10-07`; requested without `tz`, it counts in the entry for `2026-10-06`

#### Scenario: Unknown time zone
- **WHEN** the client requests `tz=Mars/Olympus`
- **THEN** the response is `400` with a message

#### Scenario: Counting what is new
- **WHEN** 5 events were recorded after the event with id `X` and the client requests `limit=1&since=X`
- **THEN** the response holds the newest event and `newerThanSince: 5`

#### Scenario: Older than the retention window
- **WHEN** the log holds 3 change-moved events from the last 7 days and 2 from 8 days ago, and the client requests `limit=3&since=`
- **THEN** the response holds the 3 recent events, no `nextBefore`, `newerThanSince: 3`, a `summary` with `moved: 3` and a `metrics` with `events: 3`

#### Scenario: Everything aged out
- **WHEN** every recorded event is older than 7 days
- **THEN** the response holds no events, a `summary` whose figures are all `0`, a `metrics` with `events: 0` and no `repos`, and no `newestId`

#### Scenario: Invalid limit
- **WHEN** the client requests `limit=0`
- **THEN** the response is `400` with a message
