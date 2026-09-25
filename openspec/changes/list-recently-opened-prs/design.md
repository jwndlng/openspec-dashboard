# Design

## Context

The dashboard is local-first and, apart from the user-triggered pull action (`src/server/pull.ts`), never touches the
network. It never calls `gh`: Ship only asks the agent to open a pull request. So it can't tell today which pull
requests exist for the repositories it tracks.

What already exists and can be reused:

- `originUrl()` and `normalizeRemote()` in `src/server/git.ts` turn any `origin` form into `host/owner/name`. Discovery
  uses them for "same remote as".
- `pull.ts` has the patterns for an external process: `Bun.spawn` with no shell, `stdin: "ignore"`, a kill timer,
  `maskCredentials()`, bounded concurrency, and a per-repository "already running" guard.
- UI patterns: the Activity view (top-nav page, repository colours, URL-persisted filters) and the branches dialog on
  the repository board header (`checkout.tsx`, `Modal`).
- The demo runs the real UI against an in-memory mock API (`src/ui/demo/demoApi.ts`).

Other in-flight changes touch the same specs and components. `add-cleanup-capabilities` modifies the "never writes"
requirement, and our delta builds on its six-entry version. `simplify-kanban-board` and `add-cleanup-capabilities`
modify overview rows and the board header. Here we only add requirements, but the overview and the header component
are shared code, so expect merge conflicts there.

## Goals / Non-Goals

**Goals:**
- One list of the open and recently closed pull requests across all tracked GitHub repositories, plus per-repository
  views, each with review and check status.
- Keep the network rule easy to state: GitHub is contacted only because the user opened or refreshed a pull-request
  list, and only through read-only `gh` subcommands.
- Degrade quietly when `gh` is missing, not signed in, or a repository isn't on GitHub.
- Tests use no network and no real `gh`.

**Non-Goals:**
- Any write to GitHub (merge, review, comment), notifications, background polling.
- GitHub Enterprise and other forges. The host check is one function, so it can be widened later.
- Linking pull requests to OpenSpec changes or agent sessions.

## Decisions

### 1. `gh` rather than the REST API or agent reports
`gh` is already signed in wherever agents open pull requests, it handles private repositories, and it keeps the token
out of the dashboard, the same way the pull action leaves credentials to git. The unauthenticated REST API only works
for public repositories and is rate-limited. Parsing agent output to learn about new pull requests is forbidden by the
sessions rules, is vendor-specific, and would miss pull requests opened outside the dashboard.

### 2. Two `gh pr list` calls per GitHub repository, one `gh api user` per refresh
```
gh pr list --repo <owner>/<name> --state open --limit 101 --json <fields>
gh pr list --repo <owner>/<name> --state all  --limit 51  --search "is:closed closed:>=<today-7d>" --json <fields>
gh api user --jq .login
```
The fields are `number,title,url,author,headRefName,baseRefName,isDraft,state,createdAt,mergedAt,closedAt,
reviewDecision,reviewRequests,statusCheckRollup`. Asking for one more than the limit shows whether the list was
truncated. We use a search instead of `--state closed` so merged and closed pull requests come from one call filtered
by date. That behaviour needs checking against the real `gh` during implementation; if `--state closed` turns out to
exclude merged ones, the search is the only option anyway.
- **Checks summary** comes from `statusCheckRollup`. Any `FAILURE`, `ERROR`, `CANCELLED`, `TIMED_OUT` or
  `ACTION_REQUIRED` conclusion (CheckRun) or `FAILURE`/`ERROR` state (StatusContext) means failing. Otherwise anything
  not completed or `PENDING`/`EXPECTED` means pending. Otherwise a non-empty list means passing, and an empty one means
  none.
- **Review requested from me**: the viewer login appears in `reviewRequests[].login`. Team requests don't count; see
  risks.
- `gh api user` is read-only, and one call per refresh gives the login for the "from me" marker. If it fails, the
  marker is left out and the lists are still shown.

### 3. Process hygiene, and cwd outside the repository
`gh` is spawned with no shell, `stdin: "ignore"`, `cwd` = the dashboard home, and env `GH_PROMPT_DISABLED=1`,
`GH_NO_UPDATE_NOTIFIER=1`, `GH_SPINNER_DISABLED=1`, `NO_COLOR=1`. The timeout is 30 s per call, then the process is
killed and the result is `failed: timed out`. Concurrency is capped at 3 GitHub repositories at a time. Because the
repository is passed with `--repo owner/name` and the cwd is not a repository, `gh` runs no git command in a tracked
repository, which keeps the "never writes" argument trivial. `GH_HOST` is left unset, since only `github.com` is
queried.

Mapping `gh`'s failures to states:

| Condition | State / reason |
|---|---|
| spawn fails with ENOENT | `unavailable`: GitHub CLI not installed |
| stderr matches `gh auth login` / "not logged in" / "authentication" | `unavailable`: not signed in, run `gh auth login` |
| origin missing / not `github.com` / non-git | `unavailable`: not on GitHub (no process started) |
| timeout, non-zero exit, unparsable JSON | `failed`: masked first meaningful stderr line |

"Not installed" and "not signed in" apply to every repository, so after the first one of those in a refresh the
remaining repositories get the same answer without starting another process.

### 4. Module and cache
`src/server/pullRequests.ts` owns everything on the server:
- `githubRepoOf(repo)` turns the `originUrl` of a git repository into `owner/name` when the host is `github.com`.
- `refresh(repos, { repoId?, force? })` groups enabled repositories by GitHub repository, skips fresh ones (5 min),
  queries the rest, and merges the results into the cache.
