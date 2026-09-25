# Design

## Context

`src/server/pull.ts` fetches, reads the branch's ahead/behind counts and runs `git merge --ff-only`. When the merge
fails, the result is `refused` with `reasonFrom(stderr)`, git's own sentence, and nothing more. The UI
(`src/ui/pull.tsx`, `src/ui/pullState.ts`) shows that as a `refused` badge whose tooltip is the only detail; the
end-session dialog (`src/ui/endSessionDialog.tsx`) reports the same text when `pullNeedsReport` is true.

The files that block are almost always what `src/server/createChange.ts` wrote and staged: `.openspec.yaml` (whose
`created:` date or schema line often differs from the committed one) and `prompt.md`. git refuses these for two
reasons: a staged new file whose index content differs from the incoming blob ("Entry … not uptodate"), and an
untracked file at a path the merge adds ("untracked working tree files would be overwritten"), even when its content
is the same.

`add-cleanup-capabilities` also modifies the "never writes" requirement in `dashboard-api`. Its code is merged but its
spec is not archived; this change's delta is written on top of that version (see Risks).

## Goals / Non-Goals

**Goals:**
- Compute the blocking files and their classification with read-only git, independent of git's message wording.
- Make the only new writes small, enumerated, and reversible: a copy first, removal of exactly the proven leftovers,
  and a put-back if the fast-forward still fails.
- One confirmation surface, reused by the board header, the overview row and the end-session dialog.

**Non-Goals:**
- Resolving anything that is not a change leftover, including edits to tracked files under `openspec/changes/`.
- Leftovers of a change that was archived upstream (the incoming commits do not contain the path, so git does not block
  and the file is not a blocking file). Those remain for repository cleanup or the user.
- Diverged histories: explained, never repaired.
- A restore action for the saved copies; the result names where they are.

## Decisions

### Blocking files are computed, not parsed from stderr
After the fast-forward is refused, `pull.ts` runs:
- `git diff --name-only -z --no-renames HEAD <upstream>` — the paths the incoming commits change;
- `git status --porcelain=v1 -z --untracked-files=all --no-renames` — the paths with local changes and their states;
- the intersection is the blocking set. Empty set → keep today's behaviour (git's message, no offer).

Parsing git's "would be overwritten" lists was rejected: the wording is localised and differs between the index and
untracked cases, and it stops after the first class of error.

### Classification per file
A blocking path is a leftover when it matches `openspec/changes/<name>/…` with `CHANGE_NAME` (and `<name>` ≠
`archive`), its status is `A ` / `AM` (staged new, optionally modified in the working tree) or `??` (untracked), and
`git ls-tree <upstream> -- <path>` finds a blob. Everything else is local work. For leftovers the dashboard records:
- `incoming` — the upstream blob id (`ls-tree`),
- `staged` — the index blob id when staged (`git ls-files -s -- <path>`),
- `worktree` — `git hash-object --path=<path> -- <path>` (no `-w`), so filters apply the way git would apply them.

`identical` ⇔ `worktree === incoming` and (`staged` absent or `=== incoming`). These three ids are also the claim the
confirmation sends back, so "unchanged since shown" is a comparison of ids, with no extra token or server-side state.

### Result and request shapes (`src/shared/types.ts`)
```ts
interface PullBlockingFile { path: string; kind: "leftover" | "local-work"; differs?: boolean;
  incoming?: string; staged?: string; worktree?: string }
interface PullResult { …; blocking?: PullBlockingFile[]; resolvable?: { upstream: string };  // upstream commit id
  resolved?: { path: string; copy?: string }[]; hint?: string }
```
`hint` carries the plain-language next step for refusals (commit or set aside / reconcile outside the dashboard).
The resolve request is `POST /api/repos/<id>/pull` with `{ resolve: { upstream, files: PullBlockingFile[] } }`
rather than a new route: it shares the eligibility check, the in-flight guard and the rescan. `api.ts` validates the
shape (commit id is 40/64 hex, paths are relative with no `..` segment, bounded count) and returns `400` otherwise.
A plain pull keeps accepting an empty body.

### Resolve sequence (in `pull.ts`, under the same in-flight lock)
1. Re-inspect: on the default branch with an upstream, `rev-parse <upstream>` equals the claimed commit, not diverged.
2. Recompute the blocking set and classification; it must equal the claim path for path and id for id, all leftovers.
3. For each differing leftover, copy to `~/.openspec-dashboard/pull-backups/<repo-id>/<UTC timestamp>/<path>`; when
   the staged blob differs from both the working tree and the incoming blob, also write it (`git cat-file blob`) as
   `<path>.staged`. Copy failure aborts before anything is removed.
4. Hold every leftover's working-tree bytes in memory, then `git rm --cached --quiet -- <staged leftovers>` and unlink
   every leftover file. Directories are left in place — the fast-forward refills them, and git ignores them if not.
5. `git -c core.hooksPath=/dev/null merge --ff-only --quiet <upstream>`.
6. On failure: write each file back from memory, `git add -- <previously staged leftovers>`, return `refused` with
   git's reason and the copies. On success: `fast-forwarded` with `resolved`.

`git rm --cached` was chosen over `git reset -- <path>` (reset is on the forbidden list) and over `git rm -f`
(a force flag, and it would delete the working-tree file before we held its bytes). `git stash` was rejected
outright: it is forbidden, and it would also sweep up unrelated local work.

The repository id is used as a directory name only after mapping any character outside `[A-Za-z0-9._-]` to `_`.

### Everything stays in `pull.ts`
The invariant names the modules that write; adding a second pull module would widen that list. The classification
helpers are pure functions over git output and are exported for unit tests.

### UI: the badge becomes the entry point
When a result has `blocking`, the outcome badge in `PullButton` is a button that opens a `Modal` ("Pull refused")
listing the files, each marked *leftover — same as incoming*, *leftover — differs, a copy will be kept*, or *local
work*, plus the `hint`. With `resolvable`, it shows **Resolve and pull** with a one-line summary of what will happen;
confirming calls `api.resolvePull(repoId, resolve)` through `PullProvider` (same in-flight map, so the Pull button shows
running). The end-session dialog renders the same list component inline under its pull report. `pullOutcome` gains a
`blocked by leftovers` label (warning tone) so the overview row tells both cases apart at a glance.

### Demo
`demoApi.ts` marks one sample repository as blocked on its first pull (one identical `.openspec.yaml`, one differing
`prompt.md` under a made-up change) and answers `resolvePull` with a fast-forward and a made-up copy path.

## Risks / Trade-offs

- [Archive order with `add-cleanup-capabilities`: both replace the full "never writes" requirement] → this delta
  already contains cleanup's text. Archive cleanup first; if this change is archived first, re-apply item (6) from
  cleanup when archiving it. Noted in tasks.
- [Race between the check and the removal — another process edits a leftover in that window] → the bytes removed are
  the bytes held in memory and put back on failure; a write landing after the unlink would be a new untracked file
  that git then refuses, which triggers the put-back.
- [The put-back itself fails (disk full, permissions)] → the result says so and names the copies; differing leftovers
  are always copied before removal, identical ones are recoverable from the upstream commit.
- [An identical staged leftover does not actually block git] → it is in the blocking set anyway; removing and
  re-adding it through the fast-forward is a no-op for its content.
- [`hash-object --path` with unusual filters (LFS, custom clean filters)] → a mismatch only means "differs", which
  costs a copy, never a loss.

## Migration Plan

No data migration. `CLAUDE.md` invariant 1 and the README's "what it writes" list are updated in the same PR. Rollback
is a revert; backups under `~/.openspec-dashboard/pull-backups/` are harmless to leave.
