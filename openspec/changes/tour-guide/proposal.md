# Proposal

## Why

Someone opening the dashboard for the first time lands on an empty Projects page with a dense hero — Open work,
Console, Theme, Refresh, Auto-refresh, five tabs — and nothing explains what those are, how a change gets onto the
board, what the columns mean or what the dashboard will and will not do to their repositories. The only
documentation is the README on GitHub, which the dashboard does not link to and, being local-first, should not fetch.

## What Changes

- A **first-visit tour**: on the first load in a browser, a short step-by-step walkthrough points at the hero's
  controls and the main navigation one at a time (Projects, All changes, Activity, Pull requests, Settings, Console,
  Refresh / Auto-refresh, Theme, Help) with one or two sentences each, and can be skipped or finished at any step.
  Whether it was seen is remembered per browser in `localStorage`, like the theme — never on the server, never in the
  URL. A step whose control is not on screen (e.g. Console while agent sessions are off) is left out. The tour reads
  nothing from and writes nothing to any repository, and makes no request.
- A **Help page** at `/help`, a new **Help** tab at the end of the main navigation: built-in guidance that ships
  inside the UI bundle (no network) — getting started (workspace roots, enabling projects, creating a change), what
  each board column means, the change detail view, agent sessions and their actions, pull, cleanup and dismissal, pull
  requests and `gh`, what the dashboard writes and where (`~/.openspec-dashboard/`), and troubleshooting via the
  Environment section. It has a section list with `?section=` deep links, links into the relevant views, and a
  **Take the tour** button that restarts the tour.
- The column glossary on the Help page is keyed by the board's own stage list, so a new column cannot ship without an
  explanation (type-checked).
- In the **demo build** the tour does not start by itself (so the published screenshots and the first view stay
  clean); the Help page and **Take the tour** work there as in the dashboard.

## Capabilities

### New Capabilities
- `onboarding-tour`: the first-visit walkthrough — when it starts, its steps and anchoring, skipping, finishing,
  restarting, persistence of the "seen" flag, keyboard and screen-reader behaviour, and its behaviour in the demo.
- `help-page`: the `/help` route and Help tab, its sections and deep links, what the built-in documentation covers,
  the rule that it is bundled (no network), and the column glossary's completeness.

### Modified Capabilities
<!-- None: the main navigation's tabs are not enumerated in any spec, and the tour adds no server behaviour. -->

## Impact

- UI only, no server or API change, nothing written outside the browser's `localStorage`:
  - new `src/ui/tour.tsx` (overlay, highlight, step card), `src/ui/tourState.ts` (pure step list, filtering, storage
    helpers), `src/ui/help.tsx` and `src/ui/helpContent.tsx` (sections and text);
  - `src/ui/app.tsx` (Help tab, `/help` route, tour mount and first-visit start, `data-tour` anchors on hero controls),
    `src/ui/routes.ts` (`help` view), `src/ui/console.tsx` / `src/ui/sessions.tsx` only for `data-tour` anchors,
    `src/ui/styles.css`, `src/ui/icons.tsx` (help icon);
  - `src/ui/demo/main.tsx` (demo does not auto-start the tour);
  - `README.md` (mention the Help tab and the tour) and `CONTRIBUTING.md` (one line: a change that alters documented behaviour updates the Help text).
- Tests: `test/tourState.test.ts`, `test/helpContent.test.ts`, `test/routes` coverage for `/help`; demo bundle tests
  keep passing (no real paths or hosts in help text — only the project's own repository link).
- Invariants unchanged: no network (help text is bundled; the one outward link is the project's repository, a link the
  user follows), read-only towards repositories, loopback only.
