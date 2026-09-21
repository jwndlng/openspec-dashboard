## ADDED Requirements

### Requirement: Activity endpoint
`GET /api/activity` SHALL return `{ events, nextBefore?, newestId?, newerThanSince? }`: recorded activity newest first, with consecutive task progress of one change already collapsed. It SHALL accept `limit` (1–500, default 100), `before` (an event id; only older events are returned), `repos` (comma-separated repository ids), `kinds` (comma-separated event kinds) and `since` (an event id, possibly empty). `nextBefore` SHALL be present when older events matching the filters exist; `newestId` SHALL be the id of the newest recorded event regardless of filters, and absent when there is none. When `since` is given, `newerThanSince` SHALL be the number of recorded events newer than that id regardless of filters — all of them for an empty `since`. Invalid parameters MUST return `400` with a message. The endpoint MUST NOT modify anything, and it MUST NOT return file system paths, terminal output or prompt text.

#### Scenario: Nothing recorded
- **WHEN** no activity has been recorded
- **THEN** the response is `{ "events": [] }`

#### Scenario: Paging
- **WHEN** 250 events exist and the client requests `limit=100`, then repeats the request with `before` set to the returned `nextBefore`
- **THEN** the first response holds the newest 100 events and a `nextBefore`, the second the next 100, and no event appears twice

#### Scenario: Filtering
- **WHEN** the client requests `repos=<id of demo-ops>&kinds=session-started,session-ended`
- **THEN** only those kinds of events of that repository are returned, and `newestId` is still the newest event overall

#### Scenario: Counting what is new
- **WHEN** 5 events were recorded after the event with id `X` and the client requests `limit=1&since=X`
- **THEN** the response holds the newest event and `newerThanSince: 5`

#### Scenario: Invalid limit
- **WHEN** the client requests `limit=0`
- **THEN** the response is `400` with a message
