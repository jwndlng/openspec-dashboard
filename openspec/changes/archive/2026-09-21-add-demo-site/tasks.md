## 1. API seam (no behaviour change)

- [x] 1.1 In `src/ui/api.ts` introduce `interface Api`, rename the current object to `httpApi: Api`, and export the current implementation with `setApi(impl)`; keep `api.*` call sites working unchanged
- [x] 1.2 Add a test that `setApi` swaps the implementation used by `api.state()` and that the default is HTTP
- [x] 1.3 `bun run check` passes; the built `dist/ui/index.html` behaves as before

## 2. URL helper and hash routing

- [x] 2.1 Add `src/ui/url.ts` with a routing mode (`"path"` default, `"hash"`), `currentPath()`, `currentQuery()`, `navigate(path)`, `replaceQuery(query)` (preserves the fragment) and `href(path)`; keep it free of DOM access at import time
- [x] 2.2 Move `navigate` out of `routes.ts` into the helper (re-export if needed) and replace direct `location`/`history` use in `app.tsx`, `kanban.tsx` and `overview.tsx`, including link `href`s and the `popstate`/`hashchange` listener
- [x] 2.3 Unit-test the helper in both modes: route parsing from `#/repo/<id>`, query kept in the search string, `replaceQuery` keeps the fragment, path mode produces today's URLs
- [x] 2.4 Add a grep-style test that no file under `src/ui/` other than `url.ts` and `theme.ts` references `location.` or `history.`

## 3. Sample data

- [x] 3.1 Create `src/ui/demo/sampleData.ts` exporting `buildSample(now)` → `{ snapshot, config, candidates }`, using `satisfies` against the shared types, ages via `daysAgo()`/`hoursAgo()` helpers, and `column`/`stage` derived through `src/shared/columns.ts`
- [x] 3.2 Author the content under `/home/demo/work/…`: 5–6 fictional repositories, ~35 open changes covering every column, a branch match, a stale change, "no tasks" and load warnings, one `ok: false` repository, 30+ archived changes, 3 discovery candidates (a repository on another schema was dropped: it adds board columns and pushes the board past any sensible screenshot width)
- [x] 3.3 Tests: every path starts with `/home/demo/`; no string matches the home-directory patterns; every board column has ≥ 1 card; archived > 25; dates move with `now`

## 4. Mock API, banner and demo entry

- [x] 4.1 Create `src/ui/demo/demoApi.ts: Api` — in-memory config, `state()` applies enabled/disabled repos, `scan()` bumps `generatedAt`, `discover()` returns untracked candidates, ~150 ms simulated latency
- [x] 4.2 Tests for the mock API: scan changes `generatedAt`; saving a config with a repo disabled removes it from `state()`; a fresh instance restores the original sample; discovery excludes tracked repos
- [x] 4.3 Add `src/ui/demo/banner.tsx` ("Demo — sample data, nothing is saved" + repository link) styled with existing tokens in both themes
- [x] 4.4 Add `src/ui/demo/main.tsx`: `setApi(demoApi)`, hash routing mode, render banner + `<App />`; confirm `src/ui/main.tsx` imports nothing from `src/ui/demo/`

## 5. Demo build

- [x] 5.1 Refactor `scripts/build-ui.ts` so the HTML assembly is shared and a second target builds `src/ui/demo/main.tsx` to `dist/demo/index.html` (title "OpenSpec Dashboard — Demo", includes a demo marker comment); add `build:demo` to `package.json`
- [x] 5.2 Bundle-guard test: after building both targets, the demo HTML contains the marker and no home-directory pattern; the normal HTML contains neither the marker nor a sample repository name
- [x] 5.3 Open `dist/demo/index.html` from `file://` and check: overview, combined board, a repository board, Settings (disable a repo, save, reload restores), Refresh completes, filters survive reload, theme button works

## 6. Screenshots

- [x] 6.1 Add `scripts/screenshots.ts` and the `screenshots` script: locate Chrome (`CHROME_BIN`, then known macOS/Linux paths), render `file://…/dist/demo/index.html#/board` at 2560×1300 (plus the overview at 1440×440) in dark and light, hard timeout per run, verify each PNG exists and is larger than a sanity threshold; input is fixed to the demo build (no URL argument)
- [x] 6.2 Verify the forced colour scheme actually took effect (e.g. `--dump-dom` shows the expected `data-theme`); if Blink's setting proves unreliable, add a demo-only `?theme=` override and note it in design.md
- [x] 6.3 Confirm `dist/demo/` is ignored and `git status --porcelain` is empty after `build:demo` + `screenshots`

## 7. CI and publishing

- [x] 7.1 Add a `Build demo` step to `.github/workflows/ci.yml` (before the clean-tree check)
- [x] 7.2 Add `.github/workflows/pages.yml`: triggers `push` to `main` + `workflow_dispatch`; read-only `build` job (install, `build:demo`, `screenshots`, upload Pages artifact); `deploy` job with `pages: write` + `id-token: write`, environment `github-pages`; all actions SHA-pinned; concurrency group so deploys do not overlap
- [x] 7.3 (Done 2026-09-20: enabled via the API with `build_type=workflow`; the first deploy had failed with 404 until then. The account's Pages site uses the custom domain `blog.wndlng.ch`, so the demo is served from `https://blog.wndlng.ch/openspec-dashboard/` and the `github.io` URL redirects there.) Maintainer: enable GitHub Pages with source "GitHub Actions" in the repository settings, then run the workflow and confirm the demo and both screenshots are reachable

## 8. Docs

- [x] 8.1 (Done in the same pull request; images resolve once 7.3 and the first deploy have happened.) Add the "Live demo" link and the `<picture>` block (dark/light, alt text) near the top of `README.md`
- [x] 8.2 Document in `CONTRIBUTING.md`: how to extend the sample data (fictional names only, `/home/demo/` paths), that a new API operation needs a demo implementation, and how to regenerate screenshots locally
- [x] 8.3 `bun run check` passes and `openspec validate add-demo-site --strict` passes
