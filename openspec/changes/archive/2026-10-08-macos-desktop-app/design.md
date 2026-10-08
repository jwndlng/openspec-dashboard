# Design

## Context

The server is a compiled Bun binary (`src/server/index.ts`, Bun 1.4.2). The only seams a wrapper can use from outside
are these:

- `--port N` and `--no-open`.
- The stdout line `spec-control listening on http://127.0.0.1:<port>`.
- SIGINT/SIGTERM. Both end every running session as resumable (`SessionManager.shutdown`), then exit 0.

Some facts about the current server matter here:

- A busy port makes the process die with an unhandled rejection.
- No endpoint carries the version.
- `crossSiteRefusal` and `webSocketRefusal` (`src/server/api.ts`) accept only an `http:` loopback Origin on the same
  port, and the terminal WebSocket needs an Origin. So the page must be loaded from `http://127.0.0.1:<port>`.
- Executables are found with `Bun.which` against `process.env.PATH`.
- External links are `<a target="_blank">`.

Electrobun 2.0.x, researched on 2026-10-08:

- **Platforms:** macOS 14+ on arm64 only. Intel was dropped (upstream issue #560). There is no cross-compilation.
- **Build:** apps are built with Hutch (`hutch electrobun build --env=stable`).
- **Main process:** a Bun-compatible runtime, by default Cottontail. `build.mainProcess: "bun"` gives real Bun, pinned
  at 1.4.0.
- **Window:** WKWebView by default. A `BrowserWindow` can load any URL.
- **Links:** `target=_blank` and `window.open` raise `new-window-open` instead of opening anything. `navigationRules`
  block navigation natively, and `will-navigate` reports what was blocked.
- **Menus:** there is no default Edit menu (`ApplicationMenu` roles exist) and no single-instance lock (upstream #465).
- **Close and quit:** `will-close` and `before-quit` can be cancelled. `before-quit` is synchronous.
- **Updater:** opt-in (`Updater.checkForUpdate/downloadUpdate/applyUpdate`). It reads
  `<baseUrl>/stable-macos-arm64-update.json` and a `.app.tar.zst`.
- **Network:** no other network call or telemetry was found in the SDK.
- **Packaging:** a stable `.app` is a small self-extractor that unpacks the real app into a managed location on first
  launch.

## Goals / Non-Goals

**Goals:**
- The app adds no behaviour to the server. Every server guarantee holds because it is the same binary, started the
  same way.
- All of the app's logic that can be tested lives in plain modules that `bun test` runs without Electrobun.
- Keep the CLI's dependency tree and build untouched.

**Non-Goals:**
- Intel, Windows or Linux apps. Electrobun 2 cannot build an Intel app, and Linux users run the binary.
- An embedded server running inside the app's own process.
- Update checks and installing updates: the follow-up change `desktop-app-updates`. Launch at login, deep links, a
  Dock-less mode.
- Changing the CLI's busy-port behaviour. The app probes before it starts the server, so the CLI never sees that case
  from the app.

## Decisions

### D1. The server is a child process running the release binary (sidecar), not code in the app's process
The app bundles `dist/spec-control` (built in the same workflow run for `darwin-arm64`) under the `.app`'s Resources.
It starts it with `Bun.spawn([binary, "--no-open"], { env: { ...process.env, PATH } })`. The port is not passed: the
binary reads its own configured port, so the CLI and the app always agree. The app learns the port as follows:

- It reads the same config with a copy of `configuredPort`'s rule (the home is `SPEC_CONTROL_HOME`, else
  `~/.spec-control/`, else the old home; the value is `port` if it is an integer from 1024 to 65535, else 4711).
- It checks that reading against the stdout line. A mismatch is treated as a start failure.

Alternatives:
- *Import the server into the app's main process.* This would tie the server to Electrobun's pinned Bun 1.4.0 (the
  repo uses 1.4.2) and to its worker threading, where PTY behaviour is unverified. It would also need `main()` to be
  restructured, and it would fork "what the server is" into two builds.
- *Pass `--port`.* This would let the app and the CLI disagree about the port, and with it the browser storage origin.

### D2. Electrobun main process is `bun`, renderer is the system WKWebView
The main process only spawns, fetches, reads one config file and manages windows. Cottontail would probably be enough.
Real Bun avoids any doubt about `Bun.spawn` and `fetch` semantics, and costs about 5 MB. No CEF: WKWebView is about
130 MB smaller, and xterm.js runs in Safari already. Because the app only runs a separate binary, its pinned Bun
version does not matter to the server.

### D3. Probe, attach or start: `GET /api/version` decides
The new endpoint is answered by the placeholder handler too, so a server that is still starting identifies itself. The
probe uses a 1-second timeout and has three outcomes, as a pure function `decideStart(probeResult)`:

| Probe result | Outcome |
| --- | --- |
| `{ name: "spec-control" }` | `attach`: show it, never stop it. |
| Connection refused | `start`. |
| Anything else (other body, timeout, non-JSON) | `blocked`: an error window names the port and the `port` setting. |

When the server starts, the app polls `/api/version` every 200 ms. It shows the window on the first good answer and
stops at 15 s or when the child exits. A version mismatch between an attached server and the app is shown, not acted
on.

Single instance: Electrobun has no lock. The app takes an exclusive lock file under `~/.spec-control/desktop/`
(`O_EXCL`, holding the PID, treated as stale when that PID is gone). A second launch finds a live lock and exits; macOS
then activates the running app through its `reopen` event. Most second launches never get that far, because
LaunchServices already re-focuses a running bundle. The lock catches the cases it misses, such as a second copy of the
`.app` and launches from a terminal.

### D4. Login-shell PATH: one `$SHELL -l -c` with a sentinel, five-second limit
The app runs `[$SHELL || "/bin/zsh", "-l", "-c", "printf '%s' \"__SC_PATH__${PATH}__SC_PATH__\""]` with stdin closed
and a 5 s kill. The command is non-interactive, so `.zshrc` is not read, while `.zprofile` and `path_helper` are; this
is where Homebrew puts itself. A pure `parseShellPath(stdout)` takes what is between the sentinels, which survives
banners that profiles print.

Fallback `PATH` is `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`. Only `PATH` is taken; no other
variable is read.

Alternative: `-i` (interactive) as VS Code does. It catches tools added only in `.zshrc`, such as nvm and asdf shims,
but runs prompt frameworks, which hang or print control sequences. Start with `-l`. If agent CLIs installed through nvm
are missed, add a sentinel-guarded `-il` retry. That is a change within this design.

### D5. Window, links, menus
- **Window and links:**
  - The window is `new BrowserWindow({ url: "http://127.0.0.1:<port>/" })` with `navigationRules` as follows: allow
    `http://127.0.0.1:<port>/*`, block everything else.
  - `will-navigate` with `allowed: false` and `new-window-open` both go through a pure `externalTarget(url, port)`. It
    returns the URL to hand to `Utils.openExternal` for `http(s):` and `mailto:` only, and returns nothing for any other
    scheme, which is dropped.
  - No preload script and no RPC are registered, so the page has no bridge (spec: no bridge).
- **Menus:**
  - `ApplicationMenu` gets App (About, Releases Page, Quit), Edit (roles), View
    (Reload, zoom) and Window menus.
  - A template `Tray` offers Open Spec Control, Releases Page and Quit. Releases Page calls `Utils.openExternal` with
    the releases URL, so the browser fetches it, not the app.
- **Window closing:** `runtime.exitOnLastWindowClosed: false`. `will-close` is cancelled and the window hidden instead,
  so it keeps its state (scroll, open terminal) and reopens instantly. `reopen` (a Dock click) shows it.

### D6. Quit: decide synchronously, stop asynchronously
`before-quit` cannot await, so the sequence is:

1. Always cancel it and run `requestQuit()`.
2. `requestQuit()` reads `GET /api/sessions` and counts the sessions in state `running`, but only when the app started
   the server.
3. If any are running, it asks with a native message box.
4. It sends SIGTERM to the child, waits up to 10 s for it to exit, and only then sends SIGKILL.
5. It sets a `quitting` flag and calls `Utils.quit()` again, which `before-quit` then lets through.

An attached server is never signalled. The decision is the pure `quitPlan({ ownsServer, running })`, which returns one
of `exit`, `confirm(n)` or `stop`.

### D7. No updater in this change
The Electrobun `Updater` is not imported and `release.baseUrl` is not set, so the build downloads no previous release
and the app never fetches anything. Updating means downloading the new `.dmg`; the Releases Page item points there.
`desktop-app-updates` adds the check on top of this shell.

### D8. Repository layout and build
- **`desktop/`** holds its own `package.json` and lockfile with `electrobun` (exact version pinned) and `hutch` as
  dev dependencies, plus the following:
  - `electrobun.config.ts`: identifier `ch.wndlng.spec-control`, name `Spec Control`, `mainProcess: "bun"`,
    `mac.codesign/notarize` true for stable, `copy` of `../dist/spec-control` into Resources, and icons.
  - `src/main.ts`: the Electrobun wiring only.
  - `src/logic/*.ts`: the pure functions above, with no Electrobun import.
- **Tests** live in `test/desktop/*.test.ts` in the root `bun test` run, importing `desktop/src/logic/` directly. The
  root `tsconfig`/biome include `desktop/src/logic` only, so `bun run check` needs no Electrobun install.
- **Scripts:** `bun run build:desktop` in the root runs `bun run build`, then
  `cd desktop && bun install && hutch electrobun build --env=stable`.

### D9. Release workflow
A new `desktop` job runs on `macos-latest` (arm64), after `build`. The workflow:

1. Downloads the `darwin-arm64` binary artifact.
2. Imports the Developer ID certificate into a temporary keychain from `MACOS_CERT_P12` and `MACOS_CERT_PASSWORD`.
3. Sets `ELECTROBUN_DEVELOPER_ID` and the App Store Connect API key (`ELECTROBUN_APPLEAPIKEY*`), which do not expire
   like app passwords and need no 2FA.
4. Builds and runs the smoke checks: the bundled binary's `--version` equals the tag, `spctl --assess`, and
   `xcrun stapler validate` on the `.dmg`.
5. Uploads `macos-arm64-Spec Control.dmg` renamed to `Spec-Control-<tag>-darwin-arm64.dmg`. The updater's
   `update.json` and `.app.tar.zst` are not uploaded.

The `publish` job:

- `needs: [build, desktop]`.
- `SHA256SUMS` expects 4 binaries + 1 dmg.
- It attests all of them.
- `--clobber` stays.

The secrets are environment secrets of a `release` environment, used only by the `desktop` job. The workflow triggers
only on `release: published`, never on pull requests.

### D10. Invariant 4 unchanged
The app's process requests only `127.0.0.1`, and the server is unchanged, so invariant 4 and the `dashboard-api`
network sentence need no edit. CLAUDE.md's Layout gains `desktop/`.

### D11. Findings during implementation
- **Hutch is not an npm package.** The `hutch` on npm is an unrelated project. Electrobun 2's npm package `electrobun`
  is only a bootstrap: it downloads the Hutch toolchain matching its exact version from Electrobun's GitHub releases,
  checks its SHA-256, and forwards `electrobun <cmd>` to `hutch electrobun <cmd>`; the SDK (`electrobun/main`) is
  projected into `desktop/.hutch/devkit`, not `node_modules`. So `desktop/package.json` pins only `electrobun` (exact),
  and `desktop/hutch.config.ts` pins the Electrobun version Hutch uses. `desktop/tsconfig.json` extends the projected
  devkit; `src/main.ts` is therefore typechecked only after a desktop build, never by the root `bun run check`.
- **The lock and the home migration.** The server's one-time home migration refuses to run when both `~/.spec-control/`
  and `~/.openspec-dashboard/` exist (`both`). Creating `~/.spec-control/desktop/app.lock` before the server's first
  start would cause exactly that for a user who still has only the old home. So the app takes no lock while only the
  pre-rename home exists (`appHome` returns nothing) and takes it once the server it started has answered, by which
  time the server has moved the home.
- **Error windows are native message boxes** (`Utils.showMessageBox`, Retry / Quit), not pages: a page would need a
  bridge back to the app for Retry, and the spec forbids one for the dashboard's window. The failed-start box carries
  the binary's last 40 lines of output.
- **Reload and zoom** are menu actions calling `webview.loadURL` (the last in-origin URL) and `setPageZoom`, so no
  script is ever run in the page.
- **Icons** are drawn from `src/ui/logoMark.ts` at build time (`desktop/scripts/prepare.ts`) and rasterised with
  AppKit (`desktop/scripts/rasterise.swift`; `qlmanage` paints an opaque white ground, which a template image cannot
  have). No image is checked in.
- **ATS.** App Transport Security does not apply to connections to IP addresses, so `http://127.0.0.1:<port>` should
  load without `NSAllowsLocalNetworking`; the spike (task 1.1) confirms this on a built app before release.
- **The `.p8` key** is stored as the secret `ELECTROBUN_APPLEAPIKEY_P8`; the job writes it to a temporary file and
  passes that path as `ELECTROBUN_APPLEAPIKEYPATH`, which is what Electrobun reads.

## Risks / Trade-offs

- **Electrobun 2 is young and changes fast** (betas weekly). → Pin the exact version in `desktop/package.json` and
  `hutch.config.ts`. Upgrade only in a dedicated change.
- **Origin and ATS for `http://127.0.0.1` in WKWebView are undocumented.** → Task 1 is a spike that proves the
  terminal WebSocket and a POST work before anything else is built. If ATS blocks loopback HTTP, add
  `NSAllowsLocalNetworking` via a `postWrap` Info.plist edit, which is narrower than `NSAllowsArbitraryLoads`.
- **The self-extractor unpacks to a managed location** (outside `~/.spec-control/`, under the user's Library). This is
  the app's own installation, not dashboard data, and is accepted. Upstream #540 (direct invocation after extraction)
  does not affect us, because the app is launched from Finder and the Dock.
- **No updates in the first app version.** → Its users update by hand once, through Releases Page.
  `desktop-app-updates` follows.
- **Signing secrets in CI.** → An environment-scoped secret, used by one job on `release: published`. A temporary
  keychain is deleted at job end.
- **Intel users get no app.** → The README directs them to the binary. If Electrobun restores x64, a follow-up adds it.
- **Bundle size of about 70 MB** (Bun runtime + our 60 MB binary, so about 130 MB unpacked, less as `.dmg`). → Accepted.
  Sharing one Bun runtime is not possible with a sidecar.
- **Login-shell `PATH` misses `.zshrc`-only tools.** → The environment report already names missing tools. D4 has a
  planned `-il` retry.

## Migration Plan

This is additive, and the CLI is unchanged. The first release with the app needs the Apple Developer membership and
the secrets in place before the draft is published. Without them the `desktop` job fails, and by the release spec
nothing is attached. The rollback is to revert the workflow's `desktop` job, after which releases are CLI-only as
before. Installed apps keep working.

## Open Questions

- The final app icon artwork. The tray uses a template monochrome glyph derived from the favicon.
