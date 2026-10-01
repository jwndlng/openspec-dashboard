# Design

## Context

`ActivityLog` (`src/server/activity/log.ts`) holds the log in memory, oldest first in detection order, capped at
`KEEP_ENTRIES` (2 000). It appends through one serial write queue and compacts the file (write a temp file, rename)
on start when there are more than 2 000 lines, and after an append once the file has more than `COMPACT_ABOVE_LINES`
(5 000). `page()` hands the in-memory entries to the pure `pageEvents` in `src/shared/activity.ts`, which the demo
site (`src/ui/demo/demoApi.ts`) also uses over its generated sample feed. Nothing in the log reads a clock today, and
`test/activityLog.test.ts` uses fixed timestamps (`2026-09-21`). Motivation: see proposal.md — Why. Requirements: see
the delta specs.

## Goals / Non-Goals

**Goals:**
- What the feed shows, pages and counts is exactly the last 7 days (within the count cap), at every moment, without
  depending on when the file was last compacted.
- The file stays bounded by age as well as by count, with no extra write per scan.

**Non-Goals:**
- A configurable retention period, or a setting for it.
- A background timer or shutdown hook for the log.
- Changing the event format, the event ids or what is detected.

## Decisions

### D1. Age is measured by an event's `at`, not its `detectedAt`

The feed sorts and groups by `at`, so the day headings a user sees are the 7 days that are kept. Measuring by
`detectedAt` would let a caught-up event from 9 days ago be recorded today and shown under a heading older than a week.
Consequence: an event whose `at` is already beyond the window when detected is never recorded (this matches how
first-sight archives are already ignored after 7 days in `events.ts`). An `at` that does not parse counts as expired;
an `at` in the future (clock skew) is kept.

### D2. The window is applied when reading, the file is only trimmed opportunistically

`page()` filters the in-memory entries through a pure `retained(entries, nowMs)` helper (with `RETENTION_MS` = 7 days,
both in `src/shared/activity.ts`) before calling `pageEvents`. That makes the API exact at every request — events,
`nextBefore`, `newestId` and `newerThanSince` all derive from the filtered list — while `GET /api/activity` still writes
nothing. `pageEvents` itself stays clock-free.

Alternative: prune only on compaction and trust the file. Rejected: a dashboard left running for days would keep
showing expired entries until the next compaction.

### D3. Memory is pruned on load and append; the file on load and at most hourly on append

- `load()` keeps the parsed entries that are within the window, then the newest `KEEP_ENTRIES`. It compacts when it
  dropped anything by age or the file had more lines than `KEEP_ENTRIES` (today's rule). Lines that do not parse are
  not by themselves a reason to compact, so a downgrade does not erase a newer version's lines on every start.
- `append()` drops incoming events already beyond the window (D1) before writing them, prunes memory by age, and adds
  the age-pruned count to `agedOut`. After writing it compacts when the file exceeds `COMPACT_ABOVE_LINES` (unchanged)
  or when `agedOut > 0` and the last compaction is at least an hour ago. Compaction resets `agedOut` and stamps the time.

So the file holds at most a week and an hour of events plus whatever arrived since, never more than 5 000 lines, and
an idle dashboard writes nothing. Alternative: a timer that compacts hourly. Rejected: the log has no lifecycle today,
a timer needs stopping in tests and at shutdown, and the feed is already exact through D2.

### D4. The count bound stays

`KEEP_ENTRIES` and `COMPACT_ABOVE_LINES` keep their values and meaning as a backstop for a very busy week; age and
count both apply and the stricter one wins.

### D5. The clock is injected

`new ActivityLog(path, now = () => Date.now())`. Tests pass a clock pinned near their fixed timestamps and advance it to
prove aging out and the hourly compaction; production uses the default. `index.ts` is unchanged.

### D6. UI and demo

`src/ui/activity.tsx` renders a short hint — "Activity is kept for 7 days." — after the last entry when there is no
`nextBefore`, and appends the same sentence to the unfiltered empty state. The 7 comes from `RETENTION_MS`, so the text
cannot drift from the server. The demo's `buildActivity` moves its baseline `repo-tracked` events (now 30 days back) and
the archive cut-off (21 days) inside the window, and `demoApi.ts` applies `retained` before `pageEvents`, so the demo
behaves like the real feed.

## Risks / Trade-offs

- [The first start of this version deletes older history from `activity.jsonl`] → Intended and irreversible; the log is
  history only (invariant 5) and the proposal states it. Nothing else reads it.
- [A busy setup records more than 2 000 events in 7 days, so the feed covers less than a week] → Acceptable: that is
  today's behaviour; the end-of-feed note says "kept for 7 days", which is the upper bound, not a promise.
- [The system clock jumps forward] → Events may vanish from the feed early and be trimmed from the file; history only.
  A jump backwards keeps events longer; future-dated events are kept rather than dropped.
- [Filtering on every `page()` call] → At most 2 000 entries, a linear filter before the sort that already happens; cheaper
  than today on any log that held more than a week.

## Migration Plan

No migration step. On first start the log trims itself (D3). Rolling back to an older version reads the trimmed file as
it is; it simply stops trimming by age.
