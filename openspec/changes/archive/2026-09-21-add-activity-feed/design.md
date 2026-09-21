## Context

`Scanner.scanAll()` (`src/server/scanner.ts`) builds a fresh `Snapshot` on every poll and, while doing so, still holds the previous one (`previous`). On start the previous snapshot comes from `cache/snapshot.json`, so even the first scan after a restart has something to compare with. A `ChangeSnapshot` carries everything that defines "where a change is": `column`, `stage`, `tasks`, `archived`, `specsSynced`, `lastActivityAt`. When a repository's scan fails, the scanner keeps the previous changes (`ok: false`), so failures do not look like mass removals. Agent sessions have their own lifecycle in `SessionManager` (`open`, `end`, `ship`).

The dashboard home (`~/.openspec-dashboard/`, `OPENSPEC_DASHBOARD_HOME` in tests) already holds `config.json`, `shared-config.json`, `cache/snapshot.json`, `sessions/` and `worktrees/`; all writes use temp file + rename.

`CLAUDE.md` invariant 5: *"The repository is the source of truth. The dashboard indexes; it never stores facts about changes that are not derivable from the repositories."* An event log is, by nature, not derivable.

## Goals / Non-Goals

**Goals:**
- Answer "what happened since I last looked?" in one view, across repositories.
- Zero new writes to tracked repositories; bounded, crash-tolerant storage in the dashboard home.
- No noise: no flood on first run or when a repository is enabled; task ticking does not drown everything else.
- Pure, well-tested detection logic.

**Non-Goals:**
- A release changelog, commit history or diff viewer; who did something (no authorship).
- Reconstructing history from git for the time before the log existed (possible later; see Open Questions).
- Notifications, e-mail, webhooks; syncing the log between machines.
- Using the log for any decision: columns, counts and actions keep coming from snapshots only.

## Decisions

### D1: Events come from diffing consecutive snapshots
`diffSnapshots(previous: Snapshot, next: Snapshot, now): ActivityEvent[]` is a pure function, keyed by `repoId` and, within a repository, by change `name`:

| Observation | Event `kind` |
|---|---|
| repository in `next` but not in `previous` | `repo-tracked` — and **nothing else** for that repository (baseline, D3) |
| repository in `previous` but not in `next` | `repo-untracked` |
| `ok: true → false` / `false → true` | `repo-failing` (with the error) / `repo-recovered`; while `ok` is false its changes are **not** diffed (they are the kept previous ones) |
| change only in `next`, not archived | `change-created` (with its column) |
| change only in `next`, archived | `change-archived` only if the repository was diffed and the archive date is within the last 7 days; older archives appearing (e.g. after a pull) are ignored |
| `archived` unset → set | `change-archived` |
| `column` differs (and not the archive case) | `change-moved` with `from`, `to` |
| same column, `tasks.done` or `tasks.total` differs | `tasks-progress` with `from`, `to` (`done/total`) |
| change only in `previous` | `change-removed` |

A change that moved **and** progressed yields only `change-moved` (the move carries the new `tasks`). Events of one scan are ordered repository by repository, in the change order of the snapshot.

*Alternative:* instrumenting every place that could cause a change (file watchers, git hooks) — rejected: intrusive, platform-specific, and the dashboard would have to run continuously. Diffing is complete with respect to what the dashboard shows, which is exactly the claim the feed makes.

### D2: Session events are reported, not inferred
`SessionManager` gets an optional `onActivity(event)` dependency and reports `session-started` (action, agent name), `session-ended` (exit code, or `failed` with the error) and `session-shipped` (with `submitted`). These cannot be derived from snapshots. With agent sessions disabled nothing is reported.

