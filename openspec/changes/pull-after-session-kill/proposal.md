# Proposal

## Why

When a session's work has been merged, ending it leaves the main checkout behind the remote: the dashboard reads
archives, specs and progress from that checkout, so the board keeps showing the change as if it were still in flight.
The end-session dialog is exactly the moment the user knows the work landed — it already offers to remove the
worktree there — but the only way to bring the checkout up to date is to find the Pull control afterwards, on another
view, and remember why.

## What Changes

- The end-session dialog gains a second offer next to "also remove the worktree": pull the session's repository, so the
  main checkout catches up with what was merged.
- The offer appears only for a repository the pull action can run in (tracked, scanned without error, a git
  repository) and is pre-selected on the same grounds the removal offer is — the worktree's work status is `merged`.
- Confirming the dialog runs the pull after the session has ended and the worktree has been removed, through the same
  action and the same outcome reporting the existing Pull controls use.
- An outcome the user needs to know about — fetched only, refused, or failed — keeps the dialog open and states it with
  its reason, because a pull that did not happen is the wrong-view problem the offer exists to prevent. A
  fast-forward or an already-up-to-date checkout closes the dialog.
- No new API route, no new git command, and no change to what a pull does: the dialog activates the existing
  `POST /api/repos/<id>/pull`.

Out of scope: the inline "Remove…" control for a worktree with no session record under Open work, and any pull that is
not started from a control the user activated.

## Capabilities

### Modified Capabilities

- `agent-sessions`: the clean-up offer made when a session ends also offers to pull the repository — when it is
  offered, when it is pre-selected, and that it runs after the session ended and the worktree was removed.
- `repository-pull`: the requirement that enumerates where the pull action is offered gains the end-session dialog as
  a place the user can activate it, and states that the outcome is reported there.

## Impact

- `src/ui/endSessionDialog.tsx` — the offer, the ordering of the actions on confirm, and reporting an outcome that
  needs stating.
- `src/ui/pull.tsx` — `PullProvider.pull` returns the result so a caller can act on it; the badge and reload behaviour
  stay as they are.
- `src/ui/sessionState.ts` — a pure helper deciding whether the pull is offered and pre-selected, and how the outcome
  reads in the dialog.
- `test/` — unit tests for the helper alongside the existing session and pull UI tests.
- No server, scanner or config change; `src/server/pull.ts` and the pull spec's safety rules are untouched.
