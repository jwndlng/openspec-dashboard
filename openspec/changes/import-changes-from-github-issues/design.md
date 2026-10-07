# Design

## Context

The dashboard already talks to GitHub in one place: the pull-request query (`src/server/pullRequests.ts`), which runs
`gh pr list` / `gh api user` without a shell, in the dashboard home, with prompts disabled, a timeout and masked
errors, addressing the repository as `--repo owner/name` derived from `git config --get remote.origin.url`
(`originUrl` in `src/server/git.ts`, `githubRepoFromRemote`). Creating a change is `POST /api/repos/<id>/changes`
(`src/server/createChange.ts`): an exclusive `mkdir`, `.openspec.yaml`, optional `prompt.md` and `depends-on.yaml`,
then one best-effort `git add -- openspec/changes/<name>/`. The New change dialog's "By label" mode already sends that
request several times in sequence and shows per-target results. `depends-on.yaml` is read by the scanner as a
dashboard-owned, non-artifact file — the model for `issue.yaml`.

CLAUDE.md invariants 1 and 4 enumerate every write and every network access; both grow by one item here.

## Goals / Non-Goals

**Goals:**
- List a repository's open issues on the user's request and import the selected ones as Backlog changes.
- Keep a durable, repository-held link from a change to its issue, so the board can show it and the dialog can avoid
  importing an issue twice.
- Reuse the existing create path end to end, so every guarantee of change creation (exclusive create, staging,
  refusals, rescan) holds unchanged for imports.

**Non-Goals:**
- Writing anything to GitHub (comments, labels, closing the issue). Closing happens, if at all, through the agent's own
  pull request (`Closes #42`) — not by the dashboard. A later change may add that hint to the Ship prompt.
- Issues on other forges, closed issues, issue search syntax, pagination beyond 100.
- Keeping an imported change in sync with later edits of the issue.
- Import from the combined board or by label — repository board only for now.

## Decisions

### `gh issue list`, shared plumbing, its own module
`src/server/issues.ts` runs
`gh issue list --repo <owner/name> --state open --limit 101 --json number,title,body,url,author,labels,createdAt,updatedAt`
and reports `truncated` when 101 come back (keeping 100). `gh issue list` excludes pull requests on its own. `runGh`,
`failureOf`, `ghReason`, `maskCredentials`, the `NOT_INSTALLED` / `NOT_SIGNED_IN` failures and `githubRepoFromRemote`
move to (or are exported from) a small shared `src/server/gh.ts` that `pullRequests.ts` imports, so both queries are
provably run the same way. No behaviour change for pull requests. Alternative considered: a generic `runGh` that
accepts any subcommand from callers — rejected; each module hard-codes its argument list so the allowed subcommands
stay greppable.

In-flight requests are de-duplicated per repository id with a `Map<string, Promise<IssueList>>`; there is no cache and
nothing touches disk. The list is fetched each time the dialog opens — opening the dialog *is* the user's request.

### `POST /api/repos/<id>/issues`
A POST, not a GET: it starts a process that leaves the machine, and every GET in the API is a pure read of in-memory
state. Being a POST also puts it behind `crossSiteRefusal`, so another page in the browser cannot make the dashboard
spend the user's GitHub rate limit. Not-git / not-GitHub repositories answer `unavailable` before `gh` is looked up.

### `issue.yaml` written by the server from the repository's own origin
The client sends only `issue: { number, title }`. The server resolves `owner/name` with the same `originUrl` +
`githubRepoFromRemote` before the `mkdir`, refusing `409` when the repository is not on GitHub. The URL is never stored
and never accepted from the client: it is rebuilt as `https://github.com/<owner>/<name>/issues/<number>` wherever it is
shown, so a hand-edited `issue.yaml` cannot inject an arbitrary link. File shape:

```yaml
# The GitHub issue this change was imported from (written by Spec Control).
github: acme/alpha-infra
number: 42
title: Retry webhook delivery
```

It is written in the same exclusive-create step as the other files and staged by the same single `git add`, so the
invariant's list of git commands does not grow — only its list of files.

Alternative considered: putting the issue into `.openspec.yaml`. Rejected: that file is OpenSpec's own marker and its
schema is not ours to extend. Another: recognising imports by the issue URL in `prompt.md` — rejected as fragile (the
user edits prompts) and because it would make the scanner parse prose.

### Scanner
Next to `depends-on.yaml`: read `issue.yaml` with `readFileInfo` (regular file, ≤ 16 KiB), parse with the YAML parser
already used, validate `github` against the `owner/name` pattern `githubRepoFromRemote` produces and `number` as a
positive safe integer, cap `title` at 256 characters. Unlike `depends-on.yaml`, archived changes are read too, because
"already imported" must survive archiving. Result goes on `ChangeSnapshot.sourceIssue?: { github, number, title? }`;
merging copies of a change takes the leading copy's value, like `dependsOn`.

### Name proposal is shared code
`issueChangeName(title, number)` lives in `src/shared/` and is unit-tested against the spec's examples. The dialog
checks taken names against the latest snapshot's active and archived change names plus the other checked rows; the
server's `409` stays the authority (a race shows up as a per-row refusal).

### Prompt text
```
# Prompt

## <issue title>

Imported from acme/alpha-infra#42 — https://github.com/acme/alpha-infra/issues/42

<issue body as written>
```
The `# Prompt` heading is added by `createChange` as today; the dialog composes the rest. The body is passed through
unchanged (no truncation — GitHub caps bodies at 65 536 characters).

### UI
`src/ui/importIssues.tsx` reuses the modal shell and the per-target progress/result list of the New change by-label
flow (extract the result list if it is not reusable as is). Pure helpers (filtering, imported marking, name
validation, request sequencing) go into `src/ui/importIssuesState.ts` for tests without a DOM. The card shows a small
`#42` link next to the pull-request badge; the detail header shows it next to the change name. Links carry
`target="_blank" rel="noopener noreferrer"` and are never fetched.

### Demo
`demoApi.listIssues` returns invented issues for one sample repository (`alpha-infra`), marks one as already imported
by giving a sample change a `sourceIssue`, and imports through the demo's existing in-memory create.

## Risks / Trade-offs

- [Invariant text grows again] → Keep the CLAUDE.md edits to two insertions (the file in the create-change list, the
  subcommand and its trigger in invariants 1 and 4), mirrored by the dashboard-api delta.
- [Issue bodies are untrusted text that becomes an agent prompt] → It is the user's own repository and the user picks
  each issue and sees its link before importing; the prompt says where the text came from. The dashboard never renders
  the body as HTML (the dialog shows title only; `prompt.md` is shown through the existing markdown renderer, which
  already treats repository content as untrusted).
- [Rate limit / slow `gh`] → One query per dialog open or Refresh, de-duplicated, 30 s timeout.
- [Title collisions with existing changes] → Live check in the dialog, `409` per row from the server.

## Migration Plan

Additive. Old snapshots have no `sourceIssue`; changes without `issue.yaml` behave as before. Rollback: revert; any
`issue.yaml` left in repositories is ignored by older builds (non-artifact files are not counted).

## Open Questions

- Should Ship add `Closes <owner/name>#<n>` to its prompt for changes with a source issue? Deferred to a follow-up.
