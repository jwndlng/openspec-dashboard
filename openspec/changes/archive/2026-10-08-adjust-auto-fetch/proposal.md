# Proposal

## Why

Auto fetch shipped opt-in, with five minutes as its shortest interval. In practice a pull request merges on GitHub and
the board keeps showing the branch as `pushed`, the conflict signal stays stale and cleanup has nothing to offer until
somebody switches auto fetch on for that project or pulls by hand. To see merged pull requests and conflicts quickly,
every project should fetch on its own unless the user says otherwise, and it should be possible to fetch much more
often than every five minutes.

## What Changes

- **Auto fetch is on by default.** A git project with a remote that has no saved auto-fetch setting is fetched
  **every minute**. The user can still pick another interval or switch it **Off** per project; Off is now a saved
  choice rather than the absence of a setting.
- **More intervals**: the drop-down offers **Off**, **Every 15 seconds**, **Every 30 seconds**, **Every minute**
  (the default), **Every 5 minutes**, **Every 10 minutes**, **Every 15 minutes**, **Every 30 minutes** and
  **Every hour**.
- The setting is stored in seconds: `autoFetchSeconds` replaces `autoFetchMinutes` on a repository. Absent means the
  default (every minute), `0` means Off. A configuration that still carries `autoFetchMinutes` is migrated on start to
  the same interval in seconds, so a choice made before this change is kept.
- `POST /api/repos/<id>/auto-fetch` takes `{ seconds }` — one of the intervals above, or `0` for Off — instead of
  `{ minutes }`. Choosing the default interval removes the key.
- What an automatic fetch runs, when it is skipped, how it coordinates with a pull, and that it never fast-forwards are
  unchanged. A fetch that is still running when the next one falls due (possible at 15 seconds with a slow remote) is
  not started a second time; the next attempt is one interval later.
- **Invariant change**: the automatic fetch is no longer only an opt-in. The read-only invariant (dashboard-api
  "never writes", `CLAUDE.md` invariants 1 and 4) changes from "for a project whose auto-fetch setting the user switched
  on" to "for every enabled git project with a remote, unless the user switched it off for that project". It still
  fetches only — remote-tracking refs, `FETCH_HEAD` and objects — never runs on a scan or page load, and never in the
  demo. The pull itself still runs only on request.
- Help, the tooltip, the fetch note beside Pull and What's new describe the new default and intervals.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `repository-pull`: auto fetch is on by default every minute, offers intervals from 15 seconds to an hour, can be
  switched off per project, and never overlaps itself.
- `dashboard-api`: the "never writes" requirement admits the automatic fetch for every project that has not switched it
  off; `POST /api/repos/<id>/auto-fetch` takes `{ seconds }`, with `0` for Off.
- `project-overview`: the Auto fetch drop-down gains the new intervals, shows **Every minute** for a project without a
  saved setting, and stores **Off** explicitly.

## Impact

- `src/shared/types.ts` — `AUTO_FETCH_SECONDS`, `DEFAULT_AUTO_FETCH_SECONDS`, `RepoConfig.autoFetchSeconds`, a helper
  for a repository's effective interval; `autoFetchMinutes` and `AUTO_FETCH_MINUTES` removed.
- `src/server/config.ts` — schema for `autoFetchSeconds`; `migrateConfig` converts `autoFetchMinutes`.
- `src/server/autoFetch.ts` — effective interval in seconds, default on, no second fetch of a repository whose fetch is
  still running.
- `src/server/api.ts` — the endpoint takes `{ seconds }`.
- `src/server/index.ts` — the comment on what is scheduled.
- `src/ui/projectSettings.tsx`, `src/ui/pullState.ts`, `src/ui/overview.tsx`, `src/ui/kanban.tsx`, `src/ui/api.ts`,
  `src/ui/untracked.tsx` (`Tracking.setAutoFetch`), `src/ui/helpContent.tsx`, `src/ui/changelog.ts`,
  `src/ui/demo/demoApi.ts`, `src/ui/demo/sampleData.ts` — the drop-down, labels, fetch note, Help, What's new, demo.
- `CLAUDE.md` — invariants 1 and 4; `README.md` — "What it touches" names Auto fetch.
- Tests: `test/autoFetch.test.ts`, `test/pull.test.ts`, `test/trackingApi.test.ts`, `test/demoApi.test.ts`,
  `test/projectSettingsUi.test.ts`, `test/pullUi.test.ts`, `test/settingsSections.test.ts`, a config migration test.
- No new dependency, no new git subcommand, no `gh`. Existing users without a setting start fetching every minute after
  upgrading.
