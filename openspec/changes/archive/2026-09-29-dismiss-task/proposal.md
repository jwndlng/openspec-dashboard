# Proposal

## Why

Not every change goes ahead. An idea jotted down with **New change**, a proposal that turned out to be the wrong
approach, a duplicate — today such a change stays on the board in `Backlog` or `Drafts` forever, because the only way
out of the board is archiving, and archiving records the change as done. Removing it means leaving the dashboard,
finding `openspec/changes/<name>/` in the right checkout and deleting it by hand. The dashboard should offer to
dismiss a change the user does not want to proceed with and erase its directory from the project.

## What Changes

- The change detail view's header offers **Dismiss change** for an active change whose directory exists in the
  repository's main checkout. It is not offered for archived changes, and for a change that lives only in a linked
  worktree it is shown disabled with the reason (the worktree's own session or **Clean up** is the way out there).
- **Dismiss change** opens a confirmation dialog that lists every file in the change's directory and says, per file,
  whether it can be restored from git (committed and unmodified) or would be **lost for good** (untracked or with
  uncommitted edits; every file in a repository without git). It also lists linked worktrees that hold their own copy of
  the change and says that they are kept — and that the card stays on the board while one of them holds a copy.
  Cancel has the focus; the destructive button says what it does.
- Confirming deletes `openspec/changes/<name>/` from the main checkout and, in a git repository, stages that removal
  with one `git add --all -- openspec/changes/<name>/` — best-effort, never followed by a commit. Nothing outside the
  directory is touched: no other file, no worktree, no branch, no ref.
- The server re-checks when the user confirms and never trusts the dialog: when the directory's content changed since
  the dialog was opened (an agent wrote a file, the user edited one), or an agent session for the change is running, the
  dismissal is refused and nothing is deleted.
- **BREAKING (invariant)**: the dashboard may now **delete a change directory** in a tracked repository — a new,
  seventh enumerated exception to "never writes to tracked repositories", and the second git invocation that may write
  the index. It still never commits, never touches a linked worktree, and never runs the `openspec` CLI.
- New read-only `GET /api/repos/<id>/changes/<name>/dismiss` (what would be deleted) and mutating
  `POST /api/repos/<id>/changes/<name>/dismiss` (delete it), under the same-origin guard. Dismissal is independent of
  the agent-sessions setting.
- The activity feed needs no new event: the next scan records the change's disappearance as it records any removed
  change.
- The demo simulates dismissal in memory.

## Capabilities

### New Capabilities
- `change-dismissal`: which changes can be dismissed, what the confirmation shows, what is deleted and staged, the
  re-check on confirmation, and what dismissal never does.

### Modified Capabilities
- `dashboard-api`: "The dashboard never writes to tracked repositories" gains the change-dismissal exception (deleting
  the change directory and staging that removal); new dismiss endpoints.
- `change-detail`: the detail header offers **Dismiss change**; "The detail view is an overlay over its board" allows
  that one confirmed write and keeps `Escape` for the confirmation dialog while it is open.
- `demo-site`: dismissal is simulated in the demo.

## Impact

- `src/server/dismissChange.ts` (new) — the preview (read-only) and the confirmed deletion plus its one `git add`; the
  only place that deletes a change directory.
- `src/server/api.ts` — the two dismiss routes.
- `src/server/sessions/manager.ts` — read-only: whether a session for a change is running (existing session list).
- `src/shared/types.ts` — dismissal preview and result types.
- `src/ui/dismissChange.tsx` (new; the confirmation dialog), `src/ui/changeDetail.tsx` (header action),
  `src/ui/api.ts`, `src/ui/styles.css`.
- `src/ui/demo/demoApi.ts` — simulated dismissal.
- `test/` — dismissal against temporary git and non-git repositories (committed, modified, untracked, symlinks,
  changed-since-preview, running session, archived, worktree-only, linked-worktree copy kept), API tests incl.
  same-origin refusal and invalid names, demo API test.
- `CLAUDE.md` (invariant 1: the seventh exception and the second index-writing `git add`), `README.md` (feature list
  and the "what it writes" list).
- Builds on `add-cleanup-capabilities` and `integrate-console-detail-view`, both merged but not yet archived: the
  modified requirements here start from those changes' versions, so they must be archived first.
- No new dependencies, no network.
