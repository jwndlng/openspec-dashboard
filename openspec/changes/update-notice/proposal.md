# Proposal

## Why

Nobody running Spec Control learns about a new version unless they visit the releases page. That goes for both the
command-line binary and the macOS app. Installing an update in place, as `desktop-app-updates` planned, would need a
Developer ID to verify the download, and releases are now ad-hoc signed (`unsigned-macos-app`). A notice that names the
new version and links to its release is enough: the user downloads it and replaces the binary or the app. Every setting,
session and worktree lives in `~/.spec-control/`, so replacing the program loses nothing.

The software already knows its own version: a release binary reports its tag through `--version` and `GET /api/version`,
and the app is built from the same tag. No new versioning is needed. All that is missing is comparing that version with
the latest release.

## What Changes

- **Update check, in the server.** The server learns the tag of this project's latest GitHub release with one
  unauthenticated `HEAD` request to `https://github.com/jwndlng/spec-control/releases/latest`, reading only the
  redirect's `Location`. It checks once shortly after start, then at most once every 24 hours, remembering the last check
  under `~/.spec-control/` so restarts do not check again. The first check is about a minute after start. A failed check is silent and counts as a check. A `dev` build
  never checks, and neither does the demo. The request carries no identifier, configuration, path, repository name or
  usage data.
- **Banner.** When the latest release is newer than the running version, a thin banner at the very top of every view
  says so, with links to the release notes and to how to update. It can be dismissed for that version, per browser.
  The same banner shows in the macOS app's window, because the app shows the server's page.
- **Setting.** Settings gains an **Updates** section with **Check for new versions** (on by default). Turning it off
  stops every check at once and hides the banner. Its configuration key `updateCheck: false` is written only when the
  setting is off. The section shows the running version, the last check and its result, and a **Check now** button, disabled while checks are off.
- **API.** `GET /api/update` returns what the server last learned, without contacting anything. `POST /api/update/check`
  runs a check now (refused while checks are off), under the same-origin guard.
- **Invariant change.** Invariant 4 and the dashboard-api network rule gain a third exception, the update check. The
  macOS app's own process still makes no request. The desktop-app "idle app" guarantee now applies with the update
  check off.
- README: the notice, how to turn it off, and how to update the binary and the app (quit, replace, your data stays).

## Capabilities

### New Capabilities
- `update-notice`: the check (what it requests, when, what it reads), the banner, the setting, `GET /api/update` and
  `POST /api/update/check`, and the demo.

### Modified Capabilities
- `dashboard-api`: the "never writes" requirement's network sentence admits the update check as a third network
  access, and its "No network unless asked" scenario assumes the check is off.
- `settings-page`: the section list gains Updates (`updates`), before Environment.
- `desktop-app`: "The app makes no network request of its own" keeps the app's own process off the network. Its
  idle-app scenario now assumes the update check is off, and the server's check is named as how a new version is
  noticed.
- `release-publishing`: the README documents the update notice, how to turn it off, and how to replace the app or the
  binary.

## Impact

- `src/server/updateCheck.ts` (new): the request, the tag parsing, `isNewer`, the schedule and the remembered result in
  `~/.spec-control/update-check.json`.
- `src/server/config.ts`, `src/shared/types.ts`: `Config.updateCheck?: false` and the `UpdateStatus` shape.
- `src/server/api.ts`, `src/server/index.ts`: the two endpoints and starting and re-planning the check from the config.
- `src/ui/updateBanner.tsx` (new), `src/ui/app.tsx`, `src/ui/settings.tsx`, `src/ui/settingsSections.ts`,
  `src/ui/api.ts`, `src/ui/storage.ts`, `src/ui/styles.css`, `src/ui/helpContent.tsx`, `src/ui/changelog.ts`,
  `src/ui/demo/demoApi.ts`.
- `README.md`, `CLAUDE.md` (invariant 4 and the desktop layout note).
- Tests: a new `test/updateCheck.test.ts` (a local HTTP server stands in for GitHub, so no test uses the network), API
  tests for both endpoints and the config key, UI tests for the banner and the setting, and the demo API test.
- No new dependency, and no `gh` or git. `desktop-app-updates` stays paused. If in-place installs come back, that
  change builds on this one.
