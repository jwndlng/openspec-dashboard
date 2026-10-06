# Proposal

## Why

A project made with **New project** is a git repository with no commit yet. Today every change session there is refused
with "this repository has no commit yet: … make one (for example in the project console) and start again". So the first
change of a new project cannot be drafted or implemented from its card, and the user has to detour through the project
console to make a commit they did not want yet. A tracked folder *without* git already works: its sessions run in place.
A repository that has nothing to branch from is in the same position and should behave the same way.

## What Changes

- The scan records whether a git repository has **nothing to branch from**: `HEAD` names no commit and there is no
  `origin/HEAD` (new `RepoSnapshot.noCommit`, read-only `rev-parse --verify` / `symbolic-ref`).
- A change session (Draft, Implement, Archive, …) in such a repository runs **in place** instead of being
  refused: the agent's working directory is the main checkout, no worktree and no branch are created, no git command is
  run for the session, and the session is recorded as `inPlace` without a branch — exactly the rules that already apply
  to a tracked folder without git. Whether it runs in place is decided from the scan, never by letting a git command fail.
- A session started in place stays in place for its whole life, also after the agent made the first commit. Sessions
  started once a commit exists get their worktree and branch as usual.
- **One agent per folder** extends from "a folder without git" to every in-place folder: while a change session runs in
  place in a repository with no commit, the project console is refused there with a reason naming that change, and the
  other way round; a second change session in place in that folder is refused likewise.
- The panel and card wording for an in-place session no longer claims the folder "is not a git repository" when it is
  one: for a repository with no commit it says the agent works in the checkout because there is no commit to branch
  from yet, and still that there is no branch and no undo.
- `ensureWorktree` keeps its `NoCommitError` as a safety net (scan out of date), but the session starter no longer
  reaches it in the normal case.
- The exception "a change session never runs in a git repository's main checkout" gets exactly one carve-out: a
  repository with no commit yet. The invariant text in `CLAUDE.md` is updated to say so.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: "Every session works in its own git worktree, created by the dashboard" — a repository with no commit
  yet runs change sessions in place instead of refusing them; the "Repository without a commit" scenario changes
  accordingly.
- `project-console`: "One project console per project, and one agent per folder" — the one-agent-per-folder rule covers
  an in-place change session in a git repository with no commit, not only a folder without git.
- `change-scanner`: the repository snapshot reports whether a git repository has no commit to branch from.
- `dashboard-api`: "The dashboard never writes to tracked repositories" — the agent MAY also be started in place in the
  main checkout of a git repository with no commit yet, with no worktree, branch, file or git command by the dashboard.

## Impact

- `src/server/git.ts`, `src/server/source.ts`, `src/server/scanner.ts` — the read-only "nothing to branch from" check
  and `RepoSnapshot.noCommit`.
- `src/shared/types.ts` — `RepoSnapshot.noCommit`. (The in-flight `add-validate-phase` change also edits this file, in
  other declarations.)
- `src/server/sessions/manager.ts` — `inPlace` decided from `!isGit || noCommit`; one agent per in-place folder for both
  starters.
- `src/server/sessions/worktree.ts` — comment and `NoCommitError` kept as a fallback only.
- `src/ui/sessionPanel.tsx`, `src/ui/endSessionDialog.tsx` and a new `src/ui/inPlaceText.ts` — in-place wording for a
  git repository with no commit.
  (`src/ui/sessionState.ts` is touched by `add-validate-phase`; this change avoids it.)
- `src/ui/helpContent.tsx` — the help page's in-place sentence.
- `test/` — scanner, session and in-place wording tests with a temp `git init` repository with no commit.
- `CLAUDE.md` — the "A change session never runs in a main checkout" sentence and the in-place bullet.
- No new git write, no new network access; invariant 1's list of writes is unchanged.