### D3: Baseline and offline rules
- **Baseline:** a repository absent from `previous` produces a single `repo-tracked` event (with its number of open changes) and no change events. This covers first run, a deleted cache, and enabling a repository. An **empty** `previous` snapshot (no cache at all) therefore produces one line per repository, not hundreds.
- **Offline catch-up:** because `previous` is restored from the cache on start, the first scan after a restart reports what changed in between. That is a feature; the events are marked `catchUp: true` when `next.generatedAt − previous.generatedAt` exceeds three poll intervals, and the UI words them accordingly ("while the dashboard was not running").

### D4: Event time
`at` is, in this order: the change's `lastActivityAt` **if** it lies after `previous.generatedAt` and not after `now` (the file or commit that caused the transition); otherwise `now` (detection time). `detectedAt` is always stored too. Session events use `now`. Entries are appended in detection order and displayed sorted by `at` descending, ties by detection order.

### D5: Storage — append-only JSON Lines with compaction
`~/.openspec-dashboard/activity.jsonl`; one event per line:

```json
{"v":1,"id":"01J…","at":"2026-09-21T09:14:03.120Z","detectedAt":"…","kind":"change-moved","repoId":"1c1b…","repoName":"demo-ops","change":"cache-api-calls","from":"Specs","to":"Ready","tasks":{"done":0,"total":7}}
```

- `id` is a sortable unique id (time-based prefix + random suffix); `repoName` is denormalised so entries of a repository that is no longer tracked stay readable.
- **Append** with `appendFile`, serialised through one promise chain; a crash can at worst leave a truncated last line.
- **Read** is tolerant: unparseable lines and unknown `v` are skipped, never fatal.
- **Bounds:** on start and whenever the file exceeds 5 000 lines it is compacted to the newest 2 000 (temp file + rename). An in-memory tail of the newest 2 000 events serves the API; the file is not re-read per request.
- A failing write is logged to the console and never fails a scan.

*Alternatives:* one JSON array rewritten on every event (the "cache file" idea taken literally) — rejected: O(n) rewrite per scan and a torn write loses everything; SQLite — rejected: a dependency and a binary format for a few thousand small records.

This is a **log, not a cache**: it cannot be rebuilt. It lives next to, not inside, `cache/`.

### D6: Task progress is stored raw and collapsed for display
Every observed progress step is appended (cheap, truthful). Collapsing happens when serving and in the UI's pure helpers: consecutive `tasks-progress` events of the same change, each within 60 minutes of the next, merge into one entry spanning the first `from` to the last `to`, timed at the last. A `change-moved` in between ends a run. Collapsing at read time keeps the file append-only.

### D7: API
`GET /api/activity?limit=100&before=<id>&repos=<id,id>&kinds=<kind,kind>&since=<id>` → `{ events: ActivityEvent[], nextBefore?: string, newestId?: string, newerThanSince?: number }`, newest first, already collapsed; `limit` 1–500 (default 100). Read-only, so no cross-site guard beyond the existing GET handling. The unseen count is computed by the server: the app polls `GET /api/activity?limit=1&since=<last seen id>` together with its state poll and shows `newerThanSince`. (An id comparison in the browser would not do: the feed is ordered by when things happened, ids by when they were noticed.)

Paging, filtering and collapsing live in `src/shared/activity.ts` (`pageEvents`, `collapseTaskProgress`), so the server's `ActivityLog` and the demo site's mock API serve the feed with the same code.

