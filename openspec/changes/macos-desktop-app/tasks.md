# Tasks

## 1. Spike: prove the risky assumptions first

- [ ] 1.1 In a throwaway Electrobun 2.0.x app (`mainProcess: "bun"`, WKWebView) load `http://127.0.0.1:<port>/` of a running `bun run dev`; verify a POST to `/api/scan` and the terminal WebSocket of a fake session are accepted (no ATS block, `Origin: http://127.0.0.1:<port>`), and record whether `NSAllowsLocalNetworking` is needed in design.md
- [ ] 1.2 In the same spike verify `navigationRules` + `will-navigate` + `new-window-open` send a `target="_blank"` github.com link to the default browser while the window stays, and that ⌘C/⌘V work in an xterm terminal once an Edit menu is set; record findings in design.md

## 2. Server: version endpoint

- [x] 2.1 Add `GET /api/version` returning `{ name: "spec-control", version: VERSION }`, answered by the placeholder handler during startup too (`src/server/api.ts`, `src/server/index.ts`); verify with tests for the normal and the starting server, and that no process is spawned
- [x] 2.2 Add the endpoint to the dashboard-api spec's endpoint list in Help if Help lists endpoints; verify `bun run check` passes

## 3. Desktop logic (pure, tested without Electrobun)

- [x] 3.1 Create `desktop/src/logic/` with `decideStart(probe)` (attach / start / blocked) and `configuredPortFor(home)`, mirroring `configuredPort`'s rule; verify `test/desktop/start.test.ts` covers Spec Control body, refused connection, foreign body, timeout, and port values out of range
- [x] 3.2 Add `parseShellPath(stdout)` (sentinel-delimited) and `fallbackPath()`; verify tests with a banner-printing profile, an empty output and a missing sentinel
- [x] 3.3 Add `externalTarget(url, port)`; verify tests: same origin → none, other loopback port → external, `https:`/`mailto:` → external, `file:`/`javascript:`/custom schemes → dropped
- [x] 3.4 Add `quitPlan({ ownsServer, running })`; verify tests for attached vs owned and 0/2 running sessions
- [x] 3.5 Add a single-instance lock (`~/.spec-control/desktop/app.lock`, exclusive create, stale when the PID is gone); verify tests with a temp `SPEC_CONTROL_HOME` for live, stale and missing locks
- [x] 3.6 Include `desktop/src/logic` and `test/desktop` in the root typecheck and lint; verify `bun run check` passes without `desktop/node_modules`

## 4. Desktop app shell (Electrobun)

- [~] 4.1 Scaffold `desktop/` with its own `package.json`, lockfile, exact-pinned `electrobun` and the Hutch toolchain pinned in `hutch.config.ts` (Hutch is not an npm package, design D11), `electrobun.config.ts` (identifier, name, `mainProcess: "bun"`, `exitOnLastWindowClosed: false`, no `release.baseUrl`, no `Updater` import, `copy` of `../dist/spec-control`), icons; verify `bun run build:desktop` produces a dev `.app` that launches
- [~] 4.2 Wire start-up in `desktop/src/main.ts`: lock, login-shell `PATH`, probe, attach or spawn `spec-control --no-open`, wait for `/api/version`, open the window; error windows for blocked port and failed start (with last output and Retry); verify manually: fresh start, with a CLI already running (attached label, CLI survives quit), with `nc -l 4711` holding the port, and opened twice
- [~] 4.3 Wire the window: navigation rules, external links via `Utils.openExternal`, close hides, Dock `reopen` shows; application menu (App with Releases Page, Edit roles, View, Window) and menu bar item; verify manually per the spec scenarios (pull request link, paste into terminal, close during a session)
- [~] 4.4 Wire quit: cancel `before-quit`, `quitPlan`, confirmation naming the session count, SIGTERM and wait up to 10 s, then quit; verify manually that two running fake-agent sessions show as resumable after Quit, and that an attached CLI server keeps running

## 5. Release workflow

- [~] 5.1 Add the `desktop` job (macos-latest, `release` environment secrets, temporary keychain, build with the `darwin-arm64` binary from `build`, smoke checks: bundled `--version` equals the tag, `spctl --assess`, `stapler validate`) and rename the dmg to `Spec-Control-<tag>-darwin-arm64.dmg`; verify on a `v0.0.0-test`-style tag in a fork or a dry run with signing skipped
- [~] 5.2 Make `publish` need `desktop`, extend `SHA256SUMS` and the attestation to the dmg, extend the release-notes download section; verify the workflow lint (`actionlint`) passes and the notes template names the dmg
- [ ] 5.3 Set up the Apple Developer ID certificate and App Store Connect API key as `release` environment secrets (`MACOS_CERT_P12`, `MACOS_CERT_PASSWORD`, `ELECTROBUN_DEVELOPER_ID`, `ELECTROBUN_APPLEAPIKEY`, `ELECTROBUN_APPLEAPIISSUER`, `ELECTROBUN_APPLEAPIKEY_P8`, the `.p8` contents); verify by publishing the next release and checking the dmg opens on a clean Mac without `xattr`

## 6. Documentation

- [x] 6.1 README: the app as the macOS (Apple silicon) download, Intel → binary, updating the app through the releases page, signed/notarised app vs unnotarised binary; verify the Run section matches the release-publishing scenarios
- [x] 6.2 CONTRIBUTING: Releasing section names the `desktop` job and its secrets; `bun run build:desktop` for local builds; verify by reading
- [x] 6.3 CLAUDE.md: Layout gains `desktop/`, and a line that the app adds no network access (invariant 4 unchanged); verify `openspec validate macos-desktop-app --strict` and `bun run check` pass
