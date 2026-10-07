# Tasks

## 1. Shared gh plumbing

- [x] 1.1 Move `runGh`, `failureOf`, `ghReason`, `maskCredentials`, the not-installed / not-signed-in failures and `githubRepoFromRemote` from `src/server/pullRequests.ts` into `src/server/gh.ts` and import them back; verify `bun test test/pullRequests*.test.ts` passes unchanged
- [x] 1.2 Teach `test/fixtures/fake-gh.ts` to answer `issue list --repo … --state open --limit … --json …` from the scenario JSON (and to record the invocation like `pr list`); verify with a small test that a scenario's issues come back and the recorded argv is exactly `issue list …`

## 2. Issue query and endpoint

- [x] 2.1 Add `GithubIssue` and the issue-list response type to `src/shared/types.ts`; verify `bun run check` typechecks
- [x] 2.2 Implement `src/server/issues.ts`: resolve `owner/name` from origin (not git / not GitHub → `unavailable` with no `gh` started), run `gh issue list` with the fixed argument list and `--limit 101`, parse defensively (number, title, body, url, author login, label names, dates), keep 100 and set `truncated`, map failures as the pull-request query does, de-duplicate concurrent queries per repository id, write nothing to disk; verify `test/issues.test.ts` covers ok, truncated, gh missing, not signed in, timeout, not on GitHub (no process started), concurrent requests share one process, and malformed JSON entries skipped
- [x] 2.3 Add `POST /api/repos/<id>/issues` to `src/server/api.ts` behind `crossSiteRefusal`, `404` for unknown/disabled ids without a process, no scan triggered; verify `test/issuesApi.test.ts` covers ok, `404`, foreign origin `403` with no `gh` started, and that `GET /api/state`, `GET /api/pull-requests` and a scan start no `gh issue list`

## 3. Creating a change from an issue

- [x] 3.1 Extend `src/server/createChange.ts` and the create route: validate `issue` (`number` positive safe integer, optional `title` string ≤ 256) → `400`; when present resolve `owner/name` from origin before any write → `409` "not on GitHub"; write `issue.yaml` (comment line, `github`, `number`, `title`) in the same step as the other files; verify `test/createChange.test.ts` covers the file content, `400`/`409` leaving the repository byte-for-byte unchanged, and that `git status` shows `.openspec.yaml`, `prompt.md`, `issue.yaml` staged after the single `git add`
- [x] 3.2 Add a no-side-effects test: importing through the route changes only `openspec/changes/<name>/` and the index entries of its three files, starts no `gh` process and leaves refs and `HEAD` unchanged

## 4. Scanner and snapshot

- [x] 4.1 Read `issue.yaml` in `src/server/scanner.ts` for active and archived changes (regular file, ≤ 16 KiB, valid YAML, `owner/name` pattern, positive integer number, title capped) into `ChangeSnapshot.sourceIssue`; take the leading copy's value when copies merge; never count it as an artifact; verify `test/scanner.test.ts` with new generated fixtures (valid, malformed YAML, negative number, oversized, symlink, archived) and that column/artifact status are unchanged by the file
- [x] 4.2 Add a shared `issueUrl(github, number)` helper and use it everywhere the link is shown; verify a unit test that the URL is always `https://github.com/<owner>/<name>/issues/<number>`

## 5. Name proposal

- [x] 5.1 Implement `issueChangeName(title, number)` in `src/shared/` (lower-case, non-`[a-z0-9]` runs → `-`, trim `-`, ≤ 48 chars cut at a `-` where possible, fallback `issue-<number>`); verify unit tests for the spec examples (`Retry webhook delivery on 5xx (again!)`, `???`), long titles and non-ASCII titles, and that every result passes `CHANGE_NAME`

## 6. UI

- [x] 6.1 Add `listIssues(repoId)` to `interface Api` in `src/ui/api.ts` and implement it in `src/ui/demo/demoApi.ts` with invented issues for one sample repository, plus a sample change with a `sourceIssue` in `src/ui/demo/sampleData.ts`; verify typecheck and the demo sample-data tests pass
- [x] 6.2 Write `src/ui/importIssuesState.ts`: text filter (number, title, labels, case-insensitive), imported marking from the snapshot's active and archived `sourceIssue`s, per-row name validation (pattern, taken by an active/archived change, duplicate among checked rows), prompt composition, and the sequential create runner with per-row results; verify `test/importIssuesState.test.ts` covers each spec scenario of selection, naming, marking and a refusal not stopping the others
- [~] 6.3 Build `src/ui/importIssues.tsx` on the existing modal: fetch on open, Refresh, fetched-at and truncated notice, unavailable/failed reasons (with `gh auth login` advice), checkbox list with editable names and inline errors, import action stating the count, busy state that blocks closing, per-row results, one board refresh at the end; verify in `bun run dev` against a GitHub repository and in the demo build, in light and dark theme and at phone width
- [~] 6.4 Add **Import from issues** to the repository board header in `src/ui/kanban.tsx` for eligible git repositories only; verify a test or manual check that a non-git tracked folder and an ineligible repository show no action
- [~] 6.5 Show the source issue as `#<number>` link (tooltip: `owner/name` and title, new tab, `rel="noopener noreferrer"`) on the card and in the detail header (`src/ui/changeDetail.tsx`); verify in the demo that the sample change shows the link and nothing is fetched by the browser
- [~] 6.6 Describe Import from issues and the source-issue link in `src/ui/helpContent.tsx`; verify the Help page renders it

## 7. Docs and final checks

- [x] 7.1 Update `CLAUDE.md` invariants 1 and 4: `issue.yaml` in the create-change file list, `gh issue list` as the third read-only `gh` subcommand, run only when the Import from issues dialog opens or is refreshed; verify the text matches the dashboard-api delta
- [x] 7.2 Run `bun run check` and verify it passes; run `bun run build` and verify `dist/spec-control` lists issues and imports one into a scratch GitHub-origin repository (with the fake `gh` on `PATH`)
- [x] 7.3 Run `openspec validate import-changes-from-github-issues --strict` and verify it reports the change as valid
