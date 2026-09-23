# Proposal

## Why

The top bar's **Open work** menu lists every agent worktree whose git status is uncommitted, unpushed, pushed or
merged — including worktrees whose session ended days ago, whose session record was deleted, or whose change is long
archived. In practice it fills up with stale entries, so it no longer answers the question the user opens it for:
"which agent terminals are open right now?". The worktree state it used to summarise is already shown elsewhere — on
each card's work-status badge and on the overview tiles and repository-board checkout chips.

## What Changes

- **BREAKING (UI)**: the Open work control lists only **running** agent sessions (terminals that are currently open),
  across all repositories. Ended and failed sessions, worktrees without a session record, and worktrees of archived or
  vanished changes no longer appear there.
- The control's count is the number of running sessions; the control is hidden when no session is running.
- Each entry shows repository, change, session action, agent, branch, the session's live badge (the same one its card shows), the
  worktree's work-status badge when there is one, and how long ago the session started; activating it opens (shows)
  that session's panel, following the dock's existing "show this session" rule.
- Removed from the menu: the stale-first ordering, the "merged" entries and the orphan-worktree actions (**Copy cd**,
  **Remove…**). Worktree state stays visible on cards (work-status badges, incl. stale highlighting) and in the
  overview / repository-board checkout chips; the worktree-removal API is unchanged and still used by the end-session
  dialog.
- Texts that point users to "Open work" for leftover worktrees (the orphan work badge tooltip, the end-session dialog
  hint) are reworded.
- The demo keeps showing the control with a count at first sight: it already seeds a running session, so the
  `demo-site` requirements stay true as written.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: the "Open work list" requirement changes from "worktrees with unshipped or merged work" to "running
  agent sessions".

## Impact

- `src/ui/sessionState.ts` — `openWork()` replaced by a selector over running sessions.
- `src/ui/sessions.tsx` — `OpenWork` component rewritten; `OrphanActions` removed; orphan `WorkBadge` tooltip reworded.
- `src/ui/endSessionDialog.tsx` — hint no longer says the work "shows up under Open work".
- `src/ui/styles.css` — Open work row styles adjusted if needed.
- `src/ui/demo/demoSessions.ts` — comment only (orphans no longer surface in Open work).
- `test/workStatusUi.test.ts`, `test/demoSessions.test.ts` — updated for the new list.
- No server, API or git behaviour changes; the read-only invariants are untouched.

### Overlap with `integrate-console-detail-view`

That in-flight change also modifies the `kanban-board` "Open work list" requirement and touches `src/ui/sessions.tsx`
and `src/ui/sessionState.ts`. It widens the list to running sessions **plus** unshipped, merged and orphaned worktrees
(keeping Copy cd / Remove…); this change narrows it to running sessions only. The two deltas cannot both be archived
as written: whichever lands second must rebase its "Open work list" requirement onto the other's outcome — here,
by dropping the worktree entries from that change's version while keeping its detail-view navigation and repository
colours.