- Coordination: one in-flight refresh per GitHub repository, kept as a `Map<ghRepo, Promise>`. A request that arrives
  during a refresh awaits the same promises, so concurrent requests don't double-query.
- Cache: a `Map<ghRepo, { fetchedAt, pullRequests, truncated, error? }>` plus the viewer login, written atomically
  (temp file + rename, as `cache.ts` does) to `~/.openspec-dashboard/pull-requests.json` after each refresh and read
  at startup. It is keyed by GitHub repository, so two clones share one entry. The API response is projected per
  enabled tracked repository at request time, so repositories that were disabled disappear without cleanup.
- `unavailable` for "not on GitHub" is computed at request time from the scan snapshot's `isGit` and a cached origin
  lookup, and never stored.

The origin is looked up with the read-only `config --get remote.origin.url` that is already allowed. It is memoised per
repository path for the process lifetime and invalidated when the config is saved.

### 5. API
- `GET /api/pull-requests`: a pure projection of the cache, with no process and no network.
- `POST /api/pull-requests/refresh` with `{ repoId?, force? }`: behind `crossSiteRefusal` like every non-GET route.
  It contacts the network, so it gets the same-origin protection even though it writes nothing to a repository.
  Unknown or disabled `repoId` returns 404.
- Response shape (`src/shared/types.ts`):
  ```ts
  interface PullRequestsResponse { viewer?: string; repos: RepoPullRequests[] }
  interface RepoPullRequests {
    repoId: string; github?: string;              // "owner/name"
    status: "ok" | "unavailable" | "failed" | "never";
    reason?: string; fetchedAt?: string; truncated?: { open: boolean; closed: boolean };
    pullRequests: PullRequest[];                  // last good list, also when failed
  }
  interface PullRequest {
    number: number; title: string; url: string; author: string;
    head: string; base: string; draft: boolean; state: "open" | "merged" | "closed";
    createdAt: string; mergedAt?: string; closedAt?: string;
    review: "approved" | "changes_requested" | "review_required" | "none";
    reviewRequestedFromViewer: boolean;
    checks: "passing" | "failing" | "pending" | "none";
  }
  ```
  The response duplicates a shared GitHub repository's list per tracked repository. That's simple for the UI, and the
  lists are small.

### 6. UI
- **`/pull-requests` view** (`src/ui/pullRequests.tsx`): header band with the fetch age, Refresh and filters.
  Pure grouping, filtering and sorting live in `pullRequestsState.ts` for unit tests. On mount it `POST`s refresh
  without `force` (the server decides whether the cache is stale) and renders the `GET` result immediately. A
  pull request shared by two tracked clones is listed once, under the first repository in the filter's order, with the
  other names in its tooltip.
- **Status chips**: text + symbol + tooltip (`Draft`, `Approved ✓`, `Changes requested`, `Review required`, checks
  `✓`/`✕`/`…`). Nothing relies on colour alone, per the existing accessibility rule.
- **Links** to github.com are ordinary `<a target="_blank" rel="noopener noreferrer">`. The user navigates; the page
  itself makes no request (invariant 4 is about requests the dashboard makes).
- **Overview**: an `PRs` column/tile figure from the `GET` cache, fetched once on load and after a refresh. It is a
  link to `/pull-requests?repo=<id>`.
- **Board header**: a `PullRequestsButton` next to the branches control, reusing `Modal`. Opening the dialog calls
  refresh with `repoId`.
- **Nav**: after Activity, with a new git-pull-request icon in `icons.tsx`.

### 7. Demo
`demoApi.ts` implements both endpoints from `sampleData.ts`: synthetic `acme/*`-style repositories, ages relative to
`Date.now()`, a 600 ms simulated refresh, and a simulated viewer login like `demo-user`.

### 8. Tests
A fake `gh` (`test/fixtures/fake-gh.ts`, a bun script behind an executable shim in a temp dir put first on `PATH`)
answers from a JSON scenario file named by an env var. It can be told to fail auth, time out, or exit non-zero. It
records its argv and cwd so tests can assert that only `pr list`/`api user` ran, never in a repository directory.
Unit tests cover remote parsing, checks and review mapping, truncation, freshness, dedupe of shared remotes, concurrent
refresh coalescing, missing binary (empty `PATH`), and the "scan starts no gh" guarantee.

## Risks / Trade-offs

- **The network exception gets wider.** GitHub is now contacted outside the pull action. → It is limited to read-only
  subcommands, only on opening or refreshing a pull-request list, and the invariant text lists it. The overview and
  scans stay offline, and a test proves they start no `gh`.
- **Opening the view contacts GitHub without an explicit click.** The user chose this for convenience. → A 5-minute
  freshness window, cached data shown first, and never from the overview.
- **Team review requests aren't recognised as "from me"**: resolving team membership needs more API calls. → Accept
  for v1. The review decision still shows `review required`.
- **`gh` output format drift.** → Only documented `--json` fields are used and parsed defensively; unknown values map
  to `none`/`pending`.
- **Rate limits** with many repositories: 2 calls per GitHub repository per refresh, capped concurrency, and the
  5-minute window. That is far below GitHub's authenticated limits for typical use.
- **Merge conflicts** with `simplify-kanban-board` and `add-cleanup-capabilities` in `overview.tsx`, `checkout.tsx`
  and the "never writes" spec text. → Our delta builds on the cleanup version, and this change is archived after it.

## Migration Plan

No data migration. A missing cache file means "never fetched". Update `CLAUDE.md` invariants 1 and 4 and the
agent-sessions "never calls `gh`" sentence in the same pull request as the code.

## Open Questions

- Should GitHub Enterprise hosts that `gh` is signed in to be supported later, and via configuration or
  `gh auth status`? Out of scope for now.
