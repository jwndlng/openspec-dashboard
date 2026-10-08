# Design

## Context

See proposal.md for the motivation. Today `src/server/pull.ts` is the only module that contacts a remote. Its
`pull()` runs `inspect()` to choose the remote (the upstream's remote, else `origin`), then
`git -c gc.auto=0 -c maintenance.auto=false fetch --no-recurse-submodules --quiet <remote>` with
`GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`, batch-mode SSH and `FETCH_TIMEOUT_MS`, and only then decides about the
fast-forward. `pullRepository()` holds a per-repository `inFlight` set and throws `PullBusyError` (→ `409`) for a second
request. Per-project settings are saved through the small per-repository endpoints in `src/server/api.ts`
(`postRepoAgent`, `postRepoPrTitleConvention`, `updateRepo`) and shown by `src/ui/projectSettings.tsx`. Work statuses
are cached for 15 s in `SessionManager.worktrees()`; the scanner rescans on `trigger()`.

The invariant this touches is stated three times — `openspec/specs/dashboard-api/spec.md` ("never writes"),
`repository-pull` and `CLAUDE.md` invariants 1 and 4 — and all three say a fetch happens only on the user's click. The
user explicitly asked for a timer, opt-in per project, fetch only (no fast-forward).

## Goals / Non-Goals

**Goals:**
- One shared fetch implementation for Pull and auto fetch, so both have identical remote choice, flags, prompts,
  timeout and masking — no second way to contact a remote.
- A scheduler that is cheap when nothing is configured (no timers at all) and re-plans immediately on a setting change.
- Work statuses and the board reflect a fetch that moved something within one rescan.

**Non-Goals:**
- Fast-forwarding the main checkout on a timer (the user chose fetch only).
- Starting a pull-request query (`gh`) after a fetch. The pull-request watch and `endMergedAutoMerge` keep their own
  triggers; auto fetch only feeds git-derived state (`merged`, conflicts, cleanup candidates).
- `--prune`, fetching all remotes, fetching linked worktrees' upstreams, or fetching tags beyond git's defaults.
- Persisting auto-fetch outcomes across restarts; a global (all-projects) setting.

## Decisions

### D1 — Fetch-only entry point in `pull.ts`, sharing the lock
Extract the fetch step of `pull()` into `fetchRemote(path, before, timeoutMs)` and add
`fetchRepository(repo, { fetchTimeoutMs })` that returns `{ ok, at, reason?, moved }` and runs nothing else. `moved`
compares `git for-each-ref --format=%(refname) %(objectname) refs/remotes/` before and after (read-only, already in the
allowed list). Keeping it in `pull.ts` keeps the CLAUDE.md statement "the only place that contacts a remote" true.

The per-repository `inFlight` set becomes a map of `{ kind: "pull" | "auto", done: Promise }`:
- `pullRepository` / `resolvePullRepository`: if the running entry is a `pull`, throw `PullBusyError` as today; if it is
  `auto`, await its `done` and then claim the slot (re-check, loop if a pull got in first → `PullBusyError`).
- `fetchRepository` (auto): if anything is running, return `{ skipped: true }` without running git.

*Alternative:* refuse a pull during an auto fetch with `409`. Rejected: a background timer would make the user's click
fail intermittently with "already pulling" that they did not start.

### D2 — `AutoFetcher` in `src/server/autoFetch.ts`, one timer per opted-in repository
`new AutoFetcher({ getConfig, getSnapshot, onMoved(repoId), fetch = fetchRepository, now, setTimer })`. `plan()` is
called at start-up and after every config write: for each repository it computes the desired interval
(`enabled && autoFetchMinutes` and the last snapshot says `ok && isGit && hasRemote`), keeps an existing timer whose
interval is unchanged, clears timers that are no longer wanted, and (re)arms one `setTimeout` per changed repository for
one interval from now. When a timer fires it re-checks eligibility against the current config and snapshot (a setting
switched off between arm and fire runs nothing), enqueues the repository, and re-arms for one interval later regardless
of the outcome (no retry storm). The queue runs with `PULL_ALL_CONCURRENCY`. Timers are `unref`'d so tests and shutdown
are not held open. In the demo the API is faked in the UI, so no `AutoFetcher` exists there; the server simply never
plans in demo builds.

`hasRemote` is not on `RepoSnapshot` today; the scanner adds `hasRemote` and `lastFetchedAt` (D4) so eligibility needs
no extra git at plan time. A repository whose scan failed is skipped until a scan succeeds and `plan()` runs again
(the scanner's `onSnapshots` hook calls `plan()`).

*Alternative:* one global `setInterval` ticking every minute and fetching whatever is due. Rejected: it wakes up even
when nothing is opted in and makes "one interval after the change" fuzzy by up to a minute.

### D3 — After a fetch that moved refs: drop the work-status cache, then rescan
`onMoved(repoId)` calls `sessions.forgetWorktreeCache()` (a small new method clearing `worktreeCache`) and
`scanner.trigger()`. A fetch that moved nothing triggers neither. A rescan already in flight is reused by `trigger()`,
which is fine: the next poll picks up anything it missed. The manual pull path gets the same cache drop, so a pull also
shows `merged` immediately.

### D4 — Last fetch time read from the repository; outcome from memory
The scanner reads `git rev-parse --git-path FETCH_HEAD` (read-only) and `stat`s it: its mtime is `lastFetchedAt`, which
also covers fetches the user ran in a terminal (proposal: the repository is the source of truth). `hasRemote` comes from
the same check `inspect()` uses. The `AutoFetcher` keeps `Map<repoId, { at, ok, reason? }>` and the scanner attaches it as
`RepoSnapshot.autoFetch` via a `ScannerOptions.autoFetchStatus(repoId)` callback. A successful pull records an `ok`
outcome too, which clears a shown failure (spec: "A pull clears a failure"). It is display-only and never read by
columns, counts or actions.

### D5 — Config and endpoint
`repoSchema` gains `autoFetchMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]).optional()`
and `RepoConfig.autoFetchMinutes?: AutoFetchMinutes` (`AUTO_FETCH_MINUTES = [5, 15, 30, 60] as const` in
`src/shared/types.ts`, used by the server validation and the drop-down). `POST /api/repos/<id>/auto-fetch` follows
`postRepoPrTitleConvention`: validate `minutes`, `updateRepo` (removing the key for `null`), then `autoFetcher.plan()`.
`PUT /api/config` accepts the field through the same schema, and Settings' save keeps it like the other per-repository
fields it carries over (check `settings.tsx` merges repos as last received, as for `prTitleConvention`).

### D6 — UI
`AutoFetchPicker` in `projectSettings.tsx`, modelled on `PrTitlesPicker` (git only, shown regardless of agent sessions,
`tracking.setAutoFetch(id, minutes | null)` in `Tracking`). It goes in the row's inline settings and as a labelled line
in the tile's Settings panel after Docs auto-merge. The last-fetch note is a pure helper `fetchNote(repo, snapshot, now)`
in `pullState.ts` (`fetched 4m ago` / `never fetched` / `auto fetch failed`, with tooltip text) rendered beside the
Pull control on the row, tile and board header. The demo API stores the setting and reports a plausible
`lastFetchedAt`; it never fetches.

## Risks / Trade-offs

- [Invariant drift: "never on a timer" is quoted in several places] → Update the dashboard-api requirement,
  repository-pull and both CLAUDE.md invariants in this change, and add a test that a scan, discovery and page load still
  contact no remote with auto fetch on (recording remote, as `test/pull.test.ts` does).
- [A fetch rewrites `FETCH_HEAD` and refs while the user works in a terminal] → Same as a manual pull today; optional
  locks are off and no index is touched. Concurrent `git fetch` by the user can contend for ref locks; the auto fetch then
  fails, is reported, and retries next interval.
- [Credentials: SSH keys behind a passphrase or a credential helper that prompts] → Prompts are disabled, so the fetch
  fails fast and the overview shows "auto fetch failed" with the reason instead of hanging; nothing is retried sooner.
- [Many projects opted in at the same interval all fall due together] → Bounded concurrency; each timer is armed from
  its own setting time, which spreads them naturally.
- [Other changes editing the same dashboard-api requirement later] → The delta only adds item (9) and the
  "automatic fetch" clauses; when archiving, merge onto whatever version of the requirement is current rather than
  replacing it.

## Migration Plan

Additive and off by default: existing configs have no `autoFetchMinutes`, so nothing changes until a user picks an
interval. Rolling back to an older binary that does not know the key: check that the older `repoSchema` tolerates
unknown keys (zod `object` strips them); otherwise the user sets it Off before downgrading.
