# Proposal

## Why

Bugs and feature requests reach a project as GitHub issues, but the board only knows changes someone typed into the
**New change** form. Turning an issue into a change today means copying its title and body by hand, and nothing
afterwards says which change answers which issue. Letting the user pick open issues and import them as changes closes
that loop: what users report flows straight into the Backlog, and each change keeps a link back to where it came from.

## What Changes

- A repository board's header offers **Import from issues**: a dialog that
  lists the repository's open GitHub issues, read through the user's own `gh` with the read-only `gh issue list` — the
  one new `gh` subcommand, run exactly like the pull-request query (no shell, no prompts, working directory in the
  dashboard home, repository addressed as `--repo owner/name`, timeout, credentials masked).
- The issue list is fetched only when the user opens that dialog or activates its **Refresh**: never on a timer, during a
  scan, on page load or from any other view. It is kept in memory only and is never an input to scanning, columns,
  counts or actions.
- The user selects one or more issues. Each selected issue gets a proposed change name derived from its title (editable,
  validated live like the New change form), and its title, body and link become the change's `prompt.md`.
- Importing sends the existing `POST /api/repos/<id>/changes` once per selected issue, one at a time, with a new
  optional `issue: { number, title }` field. The server, not the browser, derives the GitHub repository from the
  repository's `origin` and writes a fourth file, `issue.yaml`, into the new change directory; it is staged by the same
  single `git add -- openspec/changes/<name>/`. Results are shown per issue, as for creating by label.
- The scanner reads `issue.yaml` (active and archived changes) into the change snapshot as the change's **source issue**.
  The dialog marks an issue that a change of the repository already came from, naming that change, and does not offer
  it for import again. The change's card and detail header show the source issue as a link to GitHub.
- Nothing is ever written to GitHub: no comment, label, assignment or state change on the issue.
- The demo serves a few invented sample issues; Help describes the import.

## Capabilities

### New Capabilities
- `issue-import`: reading a repository's open GitHub issues on the user's request, the Import from issues dialog,
  derived change names, the `issue.yaml` source-issue file and how a change's source issue is read and shown.

### Modified Capabilities
- `change-creation`: the create request may carry the issue a change is imported from; the change directory then also
  holds `issue.yaml`, written and staged with the other files.
- `dashboard-api`: the create-change endpoint accepts `issue`; a new `POST /api/repos/<id>/issues` endpoint runs the
  issue query; the "never writes" requirement lists `issue.yaml` among the create-change files and `gh issue list` among
  the `gh` subcommands the dashboard may run.
- `pull-requests`: the requirement that no `gh` subcommand other than `gh pr list` and `gh api user` runs now also
  admits `gh issue list` of the `issue-import` capability.

## Impact

- Server: new `src/server/gh.ts` holding `runGh`, `githubRepoFromRemote`, `ghReason` and masking, moved out of
  `src/server/pullRequests.ts` (no behaviour change for pull requests), new `src/server/issues.ts`, `src/server/createChange.ts` (write `issue.yaml`),
  `src/server/scanner.ts` (read `issue.yaml`), `src/server/api.ts` (issues route, `issue` in the create body).
- Shared: `src/shared/types.ts` (`GithubIssue`, `ChangeSnapshot.sourceIssue`), a name-from-title helper in `src/shared/`.
- UI: new `src/ui/importIssues.tsx` (+ state helper), `src/ui/kanban.tsx` (header action), card and
  `src/ui/changeDetail.tsx` (source-issue link), `src/ui/api.ts`, `src/ui/demo/demoApi.ts`,
  `src/ui/demo/sampleData.ts`, `src/ui/helpContent.tsx`, `src/ui/styles.css`.
- Tests: `test/fixtures/fake-gh.ts` learns `issue list`; new tests for the issue query, the import route and dialog
  helpers, scanner reading of `issue.yaml`, and a no-side-effects test (a scan and `GET` routes start no `gh`; an import
  touches only the new change directory).
- Docs: `CLAUDE.md` invariants 1 and 4 (new file in the create-change list, new `gh` subcommand and when it runs).
- No new dependency. Network only through `gh`, only on the user's action.
