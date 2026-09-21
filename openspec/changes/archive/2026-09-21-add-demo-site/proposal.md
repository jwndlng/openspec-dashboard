## Why

A newcomer cannot see what the dashboard looks like without installing Bun, building it and pointing it at their own OpenSpec repositories — and the README has no picture at all. The maintainer's own board cannot be used for that: it shows real, partly work-internal repository and change names, and this repository is public. We want a public, always-current demo and README screenshots that are **guaranteed** to contain only made-up data.

## What Changes

- Add a **demo build** of the real UI: same components, styles and routes, but wired to an in-memory **mock API** and a **synthetic sample dataset** instead of the HTTP API. Output is one self-contained `dist/demo/index.html` (like the normal UI bundle) that works from any static host, from a sub-path, and when opened from disk.
- The sample dataset is a typed module checked into the repo: a handful of fictional repositories with enough changes to show every board feature (all columns, repository groups and colours, branch badge, warnings, a repository in scan error, a bounded `Archived` column, the Projects overview, Settings with discovered candidates). Ages are stored relative to "now" so the demo never looks abandoned.
- **Never real data**: the demo build has no code path to the local config, cache or file system; repository paths in the sample all live under a fictional prefix; a test fails the build if the demo bundle contains anything that looks like a real home directory, and another that the production bundle does not contain the sample data.
- The mock API behaves enough for the UI to be explored: Refresh completes, Settings edits apply in memory and are gone on reload, discovery returns canned candidates. A slim banner says "Demo — sample data, nothing is saved" and links to the repository.
- Make the UI's API access a **typed interface with two implementations** (HTTP and demo), chosen by the entry point. A new API operation without a demo counterpart then fails type checking — relevant for the upcoming `create-change-from-dashboard` and `run-agent-actions-from-ui` changes.
- Demo mode uses **hash routing** (`#/board`, `#/repo/<id>`), because the normal History-API routes assume the app owns the site root and break on a project sub-path and on `file://`. Normal builds keep today's URLs.
- Add a **screenshot script** that renders the demo build in headless Chrome (dark and light, fixed viewport) — the only sanctioned source of README screenshots.
- Add a **deploy workflow**: on pushes to `main`, build the demo, take the screenshots and publish both to GitHub Pages. Nothing generated is committed. The README links the live demo and embeds the screenshots from Pages with a `<picture>` element that follows the reader's colour scheme.

## Capabilities

### New Capabilities
- `demo-site`: the demo build (mock API, synthetic data and its privacy guarantees, server-less navigation, demo banner), the screenshot generation, and publishing to GitHub Pages with the README entry points.

### Modified Capabilities
- `repo-hygiene`: "Continuous integration gates every pull request" currently says workflows MUST request only read permissions. It gains a narrowly scoped exception for the Pages deploy job (`pages: write`, `id-token: write`, pushes to `main` only, never pull requests), and CI additionally builds the demo so a broken demo blocks a pull request.

## Impact

- `src/ui/api.ts`: `Api` interface, `httpApi`, and an injectable current implementation. `src/ui/main.tsx` selects HTTP; new `src/ui/demo/main.tsx` selects the demo API and hash routing.
- New `src/ui/demo/`: `sampleData.ts` (typed, relative ages), `demoApi.ts`, `banner.tsx`.
- `src/ui/routes.ts` plus the three places that touch `location`/`history` directly (`app.tsx`, `kanban.tsx`, `overview.tsx`): go through one small URL helper so path and query handling work in both routing modes (today `replaceState` would drop the hash).
- `scripts/build-ui.ts`: build a second target (`bun run build:demo`); `scripts/screenshots.ts` (new, `bun run screenshots`, needs a local Chrome/Chromium; no new npm dependency).
- `.github/workflows/ci.yml`: build the demo. `.github/workflows/pages.yml` (new): build, screenshot, deploy.
- `test/`: sample-data invariants, demo API behaviour, bundle guards, hash-route parsing.
- `README.md`: live-demo link and screenshots near the top. `CONTRIBUTING.md`: how to update sample data and regenerate screenshots.
- One manual step outside the repo: enable GitHub Pages with source "GitHub Actions" in the repository settings.
- No server, API-contract, config-file or runtime dependency changes. The shipped binary does not contain the demo.