### D8: The view
- Route `/activity`, nav entry **Activity** after *All changes*; `routeFromPath`/`href` extended like the other views (and the demo's hash routing).
- Day headers (`Today`, `Yesterday`, then dates); each entry: time, repository chip in the repository's colour (reusing `assignRepoHues`/`repo-tint`), change name in monospace, and a sentence per kind (`moved Specs → Ready`, `tasks 3/12 → 7/12`, `archived`, `session ended (exit 1)` …). Catch-up entries carry a subtle "while the dashboard was not running" marker. The change name links to `/repo/<id>` (the repository board); entries of untracked repositories are plain text.
- Filters: repository chips (same component as the board) and kind groups (*Changes*, *Tasks*, *Sessions*, *Repositories*), kept in the URL query like the board's filters. "Load older" pages with `before`.
- **Unseen count:** `localStorage["openspec-dashboard.activity.seen"]` holds the newest id the user has seen; the nav shows the number of newer events (capped at `99+`), and opening the feed marks everything seen. First visit ever: nothing is unseen.
- Pure helpers in `src/ui/activityState.ts` (group by local day, sentence per kind, unseen count), unit-tested without a DOM.

### D9: The invariant is amended explicitly
`CLAUDE.md` invariant 5 becomes: *"The repository is the source of truth. The dashboard indexes; everything it shows about the **current state** of a change is derived from the repositories. The one thing it keeps that cannot be re-derived is history: the activity log records what the dashboard observed and when. It is never an input to scanning, columns, counts or actions, and deleting it loses history only."* The same sentence is part of the `activity-feed` spec so it is testable ("deleting the log changes nothing but the feed").

## Risks / Trade-offs

- [Flip-flopping data sources (a change present in several checkouts) could produce `moved A → B`, `moved B → A` pairs] → Accepted as truthful ("this is what the board showed"); if it proves noisy, suppress a move that reverts the previous one within one poll interval.
- [Event time from `lastActivityAt` can be off when several things changed between scans] → It is only used when it falls inside the scan interval; `detectedAt` is always kept.
- [Archives arriving via `git pull` look like activity] → Only archive dates within the last 7 days produce `change-archived` for a change not seen before.
- [Renaming a change looks like remove + create] → Acceptable; there is no stable change identity beyond the name.
- [Log grows or gets corrupted] → Compaction bounds it; reading skips bad lines; the feature degrades to an empty feed, never to a failing scan.
- [Several dashboard processes on one home would interleave appends] → Same limitation as the existing cache and config files; appends of single lines below the pipe buffer size are atomic enough in practice.
- [Privacy: the log contains repository names and paths?] → Names and ids only, no paths, no output, no prompts; it stays in the dashboard home, which already holds the config with the paths.

## Verification (tasks 6.1–6.4)

- **Compiled binary, throwaway home, the synthetic fixtures as git repositories:** first start recorded one `repo-tracked` per repository and nothing per change; two task ticks over two scans were stored as two lines and served as one entry (`4/10 → 6/10`); moving a change directory into `archive/` gave `change-archived` with the column it left; a change created while the server was stopped was reported after restart with `catchUp` and timed by the file's modification time; after deleting `activity.jsonl` the board showed the same 32 changes and the feed was empty (the snapshot cache still existed, so no new baseline); `limit=0` → 400. The log contained no paths, and `git status` in the repositories showed only what the scenario itself had edited.
- **Headless Chrome, 260 seeded events over six days:** nav shows *Activity* after *All changes*; first visit ever shows no number and stores a baseline; with the seen marker seven events back the entry showed `7` and nothing after opening the feed; 100 entries, `Today` / `Yesterday` / dates; *Load older* → 200 without duplicates; filtering to *Sessions* and one repository put both into the query string, showed only those, and was identical after a reload; a change name links to `/repo/<id>`, entries of a repository that is no longer tracked are plain text and neutral in colour; filtered empty state; dark and light theme checked on screenshots.
- **Demo build from `file://`:** the feed is served by the mock API from the sample (made-up names only), with hash links and no network requests.
- A torn last line turned out to swallow the *next* appended event as well (it was glued onto the torn line); the log now starts a fresh line after an unterminated file. Found by `test/activityLog.test.ts`.

## Migration Plan

Additive: a missing `activity.jsonl` is an empty feed. On the first start with this version every tracked repository produces one `repo-tracked` entry (baseline). Rollback: previous binary; the file is ignored.

## Open Questions

- Backfill from git (archive dates, first commit of each change directory) to seed the feed for the time before the log — useful, but a separate, read-only-git change.
- Should `change-moved` into `Done`/`Synced` be highlighted as "needs you" (it means: archive me)? Left to a follow-up once the feed is in use.
