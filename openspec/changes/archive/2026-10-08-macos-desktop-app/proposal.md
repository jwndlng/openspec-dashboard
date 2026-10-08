# Proposal

## Why

Today Spec Control is a binary you start from a terminal, which then opens a browser tab. That is fine for people who
live in a terminal, but it means a quarantine prompt (`xattr -d com.apple.quarantine`), a terminal window that must stay
open while agents run, and a tab that gets lost among other tabs. On macOS, where most users of agent CLIs work, a
regular application (download, drag to Applications, open from the Dock) removes that friction. The CLI stays the core:
the app is a thin shell around the same binary, not a second implementation.

## What Changes

- New **macOS desktop app** `Spec Control.app`, built with Electrobun, for Apple silicon (`darwin-arm64`) only — Electrobun 2 no longer builds for Intel Macs, which keep using the `darwin-x64` binary:
  - It starts the very same `spec-control` binary it bundles as a child process (`--no-open`) and shows
    `http://127.0.0.1:<port>` in its own window. The page is loaded from that loopback origin directly, so the
    cross-site and WebSocket guards apply unchanged and are not loosened.
  - When the configured port already serves a Spec Control (a CLI the user started), the app shows that one instead of
    starting a second server, and leaves it running when it quits. A port held by something else is reported, not
    worked around.
  - It resolves the user's login-shell `PATH` before starting the server, so `git`, `gh`, `openspec` and agent CLIs
    installed with Homebrew, npm or similar are found even when the app is opened from Finder.
  - Closing the window does not stop the server or running agent sessions: the app stays in the menu bar. **Quit**
    stops the server like `Ctrl+C` does today and asks first while agent sessions run.
  - Links to other hosts (github.com) open in the default browser, never inside the app window.
  - A standard application menu so copy, paste, select-all, reload and zoom work in the window and its terminals.
  - A **Releases Page** menu item that opens this project's GitHub releases in the default browser. The app itself
    makes no network request: updating this first version means downloading the new `.dmg`.
- Automatic update checks are a separate change, `desktop-app-updates`, which depends on this one: they are the only
  part that adds network access, and they can only be tested end to end once an app has been released.
- New endpoint `GET /api/version` (`{ name, version }`) so the app can tell a running Spec Control from any other
  program on the port.
- **Release**: publishing a release also builds, signs with a Developer ID, notarises and attaches
  `Spec-Control-<tag>-darwin-arm64.dmg`. The CLI binaries are
  unchanged and still attached.
- No Intel, Windows or Linux app. No change to how the CLI is started or behaves.

## Capabilities

### New Capabilities
- `desktop-app`: the macOS app shell — starting or reusing the server, the window, login-shell environment, menu bar
  and quit behaviour, and external links; the app makes no network request of its own.

### Modified Capabilities
- `release-publishing`: a release also attaches a signed, notarised macOS app image; the README
  documents the app and drops the "not notarised" caveat for it.
- `dashboard-api`: adds `GET /api/version`, a read-only endpoint naming the program and its version.

## Impact

- New `desktop/` directory (Electrobun project: `electrobun.config.ts`, app main process, icons) with its own
  `package.json` and lockfile, so the CLI's dependencies stay as they are.
- `src/server/api.ts`, `src/server/version.ts`: the version endpoint. `src/server/index.ts` is not restructured.
- `.github/workflows/release.yml`: a macOS app job (signing and notarisation with repository secrets: a Developer ID
  certificate, App Store Connect API key or Apple ID app password, team ID); the `SHA256SUMS` step counts the new assets.
- `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` (Layout gains `desktop/`). Invariant 4 is unchanged: the app adds no
  network access.
- Prerequisite outside the repository: an Apple Developer Program membership for the signing certificate.
- Tests: the version endpoint; the app's pure logic (login-shell `PATH` parsing, port probe decision, quit decision,
  external-link decision) as unit tests runnable without Electrobun; no test starts the app or uses
  the network.
