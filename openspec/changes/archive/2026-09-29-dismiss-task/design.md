# Design

## Context

The dashboard writes to a tracked repository in five places, each the only module allowed to do its kind of write
(`sharedConfig.ts`, `sessions/worktree.ts`, `pull.ts`, `createChange.ts`, `cleanup.ts`). The closest precedents are
**create-change** (writes `openspec/changes/<name>/` directly, then one best-effort `git add` of that directory) and
**cleanup** (read-only preview, then a confirmed apply that re-checks every item and never trusts the client). Dismissal
is the inverse of create-change with cleanup's preview/confirm/re-check shape.

A change can exist in several checkouts (`mergeChanges.ts`): the board shows the leading copy and lists the others in
`otherCheckouts`. The main checkout is the only one the dashboard writes to outside session worktrees, and the only one
whose working tree the user sees as "the project".

`add-cleanup-capabilities` and `integrate-console-detail-view` are merged but not archived; the requirements this
change modifies (`dashboard-api` "never writes", `change-detail` overlay) start from their deltas' text.

## Goals / Non-Goals

**Goals:**
- One confirmed action that removes an active change's directory from the main checkout and leaves the removal staged,
  ready for the user to commit.
- The user sees exactly what cannot be restored before confirming, and nothing is deleted that they did not see.

**Non-Goals:**
- Removing the change from linked worktrees, or its session worktrees and branches. Their work may be unmerged; ending
  the session and repository cleanup already handle them under their own safety checks.
- Undo. Git restores committed files (`git restore --staged --worktree -- openspec/changes/<name>/`); the dashboard does
  not keep a trash copy — that would be a second copy of repository data under `~/.openspec-dashboard/`.
- Dismissing an active copy left behind next to its archive (`foldLeftovers`) from the archived change's view. The
  server would allow it (the rule is about the directory), but the UI does not offer it in this change.
- Committing, or writing a "dismissed" marker anywhere. The activity log already records the removal on the next scan.

## Decisions

### D1. A new module, `src/server/dismissChange.ts`, is the only place that deletes a change directory
Mirrors the one-module-per-write rule of invariant 1. It exports `previewDismiss(repo, name)` (read-only) and
`dismissChange(repo, name, fingerprint, isSessionOpen)`. It has its own tiny git runner for the one writing `add`, like
`createChange.ts`, because `git.ts` is read-only by contract; read-only status goes through `git.ts`'s `statusPaths`.
*Alternative:* extending `createChange.ts` — rejected, it would blur which module owns which write and its tests.

### D2. Deletion via `fs.rm` of the validated directory, not `git rm`
`git rm -r` refuses when files have local modifications (needs `-f`) and ignores untracked files, so it would either
fail on exactly the drafts people want gone or need forcing. Instead: `lstat` the directory (must be a directory, not a
symlink), `realpath` it and require it to be `<realpath(repo)>/openspec/changes/<name>`, then `rm(dir, { recursive:
true })` — Node's `rm` unlinks symlinks without following them. Then `git add --all -- openspec/changes/<name>/`, which
stages the removal of the tracked files; when nothing was tracked the pathspec matches nothing, git exits non-zero, and
the result is `staged: false` — reported, not an error. Git runs with `cwd` = the repository path and resolves the
pathspec relative to it, so a project below the git top level works as it does for create-change.
*Alternative:* `git rm -r --cached` + `fs.rm` — two writing commands where one suffices.

### D3. What is shown and fingerprinted
The preview walks the directory with `lstat` (no symlink following; a symlink is listed as a file entry) and asks
`statusPaths(repo.path, "openspec/changes/<name>")` once, read-only with `GIT_OPTIONAL_LOCKS=0`. A file is **restorable**
when git tracks it and status lists nothing for it; **lost** when untracked, modified, added-but-uncommitted, or the
repository has no git. `isGit` comes from the scan (`RepoSnapshot.isGit`), as for in-place sessions — never from a git
command failing. The fingerprint is a SHA-256 over the sorted `(relative path, size, mtimeMs, state)` tuples; it is not a
secret, only a "same as shown" token. Linked worktrees holding a copy come from the snapshot's `checkout`/`otherCheckouts`.
Tracked files that are already deleted in the working tree are listed as restorable (so the user sees them) and are
part of the fingerprint.

### D4. Concurrency: a per-change lock shared with session starts
A module-level `Set` of `repoId\0name` guards a running dismissal (second one → `409`). `SessionManager.open` refuses
to start a session for a change that is being dismissed (same pattern as `isCleaningUp`), and `dismissChange` refuses
while `manager` reports an open session for `(repoId, change)` (`OPEN_SESSION_STATES`) — this matters most for in-place
sessions in non-git folders, where the agent writes into the very directory being deleted. With agent sessions
disabled there is no manager and the check is vacuous. The re-check order is: lock → session check → recompute
fingerprint → compare → delete → stage.

### D5. Routes
`GET|POST /api/repos/<id>/changes/<name>/dismiss` in `api.ts`, next to `postCreateChange`. Name validated with
`CHANGE_NAME` and `!== "archive"` before any file system access; repository eligibility exactly as create-change (enabled,
last scan ok). `POST` passes `crossSiteRefusal` like every mutating route and triggers `scanner.trigger()` on success.
Errors map: invalid name/body `400`, unknown repo or no active directory `404`, not eligible / stale / session / busy
`409`.

### D6. UI: header action plus a confirmation dialog inside the overlay
`src/ui/dismissChange.tsx` renders the dialog with the existing `modal.tsx` primitives; `changeDetail.tsx`'s
`DetailHeader` shows the action at the end of the facts row. Eligibility on the client is read from the snapshot
(`!archived` and the main checkout among `checkout`/`otherCheckouts`, or no `checkout` at all for non-git repositories);
the server decides. The dialog loads the preview on open, disables **Dismiss change** while loading, and after a `409`
shows the reason with **Show current state**, which reloads the preview. The overlay's `Escape` handler ignores the key
while the confirmation is open. After success the detail view closes via its existing close target unless the refreshed
snapshot still carries the change.

### D7. Demo
`demoApi.ts` answers both routes from the sample: files from the change's artifacts (the first `Drafts` change gets one
untracked file), and the dismissal removes the change from the in-memory snapshot.

## Risks / Trade-offs

- [Irreversible loss of uncommitted drafts] → the confirmation lists every file that cannot be restored and warns above
  the list; Cancel has the focus; the fingerprint refuses when anything changed after it was shown.
- [The card stays because a worktree holds a copy — looks like the dismissal failed] → the confirmation says so up front,
  and the detail view stays open on that copy instead of closing.
- [Time-of-check/time-of-use between fingerprint and `rm`] → the window is milliseconds and guarded against the only
  writer the dashboard controls (sessions, D4); an external editor writing in that window loses that write. Accepted, as
  for any `rm -r`.
- [A second writing `git add` weakens "only create-change writes the index"] → it is the same subcommand with a single
  pathspec after `--`, on a validated name, never run for a refusal; the spec and invariant 1 enumerate it.
- [Staging a removal next to the user's own staged work] → only the change's pathspec is staged; nothing is committed,
  so the user's next commit decides.

## Migration Plan

No data migration. Ships behind no flag; the action appears in the detail header. Rollback is reverting the change —
nothing persistent is written outside the repositories. Archive `add-cleanup-capabilities` and
`integrate-console-detail-view` before archiving this change, so the modified requirements apply on top of theirs.
