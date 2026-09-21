## 1. Event model and detection (pure)

- [x] 1.1 Add `ActivityEvent` (discriminated by `kind`, with `v`, `id`, `at`, `detectedAt`, `repoId`, `repoName`, optional `change`, `catchUp`) and `ActivityPage` to `src/shared/types.ts`
- [x] 1.2 Add `src/server/activity/events.ts` with `diffSnapshots(previous, next, { now, pollIntervalSeconds })` per design D1, D3 and D4 (baseline per repository, failing repositories skipped, moved-beats-progress, 7-day rule for unseen archives, catch-up mark, event time from `lastActivityAt` when inside the interval) and a sortable unique `newEventId()`
- [x] 1.3 Add `test/activityEvents.test.ts`: every row of the D1 table; first run with an empty previous snapshot yields one `repo-tracked` per repository; enabling a repository; failing → recovered without change events; old archives ignored, recent ones recorded; catch-up mark and event time selection; ordering within one scan

## 2. The log

- [x] 2.1 Add `activityLogPath()` to `src/server/paths.ts`
- [x] 2.2 Add `src/server/activity/log.ts`: `ActivityLog` with `load()` (tolerant read, compaction on start), `append(events)` (serialised `appendFile`, in-memory tail of 2 000, compaction beyond 5 000 lines via temp file + rename, write errors logged and swallowed) and `page({ limit, before, repos, kinds })` returning collapsed events, `nextBefore` and `newestId`
- [x] 2.3 Add `collapseTaskProgress(events)` (design D6) as a pure function shared by `page()` and the UI helpers
- [x] 2.4 Add `test/activityLog.test.ts` (temp home): append and reload; torn last line and unknown version skipped; compaction bounds; paging without duplicates; filters; `newestId` independent of filters; collapsing runs, a move ending a run, the 60-minute gap; an unwritable path does not throw

## 3. Wiring

- [x] 3.1 `src/server/scanner.ts`: accept an optional `onSnapshots(previous, next)` callback invoked after each completed scan with the snapshot that was current before it; `src/server/index.ts` connects it to `diffSnapshots` + `ActivityLog.append` and loads the log on start
- [x] 3.2 `src/server/sessions/manager.ts`: optional `onActivity` dependency; report `session-started`, `session-ended` (exit code / failure) and `session-shipped` (with `submitted`); nothing when sessions are disabled; extend the session tests
- [x] 3.3 `src/server/api.ts`: `GET /api/activity` with parameter validation (400 on invalid `limit`, unknown kinds); add to `AppState`; extend `test/api.test.ts` with empty, paging, filtering and invalid cases

## 4. UI

- [x] 4.1 `src/ui/api.ts`: `activity(params)`; `src/ui/demo/demoApi.ts` + `sampleData.ts`: a synthetic feed built from the demo repositories (made-up names only), supporting the same parameters
- [x] 4.2 `src/ui/activityState.ts` (pure): group by local day with `Today` / `Yesterday` labels, sentence per kind, filter ↔ URL query, unseen count from the seen id and the newest id (first visit: none; cap `99+`), tolerant `localStorage` access under `openspec-dashboard.activity.seen`; `test/activityState.test.ts`
- [x] 4.3 `src/ui/routes.ts`: `{ view: "activity" }` at `/activity` (and in the demo's hash routing); `src/ui/app.tsx`: nav entry **Activity** after *All changes* with the unseen count, polled with `limit=1` alongside the state poll
- [x] 4.4 `src/ui/activity.tsx`: the feed — day headings, entries with time, repository chip in the repository colour, monospace change name linking to `/repo/<id>` when tracked, catch-up marker, filters (repository chips, kind groups), "Load older", empty state; opening the view marks events as seen
- [x] 4.5 `src/ui/styles.css`: feed layout with tokens only; check both themes

## 5. Docs and invariant

- [x] 5.1 Amend invariant 5 in `CLAUDE.md` per design D9
- [x] 5.2 `README.md`: the Activity view, and `activity.jsonl` in the list of what lives in the dashboard home (history only; safe to delete)

## 6. Verification

- [x] 6.1 `bun run check` passes; `bun run build` and the binary serves `/api/activity`
- [x] 6.2 With a throwaway home and the synthetic fixtures as git repositories: first start records one tracked event per repository; ticking a task, moving a change to the next phase and archiving one produce the expected entries; restart shows them again and catches up on a change made while stopped; deleting `activity.jsonl` changes nothing on the board
- [x] 6.3 In headless Chrome: nav entry and unseen count, day grouping, collapsed task progress, filters in the URL and after reload, "Load older", links to the repository board, empty state, light and dark theme, and the demo build's feed
- [x] 6.4 Confirm no tracked repository was written to (`git status` clean in the fixture repositories) and that log entries contain no paths
