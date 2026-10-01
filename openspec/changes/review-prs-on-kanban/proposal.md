# Proposal

## Why

Cards are supposed to link to their change's pull request, but on a real board they almost never do. The link is made
only through the change's `branchMatch`, which exists only while a worktree (or the main checkout) is on a branch whose
name contains the change name. The dashboard's own flow removes exactly that: a session's worktree `feat/<name>` is
cleaned up once its pull request is merged, after which the change in the main checkout has no `branchMatch` and its
merged pull request disappears from the card. Archived changes are excluded outright, so an archive that is still
waiting for its `chore/archive-<name>` pull request to be reviewed — the one card the user most needs to review from —
never shows it either. On a dashboard with 50 cached pull requests, all on `feat/<name>` and `chore/archive-<name>`
branches the dashboard itself created, no card shows a single one.

## What Changes

- A change's pull request is looked up on a small, exact set of **candidate head branches** instead of `branchMatch`
  alone: `branchMatch` as today, plus the two branches the dashboard's own sessions create for that change —
  `feat/<name>` (implementation) and `chore/archive-<name>` (archive). These are compared exactly; no containment, no
  normalisation and no title matching is added, so `add-validate` still never links to `feat/add-validate-phase`, and a
  branch named off-convention (`jan/125-add-validate-phase`) is still not found.
- When several candidates have pull requests, the existing rule picks one: open (drafts included) first, then the most
  recently merged, closed or opened, then the higher number. For an archived change this naturally shows the archive
  pull request while it awaits review, and the latest settled one afterwards.
- A merged or closed pull request that settled **before the change was created** is ignored, so a new change that
  reuses an old change's name does not inherit the old change's pull request.
- **Archived changes show their pull request too**, on the card in `Archived` and in the detail header — reversing the
  current "nothing is shown for an archived change" rule.
- The session branch naming (`feat/<name>`, `chore/archive-<name>`) moves into `src/shared/` so the server that creates
  the branches and the UI that links them can never disagree.
- Unchanged: the link is still derived on display, never stored, never an input to columns, counts, filters or
  actions; no new `gh` call, no new refresh trigger, no new git command.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pull-requests`: "A pull request is linked to a change by its head branch" — the match is made against the change's
  candidate branches (its `branchMatch` and the dashboard's own session branches for the change) instead of
  `branchMatch` alone, and settled pull requests older than the change are ignored.
- `kanban-board`: "Cards link to their change's pull request" — archived changes show their linked pull request.

## Impact

- `src/shared/pullRequestLink.ts` — candidate branches, the created-date guard.
- `src/shared/sessionBranch.ts` (new) — the session branch names; `src/server/sessions/manager.ts` and
  `src/ui/demo/demoSessions.ts` import it instead of defining their own.
- `src/ui/kanban.tsx` — `boardCards` no longer skips archived changes.
- `src/ui/pullRequests.tsx` — `detailPullRequest` takes the fields the new rule needs.
- `test/pullRequestLink.test.ts`, and any kanban/board test asserting no link on archived cards.
- `openspec/specs/pull-requests/spec.md`, `openspec/specs/kanban-board/spec.md` via delta specs.
- No server API, scanner, snapshot, cache, git or `gh` change; invariants 1, 4 and 5 are untouched.
