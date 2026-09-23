# Design

## Context

`OpenWork` in `src/ui/sessions.tsx` renders `openWork(worktrees, sessions)` from `src/ui/sessionState.ts`: every
session worktree whose work status is `uncommitted`, `unpushed`, `pushed` or `merged`, stale first, with `Open` for
entries that still have a session record and `OrphanActions` (Copy cd, Remove…) for those that do not. Worktrees come
from the server's per-directory work-status read, so they outlive both the agent process and the session record —
which is exactly why the list accumulates entries nobody is working on.

The UI already holds everything the new list needs: `ui.sessions` (polled, with `state` and `lastOutputAt`),
`ui.worktrees` (for the work badge), `sessionBadge()` (the live badge a card shows) and `ui.openPanel()` (which applies
the dock's "show this session" rule). The tab strip (`sessionTabs`) already lists running sessions plus shown ended
ones; Open work is the cross-repository, board-level entry point to the same running set.

## Goals / Non-Goals

**Goals:**
- Open work lists running sessions only, across all repositories, and its count is their number.
- Entries carry enough context to pick the right one (repo, change, action, agent, branch, live badge, work badge, age).
- Leftover-worktree information stays discoverable where it already lives: card work badges and checkout chips.

**Non-Goals:**
- No server, API or git change; `POST /api/worktrees/remove` and `api.removeWorktree` stay (the demo tests and the
  end-session dialog path through `closeSession` are unaffected).
- No new home for orphan-worktree removal. Accepted by the user: orphaned worktrees are removed by hand (`git worktree
  remove`) or through a session's end dialog while the record exists.
- No change to stale highlighting on cards (`staleAge`, `workBadge` keep their behaviour and tests).
- No renaming of the control; it stays "Open work".

## Decisions

1. **Selector over sessions, not worktrees.** Replace `openWork(worktrees, sessions, now)` with
   `openSessions(sessions)`: `sessions.filter(s => s.state === "running")` sorted by `createdAt` ascending (oldest
   first — the same order as the tab strip, so both surfaces agree). Returning the list alone; the count is its length.
   Alternative considered: keep the worktree list and drop stale/merged entries — rejected by the user in favour of a
   strict "open terminals" meaning.
2. **Work badge per entry via the session's worktree path.** Look up `ui.worktrees.find(w => w.path ===
   s.worktreePath)` and render the existing `WorkBadge` when found. Matching on path (not change name) is exact: a change
   can have both its own and an archive worktree. `WorkBadge` already renders nothing for `clean`/`missing`, and its
   stale state cannot trigger while the session runs.
3. **Live badge reuses `SessionBadgeView` + `sessionBadge()`** so wording and colour roles match the cards. Age is
   `relTime(s.createdAt)` ("started 5m ago").
4. **Hidden when nothing runs.** The control renders `null` when agent sessions are disabled or the list is empty; the
   ✓ state ("nothing unshipped") disappears with it, and the button no longer uses the `attention` style — a running
   session is not a warning. Use the neutral `ghost` look with the count.
5. **Remove `OrphanActions` and `openWork`.** Dead code after the change; `cdCommand` stays (used elsewhere). The orphan
   `WorkBadge` tooltip drops "see Open work"; the end-session dialog hint says the worktree's work stays visible on the
   change's card instead of "shows up under Open work".
6. **Tests.** Replace the `openWork` unit test with one for `openSessions` (filters ended/failed, oldest first). Rename
   the demo test that asserted orphans stay "in the Open work list" to describe what it actually checks (the orphan
   worktree is still reported by `api.sessions()`), and add an assertion that the demo's seeded state has at least one
   running session so the control is visible at first sight.

## Risks / Trade-offs

- **Orphaned worktrees lose their only UI removal path** → accepted by the user; cards and checkout chips still show
  the work, and the tooltip no longer promises something the menu does not offer.
- **Unshipped work becomes less prominent** (the count no longer nags about unpushed work) → stale highlighting on
  cards (danger/warning roles) and the overview's work-in-progress indicator remain the reminders.
- **Near-duplicate of the tab strip** → Open work stays useful as the board-level summary when the dock is collapsed and
  shows repository and work status, which the tabs do not.
