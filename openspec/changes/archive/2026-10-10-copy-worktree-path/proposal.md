# Proposal

## Why

When a change is worked on in a worktree — an agent session's worktree under `~/.spec-control/worktrees/`, or a linked
worktree the change's data comes from — the only way to get to it from the dashboard is the branch badge's tooltip or
the Console tab's **Copy cd** for a worktree without a session. To jump into a feature in an editor or a terminal, the
user wants the path itself: visible on the change, and on the clipboard with one click.

## What Changes

- The change detail header shows the change's worktree as a badge with a folder glyph and the path, clipped at the head
  so its end — the worktree's own name — stays readable, the full path as its tooltip.
- Activating that badge copies the worktree's absolute path — exactly the path, no `cd`, no quoting — and confirms it
  briefly; when the clipboard refuses, it claims nothing.
- Which worktree: the linked worktree the change's data comes from (`checkout`, when it is not the main checkout);
  otherwise the change's session worktree under the dashboard home, the most recently active one when there are
  several. A change only in the main checkout, an in-place session, or a non-git repository shows no badge.
- Display only: nothing is written, no git command runs and no request leaves the page; the facts come from the
  snapshot and the session worktree list the UI already has.
- The board's cards stay as they are (the card spec keeps worktrees in the detail view).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `change-detail`: a new requirement, *The detail header shows and copies the change's worktree path*.

## Impact

- `src/ui/changeDetail.tsx` (`ChangeFacts`, new `WorktreePath`), `src/ui/sessionState.ts` (`changeWorktreePath`),
  `src/ui/format.ts` (`splitPathLabel`), `src/ui/icons.tsx` (`IconFolder`), `src/ui/styles.css`.
- Tests: new `test/worktreePath.test.ts`.
- No server, API, type or invariant change.
