# Design

## Context

`scanRepo` (`src/server/scanner.ts`) reads the main checkout's active entries into `copies` and its archive entries into
`archived`. It builds `archivedOnMain` (name → newest archive date) and returns `[...mergeChanges(copies, …), ...archived]`
for a git repository, or `[...copies, ...archived]` for a folder without git. `mergeChanges` drops a *worktree* copy
of a name archived on main (`!copy.checkout.isMain && …`). But it keeps the main checkout's own copy on purpose: a test
asserts that such a copy "is never dropped". The non-git path does no merging at all. So a leftover
`openspec/changes/<name>/` next to `archive/<date>-<name>/` yields two snapshots with the same name.

Other code assumes one snapshot per name. The activity diff (`src/server/activity/events.ts`) builds a `Map` by name,
so two snapshots of one name compare against whichever one the map kept. The card and the detail link identify a change
by repository and name.

## Goals / Non-Goals

**Goals:**
- One snapshot per change name, apart from the name-reuse case the spec already allows (see specs).
- Keep the leftover visible on the archived change (in its detail header), so the user can find and remove it.
- The same rule for git and non-git repositories.

**Non-Goals:**
- Removing the leftover directory. Deleting files in a tracked repository is not among the writes allowed by invariant 1.
  Adding it to repository cleanup would first need a change to the `dashboard-api` "never writes" requirement.
- Preventing the leftover in the first place (for example, by moving the uncommitted directory into the worktree).
  The workflow that creates it belongs to the agent and the user, not to the dashboard.
- Duplicates of a name that are two genuinely different changes (reused after archiving). They stay separate.

## Decisions

### A separate pure step, `foldLeftovers`, before `mergeChanges`

Add a pure function to `src/server/mergeChanges.ts`:

```ts
foldLeftovers(mainCopies: ChangeCopy[], archived: ChangeSnapshot[]): { copies: ChangeCopy[]; archived: ChangeSnapshot[] }
```

It takes the main checkout's active copies and its archived snapshots (newest first, as `listChanges` returns them). A
copy is a leftover when an archive of the same name exists and `!((copy.change.created ?? "") > date)`. That is the
same comparison `mergeChanges` already uses for worktree copies. `created` and the archive date are both plain
`YYYY-MM-DD` strings, so the comparison is lexical and a same-day copy counts as a leftover. The function returns the
copies that are not leftovers, and the archived list with each leftover added to the `otherCheckouts` of the *first*
(newest) archive of its name as `{ ...copy.checkout, column: copy.change.column }`.

`scanRepo` calls this for git and non-git repositories alike, before worktree copies are appended. For a non-git
folder, the main checkout record is `{ path: repo.path, isMain: true }` with no branch.

*Alternative:* fold inside `mergeChanges` by passing it the archived snapshots. Rejected. `mergeChanges` runs only for
git repositories and also sets `checkout` and `branchMatch` on active snapshots, which a non-git snapshot must not
carry (`checkout` is documented as absent there). A small step that runs first keeps the non-git snapshot shape
unchanged, and leaves `mergeChanges` to decide between checkouts rather than between active and archived.

*Alternative:* drop the leftover silently, as worktree copies are dropped. Rejected. A worktree copy is expected (every
branch cut before the archive has one), but a main-checkout leftover is real clutter in the user's working tree.
Hiding it would leave `openspec list` and the dashboard disagreeing with no explanation.

### Only main-checkout copies are folded; worktree rule unchanged

A worktree copy of a name archived on main is already dropped by `mergeChanges`, and that still fits: it is carried
along by branches, and the user is not expected to act on it. The existing `mergeChanges` test for a main copy flips
from "kept" to "folded". The "main is never dropped" comment is removed.

### Badge from the snapshot alone, in `src/ui/format.ts`, shown in the detail header

Add `leftoverHint(change)` next to `pendingArchiveHint`. It returns `{ label, title }` when the change is archived, its
checkout is the main checkout or absent (non-git), and `otherCheckouts` holds an entry with `isMain`. The label is
`active copy left · <column>`. The title names `openspec/changes/<name>/` and says it usually holds files that were
never committed and stayed behind when the archive arrived, and that removing that directory clears the badge.
`ChangeFacts` in `changeDetail.tsx` renders it as a `badge warning` next to the pending-archive badge; the two are
mutually exclusive by construction. No API or type change: `otherCheckouts` already exists on `ChangeSnapshot`.

*Alternative:* a badge on the board card. Rejected. `refactor-design` moved the pending-archive badge and every other
"where does this change live" detail off the card into the detail header; a leftover is the same kind of detail. The
card already tells the important part by being a single `Archived` card. The requirement is added to `change-detail`
instead of modifying "Detail header shows the change's state", so it applies whichever of the two changes is archived
first.

## Risks / Trade-offs

- [A user deliberately recreates a change with the same name on the day it was archived] → It is folded as a leftover,
  and its detail header still shows it through the badge, with its column. This is the same-day rule worktree copies already
  follow. Setting a later `created` date separates them.
- [After the upgrade, the first scan sees one snapshot where there were two] → The activity diff sees the name before
  and after, so no `change-removed` is emitted; at most a single `change-moved` or none, depending on which duplicate the
  old map held. Deleting the activity log is never needed.
- [Snapshots cached by an older version still hold the duplicate] → They are replaced by the next scan. No migration.

## Migration Plan

None. The change is a pure scanner and UI fix. Rolling back restores the duplicate cards.
