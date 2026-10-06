# Design

## Context

- The auto-merge instruction is appended in `SessionManager.open()` (Archive start), `prompt()` (Archive sent into a
  running session) and `ship()` (Ship). Each already knows whether it appended it: the result's `autoMerge`. Nothing is
  kept on the session record.
- Pull-request lists come from `PullRequests.refresh()` (`src/server/pullRequests.ts`), called from the refresh route in
  `src/server/api.ts`. One refresh returns, per repository, the open list and the pull requests closed or merged in the
  last 7 days, each with `headRefName`, `state` and `mergedAt`. The board's watch (`watchPlan`) keeps refreshing while a
  card's pull request is not ready, and a pending auto-merge pull request is not ready. So the refresh that sees the
  merge is one that already runs, and the merged pull request is in its closed list.
- `SessionManager.close(id, { removeWorktree: true })` already ends the agent and runs `removeWorktree` with the
  existing checks. `checkWorktreeRemovable` passes for a clean, pushed worktree without any fetch (`@{u}..HEAD` is 0).

## Goals / Non-Goals

**Goals:** reuse `close()` and the refresh path unchanged. Add one record field, one result field and one hook.

**Non-Goals:** deleting branches, fetching, using GitHub's "merged" as proof of anything beyond the trigger, reacting
to merges nobody queried.

## Decisions

### D1 — Record the time, not a flag

`autoMergeAskedAt?: string` (ISO) on `ChangeSession`, set to "now" wherever the result says `autoMerge: true`. A time
lets the trigger ignore an older merged pull request of the same branch name (an archive branch re-created after an
earlier one merged), which a boolean cannot. Each later instruction overwrites it. *Alternative:* store the pull
request number. Rejected because the dashboard never learns the number from the agent, and must not read it from
the terminal.

### D2 — Trigger on the server, after a refresh settles

The refresh route, once `refresh()` resolves, calls `sessions.endMergedAutoMerge(repoId, list)` for each repository in
the response whose list is fresh (not served from an errored cache), and does not wait for it before answering. The UI
learns of the outcome through the session list it already polls. *Alternative:* trigger from the UI's watch. Rejected
because the watch only covers the board, and a Refresh in the Pull requests view should work the same. Putting the
hook on the server also keeps the `gh` process and the git process apart: the query stays a read-only `gh`, and the
removal runs afterwards as the session code's own step.

### D3 — Matching

A session matches when it is a change session of that `repoId`, not `inPlace`, not `adopted`, has `autoMergeAskedAt`,
has no `autoEnded` yet, and the list has a `state: "merged"` entry with `headRefName === session.branch` and
`mergedAt > autoMergeAskedAt`. The repository's config must have `agent.autoMergeDocs === true` at that moment.
Sessions are handled one at a time, under the same per-session lock `close()` uses, so the end-session dialog and the
hook cannot race.

### D4 — Ending and removal

`close(id, { removeWorktree: true })`. If the agent already exited, `close` skips the kill. If the worktree directory is
gone, `removeWorktree` reports "worktree no longer exists". That counts as removed for the message but writes nothing.
The outcome is stored as `autoEnded: { pr: number; at: string; removed: boolean; reason?: string }` and persisted by
the store. Once `autoEnded` is set, D3 never matches the session again, which makes the hook idempotent. An `autoEnded`
session stays in the list like any ended session, so the user can still remove its record.

### D5 — Activity

A new kind `session-auto-ended` with `{ pr, removed, reason? }`. The exit handler would also emit `session-ended` for
the killed process, so the hook marks the session before killing it and the exit handler skips its own event for a
session being auto-ended (spec: one event, not two).

### D6 — UI

The panel and the card's session line read `autoEnded`. They show "Ended because #88 merged; worktree removed" or
"Ended because #88 merged; worktree kept: <reason>". `AUTO_MERGE_HINT` gains one sentence. The demo never sets
`autoEnded`.

## Risks / Trade-offs

- [The agent pruned its remote-tracking branch (`git fetch --prune`) after GitHub deleted the head branch] → with no
  upstream, `checkWorktreeRemovable` may find commits that exist only locally and refuse. The worktree is kept and the
  reason shown. That is safe, and repository cleanup handles it after the next Pull.
- [The user is typing into the agent when the merge is seen] → the agent ends anyway. The user opted in, and the merged
  pull request means the session's work is done. The session record and its scrollback stay.
- [No pull-request view is open] → nothing happens until one is. That is accepted, because adding polling would widen
  invariant 4.
- [Two tracked clones of the same GitHub repository] → each repository's sessions are matched only against that
  repository's list, and both lists hold the same merged pull request. Each session is ended once.

## Migration Plan

New optional fields, so existing session records load unchanged. Rolling back drops the fields' effect, and an old
binary ignores them.
