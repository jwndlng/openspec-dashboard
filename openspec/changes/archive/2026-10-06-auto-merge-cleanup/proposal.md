# Proposal

## Why

With **Docs auto-merge** on, Ship and Archive ask the agent to enable auto-merge on a docs-only pull request, and GitHub
merges it once its required checks pass. After that the session has nothing left to do, yet its agent keeps running
and its worktree stays on disk until the user ends the session and confirms the removal by hand, for every archive.
Once the pull request is merged, whatever the agent does next no longer matters, so the user's opt-in to auto-merge can
also stand for ending that session and removing its worktree.

## What Changes

- A session **remembers when the dashboard asked its agent to enable auto-merge**: the time a Ship or Archive prompt
  carrying the auto-merge instruction was produced for it (started, sent into the running session, or Ship). Only those
  sessions take part; a pull request the user merges by hand, or a session that was never asked, changes nothing.
- When a **pull-request query that already ran** shows the pull request whose head branch is that session's branch as
  **merged**, after the time the session was asked, the dashboard **ends that session and removes its worktree** without
  asking. The query can be the user's Refresh, opening a view that shows pull requests, or the board's pull-request
  watch, which already polls a pending auto-merge pull request every minute. The project must still have Docs auto-merge
  on at that moment.
- The removal uses the same non-forcing `git worktree remove` and the same read-only checks as the end-session dialog:
  clean, and merged or nothing that exists only on the branch. If a check refuses, the agent is still ended, the
  worktree stays, and the session's panel and card say why. An adopted worktree is never removed this way.
- The **local branch is kept**. Proving its work is in the default branch needs a fetch, which the dashboard makes only in
  the user's pull action, and GitHub saying "merged" is not proof under the repository-cleanup rules. The branch stays
  for repository cleanup after the user's next Pull, as today.
- The activity log records the automatic end, with the pull request's number and whether the worktree was removed.
- The **Docs auto-merge** tooltip says that a merged pull request also ends the session and removes its worktree.
- Invariant 1 (CLAUDE.md, and the `dashboard-api` "never writes" requirement) gains the automatic removal as a second
  trigger for an existing write: no new git subcommand, no new `gh` subcommand, no new query, no new timer, no fetch.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: a new requirement, "A merged auto-merge pull request ends its session", covering the record, the
  trigger, the end and the removal; "Worktree clean-up is offered only when safe" names that automatic removal as the one
  exception to "only after the user confirms".
- `dashboard-api`: "The dashboard never writes to tracked repositories" allows the session worktree removal of item (2)
  on that standing confirmation, triggered by a pull-request query result, never by the query's own process.
- `activity-feed`: "Agent session events are part of the activity" records a session ended because its pull request
  merged.
- `project-overview`: "Each managed project carries its own settings on the overview" — the Docs auto-merge tooltip
  mentions the automatic end and removal.

## Impact

- `src/shared/types.ts` — `autoMergeAskedAt` and an `autoEnded` outcome (pull request number, worktree removed or the
  reason it was kept) on the change session record.
- `src/server/sessions/manager.ts` — record the time in `open()`, `prompt()` and `ship()` when the instruction was
  included; a new `endMergedAutoMerge(repoId, pullRequests)` that ends and removes.
- `src/server/sessions/store.ts` — persist the two new fields.
- `src/server/api.ts` — after a pull-request refresh settles, hand each repository's fresh list to the manager.
- `src/server/activity/events.ts`, `src/server/activity/log.ts` — the `session-auto-ended` event kind.
- `src/ui/sessionPanel.tsx`, `src/ui/sessions.tsx`, `src/ui/sessionState.ts`, the card's session line, the activity
  feed's wording, `src/ui/projectSettings.tsx` (`AUTO_MERGE_HINT`), `src/ui/demo/demoSessions.ts`.
- `test/` — a new `test/autoMergeCleanup.test.ts` (temp git repositories, fake agent, fake `gh`), plus the activity and
  tooltip tests.
- `README.md` (Docs auto-merge paragraph), `CLAUDE.md` (invariant 1 and *Work status*), `src/ui/changelog.ts`.
- No new dependency, no network beyond the existing query, no new git subcommand.

## Non-goals

- Deleting the session's local branch or any remote branch, or fetching to prove the merge.
- Ending sessions whose pull request was merged without the dashboard having asked for auto-merge, or ending any session
  in a project with Docs auto-merge off.
- A separate setting for this: Docs auto-merge is the opt-in.
- New polling. If no view that queries pull requests is open, nothing happens until the next query.
