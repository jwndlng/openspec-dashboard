## Context

The UI is a Preact SPA built by `scripts/build-ui.ts` into a single `dist/ui/index.html` with JS, CSS and both fonts inlined (~126 KB, no external requests). The server embeds that file and serves it for every non-API path. All server access goes through `src/ui/api.ts` (`state`, `config`, `saveConfig`, `discover`, `scan`) — there is no other `fetch` in the UI. Routing is History-API based with absolute paths (`/`, `/board`, `/repo/<id>`, `/settings`); filters and overview state live in the query string and are written with `history.replaceState(null, "", location.pathname + query)`.

Constraints: the repository is public while the maintainer's real board contains work-internal names; `repo-hygiene` forbids tracking generated files and requires a clean tree after a full build; workflows are read-only by spec; the project avoids new dependencies; several in-flight proposals will add write-style API operations.

## Goals / Non-Goals

**Goals:**

- A public demo that is the real UI, not a mock-up, and cannot go stale relative to `main`.
- A structural guarantee — not a convention — that demo and screenshots contain no data from anyone's machine.
- README screenshots produced by one command from the demo build.
- The demo keeps up with new API operations by construction.

**Non-Goals:**

- A demo of the server: scanning, discovery and git integration are not simulated beyond canned results.
- Shipping the demo inside the binary, or a `--demo` server flag (possible later; the sample data would be reusable).
- Persisting demo edits (no `localStorage` for demo state; theme preference keeps using it as today).
- Pixel-diff/visual regression testing of the screenshots.
- Committing screenshots or built HTML to the repository.

## Decisions

### D1. Inject the API implementation from the entry point

`api.ts` exports `interface Api`, `httpApi: Api` and a module-level current implementation with `setApi(impl)`; components keep importing `api`. `src/ui/main.tsx` uses HTTP (the default); `src/ui/demo/main.tsx` calls `setApi(demoApi)` and enables hash routing before rendering `<App />`.

Why: the production entry never imports `src/ui/demo/*`, so the sample data cannot end up in the shipped bundle regardless of tree-shaking behaviour, and no global build-time constant has to be declared for TypeScript. `demoApi` is declared as `Api`, so adding an operation to the interface without a demo counterpart is a type error in `bun run check`.

*Alternative — `define` a `__DEMO__` constant and branch in `api.ts`*: one entry point, but correctness of "sample data is not in production" then depends on the bundler's dead-code elimination. *Alternative — mock at the `fetch` level (service worker or patched `fetch`)*: no seam needed, but service workers do not run on `file://`, and it hides the contract instead of typing it.

### D2. Sample data is a typed module with relative ages

`sampleData.ts` exports a function `buildSample(now: number): { snapshot: Snapshot; config: Config; candidates: RepoConfig[] }`. Dates are written as ages (`daysAgo(12)`), materialised against `now`, including archive dates. The object literals use `satisfies` so drift from `src/shared/types.ts` is a compile error. `column`/`stage` are derived with the shared `columns.ts` logic rather than hand-written, so the sample cannot disagree with the board rules.

Content (fictional, under `/home/demo/work/…`): 5–6 repositories, ~35 open changes covering every column incl. `New`, `Done` and `Synced`, a branch-matched change, a stale one, a "no tasks" warning, a load warning, one repository with `ok: false`, and 30+ archived changes so `Archived` shows `25 of N`.

Not included: a repository on a second schema. It would add artifact columns to the combined board, which already has nine (≈2550px); the screenshot is taken at 2560px wide for that reason.

*Alternative — run the real scanner over `test/fixtures/` at build time*: exercises more real code, but fixtures are minimal by design, have no git history (everything "just now"), and would bake the build machine's absolute paths into a public page.

### D3. Privacy is enforced by structure plus two tests

Structure: demo code is browser-only and imports nothing from `src/server/`; it cannot read `~/.openspec-dashboard` or the file system. Tests: (1) every `path` in the sample starts with the fictional prefix and no string in it matches a home-directory pattern (`/Users/`, `/home/<not demo>`, `C:\Users`); (2) after `build:demo`, the HTML contains the demo marker and none of those patterns; after `build:ui`, the HTML does not contain the demo marker. The screenshot script only accepts the demo build as input — it starts no server and takes no URL argument.

### D4. Hash routing in demo mode, via one URL helper

A small `url.ts` owns all reads and writes: `currentPath()`, `currentQuery()`, `navigate(path)`, `replaceQuery(query)`, `href(path)`, with a mode switch (`"path"` default, `"hash"` for the demo). In hash mode the route lives in the fragment and the query stays in the real query string: `index.html?repos=a,b#/board`. `replaceQuery` preserves the fragment — today's `pathname + query` write would drop it. `routeFromPath` stays pure and unchanged; links render `href(path)` so middle-click/new-tab works in both modes.

