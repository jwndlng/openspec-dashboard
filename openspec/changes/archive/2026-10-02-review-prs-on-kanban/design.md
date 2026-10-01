# Design

## Context

`linkedPullRequest` (`src/shared/pullRequestLink.ts`) is the one rule the card (`boardCards` in `src/ui/kanban.tsx`) and
the detail header (`detailPullRequest` in `src/ui/pullRequests.tsx`) share. Today it compares each cached pull
request's `head` with `change.branchMatch` and nothing else, and `boardCards` skips archived changes before calling it.

`branchMatch` comes from the scanner: the branch of the linked worktree the leading copy was read in, or — for a copy
in the main checkout — the main checkout's branch or the first worktree branch containing the change name. Archived
changes never get one. So the link exists only while a worktree for the change is alive, and the dashboard's own
cleanup removes that worktree right after the merge (see proposal.md — Why).

The branches themselves are not a guess: sessions are created by `sessionBranch(action, change)` in
`src/server/sessions/manager.ts` — `chore/archive-<name>` for the archive action, `feat/<name>` for every other one.
The demo (`src/ui/demo/demoSessions.ts`) carries a private copy of the same function.

## Goals / Non-Goals

**Goals:**
- A change made through the dashboard's own sessions finds its pull request for its whole life on the board: while a
  worktree exists, after the worktree is removed, while its archive awaits review, and after the archive is merged.
- No new way to show a wrong pull request.

**Non-Goals:**
- Recovering pull requests from branches named off-convention (`jan/125-…`), from titles or from commit messages.
- Reading local or remote branches from git to find more candidates, or adding fields to the snapshot.
- Showing more than one pull request per card.

## Decisions

### D1. Candidate branches: `branchMatch` plus the dashboard's own session branches

```ts
// src/shared/pullRequestLink.ts
export function candidateBranches(change: Pick<ChangeSnapshot, "name" | "branchMatch">): string[]
// → unique, non-empty: [branchMatch?, sessionBranch("implement", name), sessionBranch("archive", name)]
```

`linkedPullRequest` keeps its signature shape (`change`, `lists`) but takes `name` and `created` in the `Pick` too, and
matches `pr.head` against the candidate set with `===`.

Why these two: they are the branches the dashboard itself creates for exactly this change, so matching them is an exact
identity check, not a reading of the name. The previous design (archived `link-prs-to-changes`, D1) rejected a fallback
to "head branch *contains* the change name" because two changes with overlapping names would attach to each other's
pull requests; that cannot happen here — `feat/add-validate` and `feat/add-validate-phase` are different strings.

*Alternative:* ask git for local branches that still exist (`git for-each-ref refs/heads`) and use those. Rejected: it
would put a field in the snapshot for a display concern, still needs a rule to pick the change's branch out of the
list (back to containment), and after `cleanup` deletes the merged branch it finds nothing — the exact case this change
is about.

*Alternative:* show both the implementation and the archive pull request on archived cards. Rejected: the card has room
for one link, and the open-first rule already shows the one that needs attention.

### D2. One shared `sessionBranch`

`sessionBranch` moves to `src/shared/sessionBranch.ts` (pure, no imports beyond the `SessionAction` type). The server
manager re-exports or imports it so `test/agents.test.ts` keeps working, and the demo drops its private copy. If the
naming ever changes, the link follows without a second edit.

### D3. Archived changes go through the same rule

`boardCards` drops `c.archived ? undefined :`. An archived change has no `branchMatch`, so its candidates are just the
two session branches. The **Hide merged** filter is decided by `archivePending` from worktrees and is not touched; the
link stays display-only.

### D4. Ignore pull requests that settled before the change existed

A name can be reused: change `rotate-keys` archived in September, a new `rotate-keys` created in October. Its
`feat/rotate-keys` would match the old merged pull request. A pull request whose `mergedAt`/`closedAt` is more than one
day before `change.created` is skipped. The day of slack exists because `created` is a date without a time zone and the
pull-request times are UTC instants; being one day too permissive is acceptable, rejecting the change's own pull request
is not. Open pull requests and changes without `created` are not filtered. The cache only keeps seven days of settled
pull requests, which bounds the remaining window further.

### D5. Ranking unchanged

`better` stays as it is: open first, then latest settled/opened instant, then higher number — applied across all
candidate branches. That yields the archive pull request for an archive under review and, once both are merged, the
later one (the archive).

## Risks / Trade-offs

- [A user branches `feat/<name>` by hand for unrelated work in the same repository] → It would be linked. Accepted: the
  branch is literally named after the change, and the detail header shows the pull request's head branch and title.
- [Time-zone edge around `created`] → One day of slack (D4); worst case a stale pull request shows on the creation day
  of a reused name.
- [Archived cards gain a link, slightly busier `Archived` column] → Merged links are already rendered quietly; the
  column is bounded (`ARCHIVED_LIMIT`) and Hide merged still applies.

## Migration Plan

Display-only; nothing is stored or migrated. Rolling back restores the previous behaviour with no leftover state.
