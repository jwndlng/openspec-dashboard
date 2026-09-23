# Design

## Context

See proposal.md for why. What exists today:

- `src/server/sessions/worktree.ts` has `checkWorktreeRemovable` (clean + merged-or-nothing-unique) and
  `removeWorktree` (unlock, non-forcing `git worktree remove`). They are only reachable through
  `POST /api/worktrees/remove`, only for directories under `~/.openspec-dashboard/worktrees/<repoId>/`, and only with
  agent sessions enabled.
- `src/server/sessions/workStatus.ts` derives `merged` for a worktree, including squash merges via
  `contentIsInBase(worktreePath, base)`, which compares `base...HEAD` — tied to a worktree's `HEAD`.
- The scanner already lists every checkout with `git worktree list --porcelain` (`parseWorktrees` in `git.ts`),
  including `prunable` and `locked` records.
- The "never writes" requirement forbids deleting any ref. Every git write lives in one named module
  (`pull.ts`, `createChange.ts`, `sharedConfig.ts`, `sessions/worktree.ts`); CLAUDE.md invariant 1 lists them.

## Goals / Non-Goals

**Goals:**
- One read-only function computes the preview; one function applies a selection and is the only place that runs
  `git branch -D`.
- The apply step is safe on its own: it recomputes the verdict for each requested item and never trusts the client.
- Cleanup works with agent sessions disabled and for worktrees the dashboard did not create.

**Non-Goals:**
- Deleting remote branches, `git fetch --prune`, or any network access. The user pulls first if they want a fresher
  base; the dialog says so.
- Age-based staleness ("untouched for 30 days"). Only provable safety decides; age is shown for information.
- Cleanup from the overview or across all repositories at once. One repository per dialog; can be added later.
- Recording cleanups in the activity log.
- Changing the session views' existing per-worktree remove.

## Decisions

### D1. A new module `src/server/cleanup.ts`, reusing the worktree checks

`previewCleanup(repo, runningPaths)` and `applyCleanup(repo, selection, runningPaths)` live in a new module that
imports `checkWorktreeRemovable` and `readWorkStatus` from `sessions/`. Those two are already session-agnostic (they
take paths); only the file location is historical. `removeWorktree` gets an `unlock` flag so that only
dashboard-created worktrees are unlocked.

*Alternative:* put everything into `sessions/worktree.ts`. Rejected: cleanup must work with sessions disabled and the
module header would stop being true; a separate module keeps "the only place that deletes a branch" greppable, like
`pull.ts` is for the network.

### D2. Candidates come from `git worktree list`, not from directory listing

The session views list directories under `~/.openspec-dashboard/worktrees/`, because those outlive records. Cleanup
lists what git knows about the repository, which covers user-created worktrees and prunable records in one call.
A worktree counts as *dashboard-created* when its real path is below the real path of `worktreesDir()/<repoId>/`
(`realpath` on both: macOS resolves `/var` → `/private/var`, and git reports resolved paths). A dashboard directory
that git no longer knows as a worktree is out of scope here (the session views already show it as `missing`).

### D3. Branch merge verdict: ancestry first, then content

For each local branch (`for-each-ref refs/heads` with `%(refname:short) %(objectname) %(committerdate:iso-strict)
%(upstream:short)`):
1. `rev-list --count <base>..<branch>` = 0 → removable ("in <base>").
2. Otherwise the squash check: `diff --name-only -z <base>...<branch>`, then `diff --quiet <base> <branch> -- <files>`.
   `contentIsInBase` in `workStatus.ts` is generalised to take the ref (`HEAD` for the existing caller) and a `cwd`,
   keeping the 500-file cap (over the cap → kept, "too many changed files to compare").
3. Otherwise kept with "N commits not in <base>".

Only read-only subcommands already on the allow-list are used (`for-each-ref`, `rev-list`, `diff`, `worktree list`,
`status`, `symbolic-ref`, `show-ref`, `rev-parse`).

*Alternative:* `git branch -d` and let git decide. Rejected: it refuses squash-merged branches (the common case with
GitHub squash merges) and judges against the main checkout's `HEAD` or the branch's upstream, not the default branch.

### D4. Delete with `git branch -D` after a compare step, report the commit

At apply time, for each requested branch: validate the name, `show-ref --verify refs/heads/<name>` must return exactly
the commit from the request, recompute D3 against the current base, and check it is not checked out in any worktree
(re-read `worktree list` after the worktree phase). Then `git branch -D -- <name>`, which also removes the branch's
`branch.<name>.*` config. The result carries the commit so the UI can show `git branch <name> <commit>`; the objects
stay until git's own garbage collection, so the restore works for the usual weeks.

