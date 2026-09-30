# Tasks

## 1. Types and test harness

- [ ] 1.1 Add `PullRequest`, `RepoPullRequests` and `PullRequestsResponse` to `src/shared/types.ts` and a `pullRequestsCachePath()` to `src/server/paths.ts`; verify with `bun run typecheck`
- [ ] 1.2 Add `test/fixtures/fake-gh.ts` plus an executable `gh` shim written to a temp dir at test time: answers `pr list` / `api user` from a JSON scenario named by an env var, can simulate "not logged in", a hang and a non-zero exit, and records argv and cwd; verify with a smoke test that runs it through `Bun.spawn`

## 2. Server: querying GitHub

- [ ] 2.1 In `src/server/pullRequests.ts`, implement `githubRepoOf` (origin → `owner/name` for `github.com` only, via `originUrl`/`normalizeRemote`, memoised per path); verify with unit tests for HTTPS, SSH, `ssh://`, other host, no origin and a non-git repository
- [ ] 2.2 Implement the `gh` runner: no shell, `stdin: "ignore"`, cwd = dashboard home, `GH_PROMPT_DISABLED`/`GH_NO_UPDATE_NOTIFIER`/`NO_COLOR`, 30 s kill timer, masked stderr; map ENOENT, auth errors, timeout and non-zero exit to `unavailable`/`failed` reasons; verify with fake-gh tests for each case, and with an empty `PATH` for "not installed"
- [ ] 2.3 Implement the two `gh pr list` queries (open, and closed within 7 days via search) with limit+1 truncation detection, and parse into `PullRequest` (state, draft, review decision, `reviewRequestedFromViewer`, checks summary from `statusCheckRollup`); verify with unit tests over recorded-shape JSON, including failing/pending/passing/none checks and a merged-30-days-ago PR being absent
- [ ] 2.4 Implement `refresh({ repoId?, force? })`: group enabled repositories by GitHub repository, skip lists fresher than 5 minutes unless forced, cap concurrency at 3, coalesce concurrent refreshes per GitHub repository, reuse a global "not installed / not signed in" answer, keep the last good list on failure, fetch `gh api user` once; verify with tests: shared remote queried once, second concurrent refresh starts no extra `gh`, fresh cache starts none, failure keeps the old list
- [ ] 2.5 Persist the cache atomically to `~/.openspec-dashboard/pull-requests.json` and load it at startup; project it per enabled repository (`never` when absent, `unavailable` for non-GitHub); verify with a test that restarts the module over a written cache and one with the file deleted

## 3. Server: API

- [ ] 3.1 Add `GET /api/pull-requests` and `POST /api/pull-requests/refresh` to `src/server/api.ts` (refresh behind `crossSiteRefusal`, 404 for unknown/disabled `repoId`, no scan triggered); verify with route tests incl. foreign-origin `403` with no `gh` started
- [ ] 3.2 Add the invariant test: a full scan, discovery, `GET /api/state` and `GET /api/pull-requests` start no `gh` process, and a full refresh leaves every fixture repository's files and git directory byte-for-byte unchanged, with every recorded `gh` call being `pr list`/`api user` outside the repositories; verify it passes

## 4. UI

- [ ] 4.1 Add `src/ui/pullRequestsState.ts` (filter, group open vs recently closed, sort, de-duplicate shared remotes, URL query parse/serialise with defaults omitted); verify with unit tests
- [ ] 4.2 Add `/pull-requests` to `src/ui/routes.ts`, the API calls to `src/ui/api.ts`, a pull-request icon to `src/ui/icons.tsx`, and the **Pull requests** nav entry after Activity in `src/ui/app.tsx`; verify with the routes unit test and by opening the nav in `bun run dev`
- [ ] 4.3 Build `src/ui/pullRequests.tsx`: cached list first, refresh-if-stale on mount, Refresh control with running state, fetch age, entries with repo colour, number, title link (new tab, `noopener noreferrer`), author, branch, age, state/review/checks chips with text and tooltips, "review requested from you" marker, collapsed notice for unavailable/failed repositories, single "gh missing / run gh auth login" explanation, empty state, filters; verify in `bun run dev` in light and dark theme against a real signed-in `gh`
- [ ] 4.4 Add the open-PR count to the overview table column and tiles in `src/ui/overview.tsx` (cached only, placeholder with reason, link to `/pull-requests?repo=<id>` without opening the board); verify that loading the overview starts no `gh` process (server log / fake gh) and that the link filters the view
- [ ] 4.5 Add the `<n> open PRs` control and dialog to the repository board header (reusing `Modal`; refresh-if-stale on open, Refresh, link to the filtered view; absent for non-git repositories); verify in `bun run dev`
- [ ] 4.6 Add styles to `src/ui/styles.css` for the view, chips, count and dialog, matching existing chips and bands; verify at phone width and in both themes on the product build (not only the demo)

## 5. Demo

- [ ] 5.1 Add synthetic pull requests to `src/ui/demo/sampleData.ts` (draft, approved+passing, failing checks, review requested from `demo-user`, merged within 7 days, one repository not on GitHub; ages relative to now, made-up `acme/*` names only) and implement both endpoints in `src/ui/demo/demoApi.ts` with a short simulated refresh; verify by building the demo and checking that no network request leaves the page

## 6. Docs and final checks

- [ ] 6.1 Update `CLAUDE.md` invariants 1 and 4 and the agent-sessions "never calls `gh`" sentence to name the read-only `gh` query as the second network exception, and add a Pull requests section to `README.md`; verify by reading them against the `dashboard-api` delta
- [ ] 6.2 Run `bun run check` and `bun run build`, then run `dist/openspec-dashboard` and confirm the Pull requests view works in the compiled binary; verify both commands pass and the view loads real data
- [ ] 6.3 Run `openspec validate list-recently-opened-prs --strict`; verify it reports the change as valid
