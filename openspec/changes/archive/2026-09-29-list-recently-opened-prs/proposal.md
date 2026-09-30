# Proposal

## Why

With several agent sessions shipping work in parallel across many repositories, pull requests pile up on GitHub and
it is easy to lose track of which ones are waiting for a review. The dashboard already knows every tracked repository,
but it has no view of their pull requests — today the user has to visit each repository on GitHub. A single list of
recently opened pull requests with their status, overall and per project, closes that gap.

## What Changes

- New **Pull requests** view at `/pull-requests`, in the top navigation after *Activity*: every open pull request of
  all tracked repositories plus those merged or closed in the last 7 days, newest first, each with repository, number,
  title (linking to GitHub), author, head branch, age, state (open, draft, merged, closed), review decision and checks
  summary. Filters for repository, state and "review requested from me"; the filters persist in the URL.
- **Per project**: the projects overview shows each repository's open pull-request count (table column and tile), and
  the repository board header gets a **pull requests** control that opens a dialog with that repository's list.
- Data comes from the **GitHub CLI** (`gh pr list --json …`, plus `gh api user` for the viewer's login), run without a
  shell, without prompts, with a timeout, outside any tracked repository, for repositories whose `origin` remote is on
  `github.com`. gh's own sign-in is used; the dashboard never sees, stores or asks for credentials.
- **When GitHub is contacted**: only when the user activates **Refresh** in one of these places, or when the user opens
  the Pull requests view or a repository's pull-request dialog and the cached list is older than 5 minutes. Never on a
  timer, during a scan, on the overview or on page load elsewhere. The overview only shows the cached counts.
- Results are cached in memory and in `~/.openspec-dashboard/pull-requests.json`, so counts survive a restart; the
  cache is display-only and never an input to scanning, columns or actions.
- A repository that is not on GitHub, or a machine where `gh` is missing or not signed in, shows a plain
  "unavailable" state with the reason instead of an error.
- New API: `GET /api/pull-requests` (cached, no network) and `POST /api/pull-requests/refresh` (same-origin guard).
- The demo simulates pull requests with synthetic data and no network.
- **Invariant change**: a second, enumerated network exception next to the pull action — read-only `gh` queries on the
  user's request. `CLAUDE.md` invariants 1 and 4 and the agent-sessions note ("never calls `gh`") are updated.

### Non-goals

- Acting on pull requests (merge, approve, comment, close) — the dashboard stays read-only towards GitHub.
- GitHub Enterprise hosts, GitLab, Bitbucket and other forges.
- Linking pull requests to OpenSpec changes or agent sessions (possible follow-up).
- Notifications or background polling.

## Capabilities

### New Capabilities
- `pull-requests`: fetching pull requests through the GitHub CLI (when, how, what, caching, failure states) and the
  Pull requests view with its filters.

### Modified Capabilities
- `dashboard-api`: the "never writes" requirement gains the read-only `gh` query as an enumerated network exception;
  new pull-request endpoints.
- `project-overview`: open pull-request count per repository on the overview, and the pull-request control and dialog
  on the repository board (added as new requirements, leaving the existing row and header requirements — which other
  in-flight changes modify — untouched).
- `demo-site`: pull requests are simulated in the demo.

## Impact

- **Server**: new `src/server/pullRequests.ts` (gh runner, remote → `owner/name`, parsing, cache, refresh
  coordination); `src/server/api.ts` (two routes); `src/server/paths.ts` (cache path); `src/shared/types.ts`
  (pull-request types).
- **UI**: new `src/ui/pullRequests.tsx` and `src/ui/pullRequestsState.ts`; `src/ui/routes.ts`, `src/ui/app.tsx` (nav
  entry and route), `src/ui/api.ts`, `src/ui/overview.tsx` (count), the repository board header (control and dialog),
  `src/ui/icons.tsx`, `src/ui/styles.css`; demo: `src/ui/demo/demoApi.ts`, `src/ui/demo/sampleData.ts`.
- **Tests**: new `test/pullRequests.test.ts` with a fake `gh` executable on `PATH` (no network), route tests, UI state
  tests.
- **Docs**: `CLAUDE.md` invariants 1 and 4 and the agent-sessions section, `README.md`.
- **Overlap with in-flight changes**: `add-cleanup-capabilities` also modifies the `dashboard-api` "never writes"
  requirement; this change's delta is written on top of that version (its six entries) and must be archived after it.
  `simplify-kanban-board` and `add-cleanup-capabilities` modify `project-overview` rows and header; this change only
  adds requirements there, but its code touches the same overview and header components.
- **Dependency**: the `gh` CLI at runtime, optional — without it the feature reports itself unavailable.
