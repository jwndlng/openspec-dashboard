# Proposal

## Why

Ending a session usually means the work is done: shipped, pushed, often already merged. Even so, the end-session dialog
ticks **also remove the worktree** and **also pull** only when the worktree's local work status is `merged`, and that
status is only as fresh as the user's last fetch. Right after a pull request merges on GitHub the status still reads
`pushed`, so the user has to tick both boxes by hand nearly every time, and when they forget, worktrees pile up and the
board keeps showing merged work as unmerged. Removing a worktree the dialog already offers loses nothing (the dialog
offers it only when it is clean and its work exists elsewhere), and the pull is fast-forward-only, so both can be the
default.

## What Changes

- In the end-session dialog, **also remove the worktree** SHALL be ticked whenever it is offered — the worktree is clean
  and its work is merged or exists elsewhere — instead of only for `merged` work. When the worktree cannot be removed,
  nothing changes: the reason is shown and there is no checkbox.
- **also pull** SHALL be ticked whenever it is offered — a tracked git repository scanned without error — whatever the
  worktree's work status, instead of only for `merged` work. The pull stays the repository's own fast-forward-only pull
  action with its existing safety rules, outcomes and report.
- Both remain visible, clearable checkboxes; cancelling still ends, removes and pulls nothing. The user's choice is not
  remembered: every dialog starts from the defaults.
- The help page's sentence on **End session** says that the dialog removes the worktree and pulls by default.
- A What's new entry.

No server code, route, git subcommand or setting changes: the dialog already sends exactly what the user ticked, and
the server already refuses an unsafe removal.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: "Ending a session also offers to pull the repository" pre-selects the pull whenever it is offered;
  a new requirement, "Ending a session removes a removable worktree by default", pre-selects the worktree removal
  whenever it is offered.

## Impact

- `src/ui/sessionState.ts` — `pullOffer` pre-selects whenever offered; a pure helper for the removal default.
- `src/ui/endSessionDialog.tsx` — tick the removal whenever the status says removable.
- `src/ui/helpContent.tsx` — the **End session** sentence.
- `src/ui/changelog.ts` — What's new entry.
- `test/workStatusUi.test.ts` — the pre-selection rules.
- Depends on `auto-merge-cleanup`, which modifies "Worktree clean-up is offered only when safe"; this change leaves that
  requirement alone and touches neither the session manager nor the activity log.
- No new dependency, no network beyond the existing pull action, no new git subcommand.

## Non-goals

- A setting to turn the defaults off, or remembering the last choice.
- Removing or pulling without the dialog: ending a session by the agent exiting, by the dashboard stopping, or from the
  inline **Remove…** under Open work is unchanged.
- Deleting the session's branch; that stays with repository cleanup.
- Changing which worktrees can be removed or when the pull is offered.
