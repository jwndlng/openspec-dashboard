# Design

## Context

The running version is a build-time constant (`VERSION` in `src/server/version.ts`, `dev` unless the build defines a
tag), already served by `GET /api/version`. Release tags are `v<major>.<minor>.<patch>` (`release-publishing`). The
server already has one timer-driven network access, the automatic fetch (`src/server/autoFetch.ts`), planned by
`plan()` after every config write via `afterConfigChange` in `src/server/api.ts`, with injected `fetch`/`setTimer`
seams for tests. The UI already links to `RELEASES_URL` (`src/ui/whatsNew.tsx`) and keeps per-browser preferences
under `spec-control.<name>` (`src/ui/storage.ts`). The macOS app only shows the server's page, so anything the page
shows the app shows. The requirements are in `specs/update-notice/spec.md`; this document says how.

## Goals / Non-Goals

**Goals:**
- One small server module that owns the request, the parsing, the comparison, the schedule and the remembered result,
  testable without the network.
- The UI learns everything from `GET /api/update`; the page itself never talks to GitHub.

**Non-Goals:**
- Downloading, verifying or installing anything; a notice inside the app's own process; release notes rendered in the
  dashboard; pre-release or channel handling; telling the user about a newer version in the demo.

## Decisions

### `HEAD /releases/latest` and the redirect, not the REST API
`https://github.com/jwndlng/spec-control/releases/latest` answers `302` to `/releases/tag/<tag>` for the latest
published, non-draft, non-prerelease release. Reading only `Location` with `redirect: "manual"` gives the tag without a
body, without JSON parsing and without the REST API's 60-requests-per-hour unauthenticated limit shared per IP.
*Alternatives:* `api.github.com/repos/.../releases/latest` (JSON body, rate limit, more surface); `gh release view`
(needs `gh` signed in, and invariant 1 lists `gh` subcommands narrowly — adding one would widen it for no gain); a
version file on GitHub Pages (another thing to publish and keep in step). The location is validated strictly against
the expected host, path and tag form, so a changed redirect produces "failed", never a wrong banner.

### `fetch` with an explicit, minimal request
Bun's `fetch` with `method: "HEAD"`, `redirect: "manual"`, an `AbortSignal.timeout(10_000)`, and headers set to only
`User-Agent: spec-control/<VERSION>`. No cookies exist in the server's `fetch`, and no proxy or credential configuration
is read. The body is never consumed (a `HEAD` has none; the response is discarded).

### `UpdateChecker` mirrors `AutoFetcher`
`src/server/updateCheck.ts` exports pure helpers — `parseLatestLocation(location): string | undefined`,
`isNewer(latest, current): boolean` — and a class `UpdateChecker` with deps `{ getConfig, version, home, request?,
setTimer?, clearTimer?, now? }`:
- `plan()`: does nothing for `dev` or `updateCheck: false` except clear any timer; otherwise arms one timer for
  `max(60 s after start, lastCheckedAt + 24 h) - now`. Called once at start and from `afterConfigChange`, like
  `autoFetcher.plan()`; an unchanged due time keeps the existing timer.
- `check()`: one in-flight promise shared by the timer and `POST /api/update/check`; records `{ checkedAt, outcome,
  latest? }` (a failure keeps the last `latest` learned, so a flaky network does not hide a known update), writes it
  atomically to `~/.spec-control/update-check.json`, then re-plans.
- `status()`: the `UpdateStatus` for `GET /api/update`, computed from config, `VERSION` and the remembered record —
  no I/O beyond what `load()` read at start.
The URL is a constant in the module; tests inject `request` (or point it at a local `Bun.serve` that answers `302`), so
nothing a user can configure redirects the check. *Alternative:* an environment variable for the URL — rejected: it
would let the binary be pointed elsewhere and needs its own documentation and guard.

### Remembered state is a cache, not configuration
`update-check.json` lives beside `activity.jsonl` and the snapshot. A missing, unreadable or malformed file means
"never checked". It is never an input to anything but the update status, consistent with invariant 5.

### Config key: `updateCheck?: false`
Added to `configSchema` as `z.boolean().optional()` and normalised on save so only `false` is stored (`true` is
dropped), matching how `autoFetchSeconds` writes only non-defaults. `Config.updateCheck?: false` in
`src/shared/types.ts`, along with `UpdateStatus`.

### UI: a banner component and a Settings section
- `src/ui/updateBanner.tsx` renders above the header in `app.tsx`; its decision lives in a pure helper
  (`bannerVersion(status, dismissed)`), so the UI test covers it without a DOM. It reads `GET /api/update` on load and
  re-reads at most once an hour (`setInterval`, cleared on unmount); a successful Settings save that changes
  `updateCheck` re-reads at once. The dismissed version is stored under `storageKey("updateDismissed")` with the same
  try/catch as other keys.
- Links: release page `https://github.com/jwndlng/spec-control/releases/tag/<latest>` and How to update
  `https://github.com/jwndlng/spec-control#updating` (the README anchor). Both `target="_blank" rel="noopener"`, which
  the macOS app already sends to the default browser.
- The Updates section in `settings.tsx`, `"updates"` inserted before `"environment"` in `SECTION_IDS`. The switch is part
  of the draft; Check now calls `POST /api/update/check` directly (like Environment's fresh report, it does not join the
  draft) and is disabled while the saved or drafted value is off, or `current` is `dev`.
- Demo: `demoApi.ts` answers `GET /api/update` with `{ enabled: false, current: "demo", outcome: "never", available: false }` and refuses the check, so no banner and no request.

### Wiring
`index.ts` creates the checker after `AutoFetcher` (the server already serves `/api/version` by then, so "about a minute
after it starts serving" holds), calls `load()` then `plan()`, and stops it in `shutdown`. `AppState.updateChecker` is
read by the two routes in `api.ts`; `POST /api/update/check` sits behind `crossSiteRefusal` like every other mutating
route.

## Risks / Trade-offs

- [GitHub changes the redirect] → strict validation turns it into a silent "failed"; the Updates section shows it, and
  nothing wrong is announced.
- [Any network access is a privacy concern for a local-first tool] → one request a day, carrying only the version in
  `User-Agent`; documented in the README and help; off with one switch; `dev` never checks; the spec forbids anything
  else in the request.
- [Corporate proxies or firewalls block GitHub] → the check fails quietly every 24 hours; no retry storm.
- [Clock moves backwards] → a `lastCheckedAt` in the future is treated as "due now" capped by the 60-second start
  delay, so a skewed clock cannot suppress checks forever.
- [Banner fatigue] → dismissed per version; only a newer version brings it back.
- [Invariant drift] → CLAUDE.md invariant 4, the dashboard-api network sentence and the desktop-app requirement are
  changed in the same pull request as the code.

## Migration Plan

Nothing to migrate: a configuration without `updateCheck` means on. Users who upgrade see the banner only once a
release newer than theirs exists. Rollback is removing the module; the leftover `update-check.json` is ignored.
