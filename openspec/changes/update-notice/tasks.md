# Tasks

## 1. Shared shape and configuration

- [x] 1.1 Add `UpdateStatus` (`enabled`, `current`, `latest?`, `checkedAt?`, `outcome: "never" | "ok" | "failed"`, `available`) and `Config.updateCheck?: false` to `src/shared/types.ts`; verify with `bun run typecheck`
- [x] 1.2 Accept `updateCheck` as an optional boolean in `configSchema` (`src/server/config.ts`), storing only `false` and dropping `true`; verify with config tests that `true` is dropped, `false` is kept, a string is refused with `400` and a config without the key loads unchanged

## 2. The update check (`src/server/updateCheck.ts`)

- [x] 2.1 Implement `parseLatestLocation` (only `https://github.com/jwndlng/spec-control/releases/tag/v<major>.<minor>.<patch>`) and `isNewer` (numeric, `dev` and other forms never older); verify with unit tests for `v0.9.3` < `v0.10.0`, equal and older tags, other hosts, `nightly`, missing location
- [x] 2.2 Implement the request: `HEAD`, `redirect: "manual"`, 10-second timeout, only `User-Agent: spec-control/<version>`, body never read; verify with a test whose local `Bun.serve` records the request and asserts method, path, no query, no body, no cookie or authorization header and the user agent
- [x] 2.3 Implement `UpdateChecker` with `load()`, `plan()`, `check()` (one in flight, failures keep the last `latest`), `status()` and `stop()`, persisting `{ checkedAt, outcome, latest? }` atomically to `~/.spec-control/update-check.json` (missing or malformed file = never checked); verify with tests using injected `request`, timers and clock: first check about 60 s after start, no check within 24 h of the remembered one, a failure is retried only after 24 h, a future `checkedAt` does not suppress checks, two concurrent `check()` calls make one request
- [x] 2.4 Make `plan()` arm nothing for `dev` and for `updateCheck: false`, and clear an armed timer when the config turns it off; verify with tests that turning it off before the timer fires makes no request and turning it on re-arms

## 3. Server wiring and API

- [x] 3.1 Create, load, plan and stop the checker in `src/server/index.ts`, hold it on `AppState`, and call `plan()` from `afterConfigChange` in `src/server/api.ts`; verify the server starts under `bun run dev` and that a config save re-plans (test)
- [x] 3.2 Add `GET /api/update` (no network, no write) and `POST /api/update/check` (same-origin guard, `409` when not allowed, joins a running check) to `src/server/api.ts`; verify with API tests for both, including a cross-site post refused and `409` with `updateCheck: false`
- [x] 3.3 Prove no side effects: a scan, discovery and `GET /api/update` start no check, and a check starts no git or `gh` process and leaves fixture repositories byte-for-byte unchanged; verify with tests alongside the existing network tests

## 4. UI

- [x] 4.1 Add `updateStatus()` and `checkForUpdate()` to `src/ui/api.ts` and the matching answers to `src/ui/demo/demoApi.ts` (`enabled: false`, `current: "demo"`, check refused); verify with the demo API test that no request leaves the page
- [x] 4.2 Build `src/ui/updateBanner.tsx` with a pure `bannerVersion(status, dismissed)` helper, mounted above the header in `src/ui/app.tsx`: text, Release notes and How to update links (new tab), dismiss stored under `spec-control.updateDismissed` with try/catch, polite live region, keyboard reachable, re-read on load and hourly; verify with UI tests for available, dismissed, newer-than-dismissed, disabled and not-available cases
- [~] 4.3 Style the banner in `src/ui/styles.css` for light and dark themes and narrow screens; verify by running the dashboard with a stubbed status and checking a 360 px wide window has no horizontal scroll
- [x] 4.4 Add `"updates"` before `"environment"` in `SECTION_IDS` and the Updates section in `src/ui/settings.tsx`: the Check for new versions switch in the draft, the running version, last check and outcome, Check now (disabled while off, while the draft turns it off, and for `dev` with the reason shown), and a re-read of the banner after a save that changes the setting; verify with settings tests for the section order, the `?section=updates` deep link and the disabled states
- [x] 4.5 Explain the update notice, what it sends and how to turn it off in `src/ui/helpContent.tsx`; verify the help page renders the new text

## 5. Documentation and invariants

- [x] 5.1 Add an **Updating** section to `README.md` (anchor `#updating`): the banner, the one request it sends, how to turn it off, and how to replace the binary or the app with data kept in `~/.spec-control/`; verify the banner's How to update link resolves to that anchor
- [x] 5.2 Update `CLAUDE.md`: invariant 4 gains the update check as a third network exception, and the `desktop/` layout note says the server's update check is how the app notices a new version; verify the wording matches the dashboard-api delta

## 6. Verification and What's new

- [~] 6.1 Run `bun run check` and `bun run build`, start `dist/spec-control` built with `SPEC_CONTROL_VERSION=v0.0.1`, and confirm `GET /api/update` reports a check about a minute later and the banner appears; confirm a plain `bun run build` (`dev`) makes no request
- [x] 6.2 Add a What's new entry at the top of `src/ui/changelog.ts` announcing the update notice and the Settings → Updates switch; verify the What's new dialog shows it
