## Context

`scanRepo` (`src/server/scanner.ts`) builds a repository's change list from one place: `source.listChanges()` lists `openspec/changes/*` and `openspec/changes/archive/*` under the repository's configured path, i.e. the main checkout. It already calls `git worktree list --porcelain`, but uses the result only for the name-based `branchMatch` guess and a count in the repository header. `parseWorktrees` returns `{ path, branch }[]`, includes the main checkout (git lists it first) and drops detached and flagless details such as `prunable`.

Everything the per-change scan needs is reached through `RepoSource`, and `LocalRepoSource` is parameterised by a single path: change listing, file reads, `lastActivity` (`git log -1 -- <path>` with `cwd` = that path), `dirtyFiles()` (`git status … -- openspec`), and `changeSpecsSynced`, which compares delta specs with `<source.path>/openspec/specs`. A linked worktree is a directory with its own `openspec/` and a working git context, so *the same machinery pointed at the worktree path already does the right thing*.

The agent-sessions feature (now on main) validates a session request against the snapshot's changes, creates a worktree under `~/.openspec-dashboard/worktrees/<repo id>/` on branch `feat/<change>`, and copies the change directory from the **main checkout** if the worktree lacks it. If `feat/<change>` is already checked out in another worktree, `git worktree add` refuses and the session fails.

Observed in this repository while diagnosing: nine worktrees, four changes in progress that exist in no other checkout, and three finished changes that are archived on main but still look active in worktrees whose branches were cut earlier.

## Goals / Non-Goals

**Goals:**
- A change appears on the board as soon as it exists in any checkout of a tracked repository, with correct progress.
- Exactly one card per change, never a resurrected finished change.
- Card actions (copy command, session starters) work for a change wherever it lives.
- Read-only, bounded, failure-isolated, no new git subcommand, no dependency on where worktrees are kept on disk.

**Non-Goals:**
- Showing worktrees as such or their uncommitted/unpushed state (`overview-tiles-and-worktree-status`).
- Reading branches that are not checked out anywhere (no `git show`, no object-database reads).
- Showing per-copy detail pages or diffs between copies.
- Reading archives or main specs from worktrees for display; main stays the record of what is finished.
- Detecting that two agents work in the same worktree.

## Decisions

### D1: A checkout is a `RepoSource`; scan each one with the code that exists
`RepoSource` gains `forCheckout(path): RepoSource` (for `LocalRepoSource`: `new LocalRepoSource(path)`), so test doubles keep control of every checkout. `scanRepo` scans the main checkout as today, then for each eligible linked worktree builds a checkout context — its source, its own `dirtyFiles()`, its branch — and runs the existing `scanChange` over that checkout's **active** entries only. `scanChange` stops assuming the main checkout: the project root it passes to `readChangeArtifacts` and the spec root used by `changeSpecsSynced` come from the checkout context. A worktree's `openspec/config.yaml` supplies the fallback schema for its copies (it can legitimately differ on a branch).

Eligible = reported by `git worktree list`, not the main record, not `prunable`, not bare, and having an `openspec/changes` directory. `parseWorktrees` is extended to keep detached records and to expose `detached` and `prunable`; `Worktree.branch` becomes optional. Location on disk is irrelevant, which covers in-repo `.claude/worktrees/`, sibling directories and the session worktrees under the dashboard home alike. Discovery keeps skipping linked worktrees: they are checkouts of a project, not projects.

*Alternative considered:* reading other branches with `git show <branch>:openspec/…` — also finds work on branches that are not checked out, but needs a new git subcommand, cannot see uncommitted work (which is most of a change's life under the current workflow), and would need a second artifact-reading path that works on blobs instead of files.

### D2: Merge copies by name; the leading copy is the card
All active copies of a change name across checkouts become one `ChangeSnapshot`. The leading copy is chosen by a pure function `leadingCopy(copies)` comparing, in order: lifecycle stage rank (`new` < `artifact` < `ready` < `implementing` < `done` < `synced`), number of done artifacts, tasks done, latest `lastActivityAt`, and finally main checkout before worktrees then path, so the choice is total and stable between scans. "Furthest along" rather than "most recent" because a stale copy is often *touched* more recently (a rebase rewrites it) while being behind in content; progress is the better signal and recency only breaks ties.

The merged snapshot is the leading copy's snapshot plus `checkout: { path, branch?, isMain }` and `otherCheckouts: { path, branch?, column }[]`. Found while testing: every branch carries main's committed changes, so *every* worktree holds a copy of *every* change on main; listing them all would put nine identical lines in each tooltip. `otherCheckouts` therefore leaves out linked worktrees whose copy shows the same progress (column, done artifacts, task counts) as the main checkout's copy. `branchMatch` is set to the leading copy's branch when it lives in a linked worktree, which keeps the existing badge and every consumer of `branchMatch` working; the name-based guess remains only for changes whose leading copy is in the main checkout.

### D3: Archived on main wins — unless the copy is a newer change of the same name
An active copy in a worktree is dropped when the main checkout has an archived change of that name, *unless* the copy's `created` date (`.openspec.yaml`) is later than the archive date — OpenSpec allows a name to be reused after archiving, and that genuinely new change must not be hidden. A copy without a `created` date is treated as stale when an archive of its name exists. Archives inside worktrees are not read at all, so an archive branch that has not merged yet leaves the change where main says it is (`Done`/`Synced`), which is accurate.

Dropped stale copies are not warnings: they are the normal state of any worktree cut before an archive.

### D4: Everything on the card is evaluated in the leading copy's checkout
Artifact status, task progress, warnings, `lastActivityAt` (latest of the commit date for the change directory and the mtime of files git reports as modified or untracked there — evaluated with that checkout's git context, so an untracked change directory in a worktree gets a real, recent time), and `specsSynced` (delta vs that checkout's `openspec/specs`, which is what `openspec archive` run in that worktree would see). The `git log` lookup keeps its existing limits.

The repository's `lastUpdatedAt` becomes the latest of its current value (main checkout's `openspec/`) and the `lastActivityAt` of every merged change, so a repository whose only activity is in worktrees sorts to the top of Projects, where it belongs.