Why hash: works identically on a Pages project sub-path, any static host and `file://`, with no 404 fallback page and no base-path configuration. *Alternative — base-path aware History routing plus a `404.html` redirect*: nicer URLs, but Pages-specific, breaks on `file://` (Chrome rejects `pushState` to another path there), and needs the deploy path known at build time.

### D5. The mock API is stateful in memory only

`state()` returns the sample with the current in-memory config applied (disabled repositories disappear from the snapshot). `scan()` sets `generatedAt` to now, so the UI's "poll until the snapshot changes" loop finishes on the first poll. `saveConfig()` validates nothing beyond types, stores in memory and returns it; `discover()` returns the canned candidates not already tracked. Calls resolve after a short delay (~150 ms) so loading states are visible but screenshots stay fast. A reload restores the original sample — the banner says so.

### D6. Screenshots: headless Chrome CLI, no new dependency

`scripts/screenshots.ts` finds Chrome/Chromium (env `CHROME_BIN`, then well-known paths), and for each of `board-dark`, `board-light` (and `overview-dark`) runs `--headless=new --screenshot` against `file://…/dist/demo/index.html#/board` at 2560×1300 (nine columns; overview at 1440×440) with a virtual-time budget, the colour scheme forced through a Blink setting. Each run is wrapped in a hard timeout and verified by checking the PNG exists and is non-trivial in size — headless Chrome has been observed to write the file and then not exit while the page keeps polling. Output goes to `dist/demo/screenshots/` (ignored by git).

*Alternative — Playwright/Puppeteer*: more control, but a large dev dependency and browser download for three PNGs; ubuntu runners already ship Chrome.

### D7. Publish with a dedicated workflow; keep CI read-only

`pages.yml` runs on pushes to `main` (and manual dispatch): a read-only `build` job runs `build:demo` + `screenshots` and uploads the Pages artifact; a `deploy` job — the only job with `pages: write` and `id-token: write` — deploys it. It never runs for pull requests, so untrusted code never sees a write-scoped token. `ci.yml` stays read-only and additionally runs `build:demo`, so a broken demo blocks the pull request rather than the deploy. Actions are SHA-pinned like the existing ones and covered by the existing Dependabot group.

### D8. README references Pages-hosted images

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://<owner>.github.io/openspec-dashboard/screenshots/board-dark.png">
  <img alt="…" src="https://<owner>.github.io/openspec-dashboard/screenshots/board-light.png">
</picture>
```

Screenshots are therefore always current with `main`, need no frozen clock, and add no binaries to git. *Alternative — commit PNGs under `docs/`*: survives forks, offline clones and Pages outages, but churns binary blobs on every UI tweak, needs deterministic rendering to avoid noise, and sits awkwardly with "generated files are never tracked".

## Risks / Trade-offs

- [README images are broken until Pages is enabled and the first deploy has run, and in forks] → enabling Pages is an explicit task; the alt text and the demo link still work; revisit D8 (commit PNGs with a frozen clock) if forks matter.
- [Blink's colour-scheme setting is not a documented CLI contract] → the script asserts the result by checking the rendered `data-theme` via `--dump-dom` in the same configuration; fallback is a demo-only `?theme=` override.
- [Every new API operation now needs a demo implementation] → intended: it is a compile error, not a silent gap; operations that make no sense in a demo resolve with a typed "not available in the demo" error the UI already renders as an API error.
- [Sample data rots as board rules change (new columns, new warnings)] → `column`/`stage` are derived, types are enforced, and a test asserts every board column has at least one sample card.
- [Hash-mode and path-mode diverge] → one helper, unit-tested in both modes; components never touch `location`/`history` directly (lint-able with a grep test).
- [Deploy workflow widens the permission surface] → write scopes on one job, `main` only, no PR trigger, environment `github-pages`.

## Migration Plan

1. Land the API seam and URL helper (no behaviour change in the normal build; existing tests keep passing).
2. Land demo data, mock API, demo build, tests and the CI build step.
3. Enable Pages (source: GitHub Actions), land `pages.yml`, confirm the first deploy.
4. Only then add the demo link and `<picture>` to the README.

Rollback: remove the README block and disable the workflow; nothing in the shipped binary depends on the demo.

## Open Questions

- Screenshot hosting (D8): Pages-hosted is the recommendation; switch to committed PNGs if fork/offline rendering turns out to matter.
- Which views to screenshot beyond the combined board — overview and a repository board, or keep the README to one hero image?
