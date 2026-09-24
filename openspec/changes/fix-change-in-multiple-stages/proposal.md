# Proposal

## Why

A change can show up on the board twice — once in `Synced` (or any other active column) and once in `Archived`. It
happens when the main checkout holds both `openspec/changes/<name>/` and `openspec/changes/archive/<date>-<name>/`.
The usual cause is the recommended workflow itself: the change directory is created uncommitted in the main checkout,
copied into a worktree, implemented and archived there, merged and pulled. Git moves only what it tracked, so the
untracked original stays behind in the main checkout. Its tasks are all ticked and the archive just applied its delta
specs, so it reads as `Synced`. The scanner merges copies across worktrees and folds a *pending* archive (one found only
in a worktree) together with the active copies of the same name. But it deliberately never folds the main checkout's own
active copy into the main checkout's archive, so one change gets two cards. The activity log, keyed by change name,
then sees two conflicting snapshots of one change.

## What Changes

- An active copy in the main checkout whose name matches an archive in the main checkout, and which was not created
  after that archive's date, is no longer reported as a change of its own. The change is reported once, as archived. The
  leftover active copy is listed among the archived change's other checkouts, with the column it would have on its own.
  The same folding applies to a tracked folder without git (both directories in the same folder).
- A copy created after the archive date is still a new change that reuses the name. It stays a separate, active change,
  as it already does for worktree copies and pending archives.
- The detail header of an archived change that has such a leftover shows a warning badge, next to where a pending
  archive's badge goes (cards no longer show where a change lives, since `refactor-design`). The badge says an active
  copy is still in the main checkout, with that copy's column. Its tooltip names the leftover directory and says that
  removing it clears the badge. The dashboard does not delete it: that would be a write the read-only invariant does not allow.
- Worktree copies of an archived change are still dropped silently, as before. Every branch cut before the archive
  carries them along, so they are not news.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `change-scanner`: "Copies of a change are merged into one change" — the main checkout's own active copy of a change
  archived in the main checkout (not created after the archive) is folded into that archive instead of being reported
  separately; this also holds for repositories without git.
- `change-detail`: new requirement "Detail header marks an active copy left behind next to its archive" — the detail
  header of a change archived in the main checkout gets a warning badge when a leftover active copy exists; the board
  shows the change as one `Archived` card. A requirement of its own, so "Detail header shows the change's state" stays
  as `refactor-design` wrote it.

## Impact

- `src/server/mergeChanges.ts` — the folding rule, plus attaching leftovers to the main checkout's archived snapshot.
- `src/server/scanner.ts` — pass the main checkout's archived snapshots through the merge, for git and non-git
  repositories alike.
- `src/ui/format.ts`, `src/ui/changeDetail.tsx` — the leftover badge and its tooltip, in the detail header.
- `test/mergeChanges.test.ts`, `test/worktreeScan.test.ts`, `test/format.test.ts` — the old assertion that a main-checkout
  copy "is never dropped" is reversed. New cases cover the leftover, name reuse, and the non-git folder.
- No API shape change: `otherCheckouts` already exists on every snapshot. No new writes and no new git subcommands.
