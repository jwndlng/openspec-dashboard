# Design

## Context

The end-session dialog (`src/ui/endSessionDialog.tsx`) reads `api.worktreeStatus(id)` when it opens and gets back
`removable`, an optional `reason` and the worktree's `work` status. Two defaults are derived from it today:

- the removal checkbox: `setRemove(result.removable && result.work?.state === "merged")`, inline in the effect;
- the pull checkbox: `pullOffer(repo, work)` in `src/ui/sessionState.ts`, `preselected: offered && work?.state === "merged"`,
  overridden by `pullChoice` once the user touches it.

`removable` is the server's verdict under "Worktree clean-up is offered only when safe" (dashboard-created, clean, and
merged or nothing that exists only on the branch), and `closeSession(id, removeWorktree)` re-checks it on confirmation.
The pull is the repository's own `usePull().pull`, fast-forward-only. The `merged` condition was chosen in
`pull-after-session-kill` so that a habitual confirm would contact a remote only for work already known to have landed
(see that change's design, "Risks"). The user has now asked for the opposite default; see proposal.md.

## Goals / Non-Goals

**Goals:**

- Both defaults are decided by pure functions in `sessionState.ts`, testable without a DOM, as `pullOffer` already is.
- The dialog keeps its shape: same checkboxes, same order of end → remove → pull, same report when a pull leaves the
  checkout behind.

**Non-Goals:**

- No server change: `src/server/sessions/`, `src/server/pull.ts` and `src/server/api.ts` are untouched, so invariant 1
  needs no edit — removal and pull still happen only on the user's confirmation of a visible, ticked control.
- No persisted preference.

## Decisions

**Removal default = `removable`.** A new `removalPreselected(status)` returns `status?.removable === true`. The work
status is no longer consulted: `removable` already excludes uncommitted and unique work, which is the only thing a
removal could lose, and the branch survives the removal. Alternative considered: also pre-select for `pushed` only
when a pull request is known merged — rejected, it would pull the pull-request query into the dialog and still be stale.

**Pull default = offered.** `pullOffer` returns `preselected: offered`. The `PullOffer` shape stays, so the dialog and
its `pullChoice ?? offer.preselected` logic are unchanged, and the `work` parameter is dropped from the signature. For
unshipped work the pull is ticked too: it touches only the main checkout, never the session's worktree or branch, and
refuses rather than forces.

**The danger path is unchanged.** With unshipped work the dialog still says "Not shipped", offers **Ship instead**, and
its confirm reads **End anyway**; removal is not offered there, so the only default that applies is the pull.

## Risks / Trade-offs

- [A habitual confirm now contacts the remote on every session end in a git repository] → Requested behaviour; the
  checkbox is visible and clearable, the pull is fast-forward-only with hooks disabled, off the default branch it only
  fetches, and a failure leaves the dialog open with git's reason.
- [A worktree whose pull request is still open gets removed] → Nothing is lost: the branch is pushed and kept, and a new
  session for the change checks the existing branch out again into a fresh worktree. The card loses that worktree's
  work status until then.
- [Overlap with `auto-merge-cleanup`] → That change edits "Worktree clean-up is offered only when safe" and the session
  manager; this one adds a separate requirement and edits only UI files, so the two merge independently.