### D5: Bounds and failure isolation
Worktrees are scanned with concurrency 3 and at most 12 per repository, most recently modified `openspec/changes` first; any beyond the cap are skipped with one repository warning naming how many. Each worktree scan is wrapped: an exception, an unreadable directory or a timeout produces a repository warning (`worktree <branch or path>: <reason>`) and the scan continues with the other checkouts. Everything stays inside the existing per-repository timeout, and the scanner's failure path keeps retaining the previous change list. Change directory names from worktrees pass the same `CHANGE_NAME` validation; worktree paths come only from `git worktree list` of a tracked repository.

Cost is one `git status -- openspec` per worktree plus one `git log -1` per active copy; with the numbers observed (9 worktrees, ~5 active copies each) that is a few dozen short git calls per scan.

### D6: Actions follow the change
- **Copy apply command** uses `checkout.path` when present, else the repository path: `cd <checkout path> && claude "/opsx:apply <change>"`.
- **Session starters.** Two adjustments in the session manager, both about *where the change is*, not about what a session is:
  1. When the session's worktree lacks the change directory, it is copied from the leading copy's checkout (today: only from the main checkout).
  2. For Draft and Implement, if the branch the session would use (`feat/<change>`) is already checked out in a linked worktree of the repository, the session **adopts** that worktree: it runs there instead of failing on `git worktree add`. The record is marked `adopted`, the panel says so, and the dashboard never offers to remove an adopted worktree — it did not create it. Archive sessions are unchanged (always their own `chore/archive-<change>` worktree).
  The main checkout is still never used for a session: a change whose leading copy is in the main checkout gets a session worktree exactly as today.

*Alternative considered for (2):* refuse with an explanatory error. Rejected: under the current workflow practically every change is born on `feat/<change>` in someone's worktree, so the starters would be dead on the very cards this change makes visible.

### D7: UI
The card's branch badge already renders `branchMatch`; its tooltip now says `lives in worktree <path>` when `checkout` is a linked worktree, and lists `otherCheckouts` (`also in: <branch> (<column>)`). No new card chrome. The repository header's worktree tooltip tolerates entries without a branch (`detached`). The demo sample data gains a change that exists only in a worktree and one that is at `Proposal` on main and `Implementing` in a worktree, with the expected merged result asserted in the demo data test.

## Risks / Trade-offs

- [A stale copy that is *further along* than main's copy, e.g. after main was reverted] → It leads. Rare, visible (the badge names the branch), and fixed by deleting or rebasing the stale worktree. Preferring main unconditionally would defeat the purpose.
- [Scan time grows with worktrees × changes] → Active entries only, concurrency 3, cap 12, existing timeouts; measured on this repository (nine worktrees) before merge, as a task.
- [A name reused after archive without a `created` date is hidden] → Documented; `openspec new change` always writes `created`.
- [Adopting a worktree puts a dashboard agent into a directory another agent may be using] → Only when git would otherwise refuse the session, stated in the panel, and never followed by removal. The alternative is a dead button.
- [`overview-tiles-and-worktree-status` edits the same `parseWorktrees` and `Worktree` type] → Both make `branch` optional and add `detached`/`prunable` with the same meaning; whichever lands second keeps one definition.
- [Cached snapshots from an older version have no `checkout`] → All new fields are optional; the UI falls back to today's behaviour until the first scan.

## Migration Plan

Additive and read-only. After upgrade the first scan adds the worktree changes; nothing needs configuring. Rollback is reverting the commit; an older binary ignores the extra snapshot fields and an `adopted` flag on a session record.

## Open Questions

- Should the board offer a filter "lives in a worktree / on main"? Deferred until the merged board has been used.
