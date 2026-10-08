# Design

## Context

See proposal.md for the motivation. Auto fetch landed in `auto-fetch-for-projects`: `RepoConfig.autoFetchMinutes`
(`AUTO_FETCH_MINUTES = [5, 15, 30, 60]`, absent = off), validated by a zod literal union in `src/server/config.ts`,
set through `POST /api/repos/<id>/auto-fetch` `{ minutes }`, scheduled by `AutoFetcher` in `src/server/autoFetch.ts`
(one `setTimeout` per eligible repository, re-armed on fire, queue with concurrency 3), and shown by `AutoFetchPicker`
in `src/ui/projectSettings.tsx` and `fetchNote` in `src/ui/pullState.ts`. `fetchRepository` in `src/server/pull.ts`
holds the per-repository lock and returns `{ skipped: true }` when anything is already fetching; its timeout is
`FETCH_TIMEOUT_MS` (60 s). `migrateConfig` already rewrites older configs on load and saves when it changed something.

## Goals / Non-Goals

**Goals:**
- One setting with three states — default (every minute), an explicit interval, explicit Off — that survives a later
  change of the default for users who never touched it.
- Sub-minute intervals without a fetch ever piling up behind a slow one.
- Keep a choice made under the old `autoFetchMinutes` key.

**Non-Goals:**
- A global (all projects) auto-fetch setting or a global default the user can change.
- Fetching at start-up instead of one interval after it; pruning; starting a `gh` query after a fetch.
- Changing what a fetch runs, the lock with the pull action, or the fetch note's wording beyond the interval text.

## Decisions

### D1 — `autoFetchSeconds`, absent = default, `0` = Off
`RepoConfig.autoFetchSeconds?: AutoFetchSeconds | 0`, with
`AUTO_FETCH_SECONDS = [15, 30, 60, 300, 600, 900, 1800, 3600] as const` and `DEFAULT_AUTO_FETCH_SECONDS = 60` in
`src/shared/types.ts`, plus `autoFetchInterval(repo): number | undefined` (seconds, or `undefined` when Off) used by the
scheduler, the picker and the fetch note so none of them re-implements the default. Canonical form: the endpoint
removes the key for `60` and stores `0` for Off, so the config only records departures from the default — the same
pattern as `autoMergeDocs: false` being removed. The zod schema is a literal union of the eight values and `0`, spelled
out next to the constant with a test that keeps them equal (as today).

*Alternatives:* keep minutes and allow `0.25`/`0.5` — fractional literals in a user-edited JSON file are error-prone;
`autoFetch: "off" | number` — two keys or a mixed type for one setting; `null` for Off — `JSON.stringify` keeps it but
zod `.optional()` and the "remove the key" convention elsewhere make `null` vs absent too easy to confuse.

### D2 — Migration in `migrateConfig`
For each repository entry with a numeric `autoFetchMinutes` and no `autoFetchSeconds`: set
`autoFetchSeconds = minutes * 60` (or drop it when that is `60`), delete `autoFetchMinutes`. An entry with both keeps
`autoFetchSeconds`. Anything that is not one of the old values is left in place for validation to report, like every
other migration there. `changed` then makes `loadConfig` save the migrated file once.

### D3 — Endpoint takes `{ seconds }` only
`postRepoAutoFetch` validates `seconds` against `AUTO_FETCH_SECONDS` and `0`, and refuses `null`, strings and
`{ minutes }` with `400`. UI and server ship in one binary, so there is no older client to keep working; the demo API
(`src/ui/demo/demoApi.ts`) mirrors the same validation.

### D4 — Scheduler: seconds, default on, no self-overlap
`AutoFetcher.dueMinutes` becomes `dueSeconds` using `autoFetchInterval`; `Planned.minutes` becomes `seconds`; `arm`
uses `seconds * 1000`. Eligibility is otherwise unchanged (enabled, scanned ok, git, has a remote) — so a dashboard
whose projects are all non-git or remote-less still schedules nothing. `fire` already re-arms first and dedupes the
queue; add a `running: Set<string>` so a repository whose fetch is still in flight is not enqueued again (today a
fire during a running fetch would enqueue it and `fetchRepository` would return `skipped` — harmless, but it occupies a
concurrency slot and is what the new spec sentence rules out explicitly). The interval keeps counting from the fire,
not from the end of the fetch, so with a 15 s interval and a 40 s fetch the next start is the first fire after it
finished, as the scenario states.

### D5 — UI
`AutoFetchPicker` lists `Off` (value `0`), then `AUTO_FETCH_SECONDS` with `autoFetchLabel(seconds)`: "Every 15
seconds", "Every 30 seconds", "Every minute", "Every 5 minutes" … "Every hour"; its value is
`autoFetchInterval(repo) ?? 0`. `Tracking.setAutoFetch(id, seconds)` and `api.setRepoAutoFetch(id, seconds)` pass the
number through. `fetchNote` takes `autoFetchSeconds` (the effective interval) and words it with the same helper in
lower case ("every minute"). The board header, row and tile pass `autoFetchInterval(repo)` instead of the raw key. The
tooltip, Help ("Pull and fetch" and the "what the dashboard writes" list) and a new What's new entry say it is on by
default every minute and can be switched off; the old changelog entry is history and stays as written.

### D6 — Invariant text
`CLAUDE.md` invariants 1 and 4 and the delta of the dashboard-api "never writes" requirement say "unless the user
switched it off for that project" instead of "the user switched on". `test/pull.test.ts` keeps its proof that scans,
discovery and the state endpoint never reach the remote with auto fetch on; the "nothing is fetched" proof sets
`autoFetchSeconds: 0` on every repository.

## Risks / Trade-offs

- [Every git project with a remote now contacts its remote every minute after upgrading, unasked] → That is the
  requested behaviour; What's new and Help say so and how to switch it off per project. The demo still never fetches.
- [SSH keys behind a passphrase, a hardware key or an agent that asks for approval (e.g. a password manager's SSH
  agent)] → Prompts stay disabled (`GIT_TERMINAL_PROMPT=0`, batch-mode SSH), so a key that needs a passphrase fails fast
  and the project shows "auto fetch failed" until it is switched off; an agent that pops up an approval dialog would do
  so every minute. The failure tooltip says the setting can be switched off; no automatic back-off (would hide state).
- [15 s intervals on many projects] → Concurrency stays 3, a repository is never queued twice, a fetch that moved
  nothing starts no rescan, and remote-less or non-git projects are never scheduled.
- [Rescans after every moving fetch at 15 s] → Only when refs moved; the scanner's `trigger()` coalesces with a scan in
  flight.
- [Downgrading to a binary that knows only `autoFetchMinutes`] → zod `object` strips unknown keys, so the old binary
  reads `autoFetchSeconds` as absent (= off in that version) and drops it on its next save; nothing breaks.

## Migration Plan

On first start the config's `autoFetchMinutes` values are converted (D2) and the file is saved once. Projects without
a setting start fetching one minute after start-up. Rollback: the previous binary ignores the new key (see Risks).