*Alternative:* `git update-ref -d refs/heads/<name> <commit>` — atomic compare-and-delete. Rejected because it leaves
the branch's config section behind, needing a second write command (`config --remove-section`). The window between
the compare and the delete is milliseconds on a branch that is not checked out anywhere, so only another tool updating
that ref in that instant could slip through — and even then the new commit is still restorable from git's reflog of
the tool that wrote it. Accepted.

Branch names are validated before reaching git: `^[A-Za-z0-9][A-Za-z0-9._/-]*$`, no `..`, no `//`, no trailing `/`,
`.` or `.lock`, and the name must be in the repository's own `refs/heads` list. Everything is passed after `--`.

### D5. Worktree paths are matched, never used as given

The request's worktree paths are looked up in the repository's current `git worktree list`; only the listed path is
passed to git, and a path not in the list is reported as "not a worktree of this repository". Removal order per item:
running-session check → `checkWorktreeRemovable(path, merged)` (with `merged` from a fresh `readWorkStatus`) → locked
check (kept unless dashboard-created) → `worktree unlock` (dashboard-created only) → `worktree remove` (never
`--force`). `prune` runs once, only if requested and only if a prunable record still exists.

### D6. Running sessions and a per-repository lock

`SessionManager` gets `runningWorktreePaths(): Set<string>` (real paths). With sessions disabled the set is empty.
Cleanup keeps a `Set<repoId>` of running cleanups: a second `POST` gets `409`, and `SessionManager` refuses to start or
resume a session in that repository with `409` while its cleanup runs — so a session cannot start in a worktree
between its check and its removal. Starting sessions is fast and cleanups are short, so the refusal is rare.

### D7. API shape

`GET /api/repos/<id>/cleanup` → `CleanupPreview { repoId, base?, worktrees: CleanupWorktree[], prunable: {path}[],
branches: CleanupBranch[] }`; each item has `removable: boolean` and `reason?: string`; `CleanupBranch` has `name`,
`commit`, `lastCommitAt`, `upstream?`, `mergedBy?: "ancestry" | "content"` and `worktreePath?`.
`POST` → `CleanupResult { items: { kind: "worktree" | "prune" | "branch", id: string, outcome: "removed" | "pruned" |
"deleted" | "kept", reason?: string, commit?: string }[] }`. Eligibility (configured, enabled, git, last scan ok) is
checked before any git runs, reusing the pull endpoints' eligibility helper. After apply, `scanner.trigger()`.

### D8. UI: one dialog component, opened from the board header

`src/ui/cleanup.tsx` renders the dialog with the existing dialog styles (as `endSessionDialog.tsx`/`newChangeForm.tsx`
do). It fetches the preview on open, keeps a selection set with the worktree↔branch dependency (D3's `worktreePath`),
and after apply shows the result list with a copy button per restore command, then calls the board's reload. Kept
items are rendered in a collapsed "Kept (N)" group per section so a repository with many unmerged branches stays
readable. The header button reads `Clean up`, next to Pull.

### D9. Demo

`demoApi.ts` implements `cleanupPreview`/`cleanup` from the sample: one sample repository gets a merged linked worktree
on a merged branch, a dirty worktree and an unmerged branch. Applying removes the worktree from that repository's
`worktrees` in the in-memory snapshot and returns made-up 40-hex commits. The `Api` interface change makes the type
checker enforce the demo implementation.

## Risks / Trade-offs

- [Deleting a branch loses its reflog] → The result shows the commit and restore command; only branches whose content
  is provably in the base are offered, so the work itself is never lost.
- [`merged` is as of the last fetch; a stale `origin/HEAD` makes fewer things removable, never more] → Staleness only
  hides candidates: an out-of-date base lacks commits, it cannot contain extra ones. The dialog suggests pulling first.
- [A squash merge that was later reverted in the base still compares as "not merged"; a branch whose changes were
  re-done identically by someone else compares as merged] → Both are the correct answer for "is anything lost".
- [`git worktree remove` deletes ignored files — `node_modules/`, but also a local `.env`] → Stated in the dialog;
  unchanged from today's session-worktree removal. Not blocking, because nearly every worktree has ignored build files.
- [User-created locked worktrees are never removable] → Deliberate: a lock is someone saying "keep this". The reason
  is shown; the user can `git worktree unlock` themselves.
- [Content comparison on a repository with hundreds of local branches is slow] → Branches are checked with bounded
  concurrency; each check is two local diffs. The preview is on demand, never during a scan.

## Migration Plan

No data migration. CLAUDE.md invariant 1 and the `dashboard-api` spec change together in this change. Rollback is
reverting the change; branches deleted meanwhile stay deleted (restorable from the reported commits).
