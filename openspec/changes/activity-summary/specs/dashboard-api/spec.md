# Spec Delta

## MODIFIED Requirements

### Requirement: Activity endpoint
`GET /api/activity` SHALL return `{ events, nextBefore?, newestId?, newerThanSince?, summary? }`: recorded activity newest first, with consecutive task progress of one change already collapsed. Only events the activity log keeps — those within its 7-day retention window — SHALL be returned, pointed at or counted: an event older than that MUST NOT appear in `events`, MUST NOT be the reason for a `nextBefore`, MUST NOT be `newestId`, MUST NOT count towards `newerThanSince` and MUST NOT count towards `summary`. It SHALL accept `limit` (1–500, default 100), `before` (an event id; only older events are returned), `repos` (comma-separated repository ids), `kinds` (comma-separated event kinds) and `since` (an event id, possibly empty). `nextBefore` SHALL be present when older events matching the filters exist; `newestId` SHALL be the id of the newest recorded event regardless of filters, and absent when there is none. When `since` is given, `newerThanSince` SHALL be the number of recorded events newer than that id regardless of filters — all of them for an empty `since`. When the request has no `before`, `summary` SHALL hold the figures of the Activity view's summary strip — `created`, `moved`, `archived`, `tasksCompleted`, `sessions` and `attention` — computed over every retained event that matches `repos` and `kinds`, independent of `limit`, and counted on recorded events rather than collapsed entries; a request with `before` SHALL NOT carry `summary`. Invalid parameters MUST return `400` with a message. The endpoint MUST NOT modify anything, and it MUST NOT return file system paths, terminal output or prompt text.

#### Scenario: Nothing recorded
- **WHEN** no activity has been recorded
- **THEN** the response is `{ "events": [], "summary": { "created": 0, "moved": 0, "archived": 0, "tasksCompleted": 0, "sessions": 0, "attention": 0 } }`

#### Scenario: Paging
- **WHEN** 250 events exist and the client requests `limit=100`, then repeats the request with `before` set to the returned `nextBefore`
- **THEN** the first response holds the newest 100 events, a `nextBefore` and a `summary` counting all 250 events, the second holds the next 100 and no `summary`, and no event appears twice

#### Scenario: Filtering
- **WHEN** the client requests `repos=<id of demo-ops>&kinds=session-started,session-ended`
- **THEN** only those kinds of events of that repository are returned, `summary` counts only those events, and `newestId` is still the newest event overall

#### Scenario: Counting what is new
- **WHEN** 5 events were recorded after the event with id `X` and the client requests `limit=1&since=X`
- **THEN** the response holds the newest event and `newerThanSince: 5`

#### Scenario: Older than the retention window
- **WHEN** the log holds 3 change-moved events from the last 7 days and 2 from 8 days ago, and the client requests `limit=3&since=`
- **THEN** the response holds the 3 recent events, no `nextBefore`, `newerThanSince: 3` and a `summary` with `moved: 3`

#### Scenario: Everything aged out
- **WHEN** every recorded event is older than 7 days
- **THEN** the response holds no events, a `summary` whose figures are all `0`, and no `newestId`

#### Scenario: Invalid limit
- **WHEN** the client requests `limit=0`
- **THEN** the response is `400` with a message
