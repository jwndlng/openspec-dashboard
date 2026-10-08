# Proposal

## Why

Whether a session's branch has been merged — and whether it still merges cleanly — is only as fresh as the
repository's last fetch, and today the only fetch the dashboard makes is the user's own Pull. So a pull request that
merged on GitHub shows as `pushed` until somebody remembers to pull, and work-status `merged`, the conflict signal and
cleanup all lag behind. Users want a project to keep its remote-tracking refs current on its own, at an interval they
choose, so merged pull requests show up without a manual step.

## What Changes

- New per-project setting **Auto fetch** on the projects overview (row and tile Settings panel): a drop-down with
  **Off** (the default), **Every 5 minutes**, **Every 15 minutes**, **Every 30 minutes** and **Every hour**, saved at
  once like the other project settings. Shown only for a git repository.
- While it is on, the server fetches that project's remote on that interval — **fetch only**: the same `git fetch` the
  pull action runs (same remote choice, no prompts, no hooks, no auto-maintenance, no submodules, a timeout, masked
  errors), and never the fast-forward, a merge, a prune or anything else. The main checkout's branch, index and working
  tree are never touched by it.
- After an automatic fetch that moved a remote-tracking ref, the project is rescanned and its work statuses are
  recomputed, so a merged branch shows `merged` and the conflict signal is current, without a page reload.
- An automatic fetch never runs at the same time as a pull of the same project; a manual pull that arrives during one
  waits for it instead of being refused. It is skipped for a disabled project, a non-git folder, a project without a
  remote, a project whose last scan failed, and in the demo.
- The overview shows, next to the project's Pull control, when it was last fetched and, when the last automatic fetch
  failed, that it failed and why.
- New endpoint `POST /api/repos/<id>/auto-fetch` with `{ minutes: 5 | 15 | 30 | 60 | null }`; the configuration gains
  an optional per-repository `autoFetchMinutes`.
- **Invariant change**: today a fetch happens only on the user's explicit Pull, "never on a timer". This makes one
  exception — a fetch-only timer the user switched on for that one project — and updates the read-only invariant
  (dashboard-api, `CLAUDE.md` invariants 1 and 4) accordingly. The pull itself (the fast-forward) still runs only on
  request.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `repository-pull`: adds the opt-in automatic fetch — what it runs, when it runs and when it is skipped, how it
  coordinates with the pull action, and that it never fast-forwards.
- `dashboard-api`: the "never writes" requirement admits the timed fetch as the one fetch not started by a click; the
  per-repository settings endpoints gain `POST /api/repos/<id>/auto-fetch`.
- `project-overview`: the per-project settings gain the **Auto fetch** drop-down, and the overview shows when a project
  was last fetched and whether its automatic fetch failed.

## Impact

- `src/server/pull.ts` — a fetch-only entry point sharing the pull action's fetch, remote choice and per-repository
  lock; the pull waits for a running automatic fetch.
- `src/server/autoFetch.ts` (new) — the per-project schedule, started and re-planned from the config.
- `src/server/config.ts`, `src/shared/types.ts` — `autoFetchMinutes` on a repository; the last automatic-fetch outcome
  and last fetch time on `RepoSnapshot`.
- `src/server/api.ts`, `src/server/index.ts` — the new endpoint; wiring the scheduler, rescan and work-status refresh.
- `src/server/scanner.ts`, `src/server/source.ts`, `src/server/git.ts` — read whether a repository has a remote and
  the time of its last fetch (`FETCH_HEAD`), read-only.
- `src/ui/projectSettings.tsx`, `src/ui/overview.tsx`, `src/ui/overviewState.ts`, `src/ui/kanban.tsx` (board
  header), `src/ui/untracked.tsx` (`Tracking`), `src/ui/api.ts`, `src/ui/pull.tsx`, `src/ui/pullState.ts`,
  `src/ui/styles.css`, `src/ui/helpContent.tsx`, `src/ui/demo/demoApi.ts`, `src/ui/demo/sampleData.ts` — the
  drop-down, the last-fetch note, Help, the demo.
- `CLAUDE.md` — invariants 1 and 4.
- Tests: `test/pull.test.ts`, a new `test/autoFetch.test.ts`, `test/trackingApi.test.ts`, `test/demoApi.test.ts` and
  the overview, pull and settings UI tests.
- No new dependency, no new git subcommand, no `gh`.
