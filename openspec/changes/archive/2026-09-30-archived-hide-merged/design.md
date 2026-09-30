# Design

## Context

See `proposal.md` for the motivation. The snapshot already records where each change comes from:
`ChangeSnapshot.checkout` is the leading copy's checkout, and `mergeChanges` (`src/server/mergeChanges.ts`) reports an
archive found only in linked worktrees ("pending" there) as archived with `checkout.isMain === false`, while an archive
the main checkout holds leads from the main checkout. With agent sessions enabled the UI also holds the session
worktrees (`SessionWorktree[]` in the sessions context) with a `work.state` computed from local git as of the last
fetch. Board filters live in `src/ui/filters.ts` and in the URL. The `Archived` column is bounded to 25 in
`src/ui/kanban.tsx`.

## Goals / Non-Goals

**Goals:**
- A pure predicate, `archivePending(card, worktrees)`, that is testable without a DOM.
- Default the board to the attention view without breaking existing URLs.

**Non-Goals:**
- No new server field, git command or fetch. "Merged" means what the rest of the dashboard means by it: as of the
  user's last fetch or pull.
- No per-card merged/pending badge; cards keep showing only what an overview needs, and the detail view already shows
  the checkout and work status.
- No change to the band counts (`Open`, `To archive`): they do not count archived changes.

## Decisions

1. **Where the archive was found is the main signal.** An archive led by a linked worktree hasn't reached the main
   checkout, so it is pending. Once it has been merged and pulled, the main checkout holds it and `mergeChanges` drops
   the worktree copies, so the change is merged. This works with agent sessions disabled and for worktrees the
   dashboard did not create. *Alternative:* a new server-computed `merged` flag that compares the archive commit with
   the default branch. Rejected because it needs git work per archive during a scan, and the checkout signal already
   gives the same answer as of the last pull.
2. **Session worktrees refine it both ways.** If a session worktree of the change (`worktreeForChange` semantics: same
   `repoId` and `change`) reports `merged` and the archive is only in that worktree, the work is merged and only a pull
   is missing. That counts as merged, so the switch hides it and the name matches. If a session worktree reports
   `uncommitted`, `unpushed` or `pushed` (`SHIPPABLE_WORK`), the change is pending even when the main checkout already
   holds the archive — for example, the archive was committed on main but a follow-up is still unpushed. `missing` and
   `clean` add nothing.
3. **Filter shape: `hideMerged: boolean`, default `true`, URL `merged=1` when off.** A parameter that appears only
   off the default keeps existing bookmarks clean and matches how `archived=0` works. `EMPTY_FILTERS.hideMerged` is
   `true`, so **Clear filters**, which already resets to `EMPTY_FILTERS`, restores it. `hasActiveFilters` treats
   `!hideMerged` as active.
4. **Filter before bounding.** In `kanban.tsx` the `Archived` column filters `inColumn` with the predicate and then
   calls `recentArchived(…, ARCHIVED_LIMIT)`, so the header count and `25 of <total>` count only pending archives. The
   `showing` computation applies the same filter to `archivedVisible`. The predicate is not added to the general
   `visible` filter, because that one also drives `stats.open`, and archived cards are not open anyway. Keeping it on
   the column keeps the change local.
5. **Switch placement and state.** A second `role="switch"` button right after **Hide archived**, with the same
   markup, and `disabled` while `hideArchived` is on. Its `title` says what "merged" means here. No tag: it is on by
   default, and a tag for a default would be noise.
6. **Demo.** Two sample archives in `sampleData.ts` get a linked-worktree checkout (`isMain: false`, a branch
   `chore/archive-<name>`) and are left out of the main checkout's archive, so the default demo board shows them as
   pending. The existing session worktrees are untouched.

## Risks / Trade-offs

- [Archive committed only on a main checkout that is off the default branch, or archived in the main checkout but not
  pushed] → it counts as merged, because the main checkout holds it. The repository header already warns about an
  off-default checkout and about unpushed commits (checkout summary), so the signal isn't lost. A session worktree
  with unpushed work still marks it pending.
- [The user never pulls] → archives merged remotely stay pending until the pull action (or their own `git pull`)
  brings them to the main checkout. That's the intended cue: the board also offers **Pull**.
- [Existing links to the board now hide merged archives] → the switch is visible in the filter bar with a tooltip,
  and one click brings them back. Users asked for this default.
