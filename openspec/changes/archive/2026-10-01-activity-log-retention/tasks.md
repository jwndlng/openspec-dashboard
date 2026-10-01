# Tasks

## 1. Retention helper

- [x] 1.1 Add `RETENTION_MS` (7 days) and a pure `retained(entries, nowMs)` to `src/shared/activity.ts` that keeps events whose `at` parses and is no older than the window (future `at` kept, unparseable dropped), preserving order; verify with unit tests in `test/activityLog.test.ts` covering the boundary, a future time and an unparseable time

## 2. Activity log

- [x] 2.1 Give `ActivityLog` an injectable clock (`constructor(path, now = () => Date.now())`) and pin it near `T0` in every existing `ActivityLog` construction in `test/activityLog.test.ts` (`test/activityApi.test.ts` records at the real time and keeps the default clock); verify `bun test test/activityLog.test.ts test/activityApi.test.ts` still passes unchanged otherwise
- [x] 2.2 Apply `retained` in `page()` before `pageEvents`, so `events`, `nextBefore`, `newestId` and `newerThanSince` ignore expired entries and `page()` writes nothing (design D2); verify with tests for "Older than the retention window" and "Everything aged out", including advancing the clock past an event without any append
- [x] 2.3 In `load()`, keep only retained entries (then the newest `KEEP_ENTRIES`) and compact when anything aged out or the file exceeded `KEEP_ENTRIES` lines, not merely because of unparseable lines (design D3); verify with a test that a file holding events from 10 days, 6 days and 1 hour ago is rewritten without the first, and that a file with only an unknown-version line among recent ones is left untouched
- [x] 2.4 In `append()`, drop incoming events already beyond the window before writing, prune memory by age, count what aged out, and compact after the write when that count is non-zero and the last compaction is at least an hour old, besides the existing 5 000-line rule (design D1, D3); verify with tests: an expired catch-up event is neither returned nor in the file, an aged-out entry stays in the file within the hour and is gone after the clock advances an hour and another event is appended, and the "Bounded" test still compacts to 2 000

## 3. Activity view and demo

- [x] 3.1 In `src/ui/activity.tsx`, show "Activity is kept for 7 days." (days derived from `RETENTION_MS`) after the last entry when there is no `nextBefore`, and add it to the unfiltered empty state; verify with `bun run dev` that the note appears at the end of the feed and in an empty feed, in light and dark theme
- [x] 3.2 Keep the demo feed within the window: in `src/ui/demo/sampleData.ts` move the baseline `repo-tracked` events and the archive cut-off inside 7 days, and apply `retained` before `pageEvents` in `src/ui/demo/demoApi.ts`; verify the demo tests pass and the demo feed shows no date older than a week

## 4. Wrap-up

- [x] 4.1 Run `bun run check` (lint, typecheck, all tests) and verify it passes
- [x] 4.2 Run `bun run build` and start `dist/openspec-dashboard` against a dashboard home whose `activity.jsonl` holds an entry older than 7 days; verify the feed omits it and the file no longer contains it after start
