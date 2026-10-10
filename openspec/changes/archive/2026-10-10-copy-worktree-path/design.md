# Design

## Context

The detail header (`ChangeFacts` in `src/ui/changeDetail.tsx`) already shows the branch badge, whose tooltip names a
linked worktree (`checkoutHint`), and the work-status badge of the change's session worktree (`WorkStatus`, which reads
`useSessionUi().worktrees`). The Console tab's orphan actions copy a `cd` command. Nothing shows the path itself.

## Goals / Non-Goals

**Goals:** see the change's worktree path in the detail header and copy it with one click.

**Non-Goals:** showing it on board cards (the card spec keeps worktrees in the detail view); opening an editor or a
terminal; listing every checkout that holds the change (the branch badge's tooltip does that).

## Decisions

- **Which path.** A pure helper `changeWorktreePath(change, worktrees)`: `change.checkout.path` when the checkout is not
  the main one, else the session worktree for `repoId`/`name` with the latest `lastActivityAt`. The linked checkout comes
  first because that is where the board's data comes from; a session worktree normally *is* that checkout, so the two
  rarely disagree. Session worktrees are listed only when agent sessions are enabled, so no extra gating is needed —
  but the helper takes the list as an argument, so it is testable without a renderer.
- **Copy the path, not `cd <path>`.** The user asked for the path; it pastes into a terminal after `cd `, into an editor's
  open dialog and into Finder's Go to Folder alike. Copy cd stays where it is.
- **A button styled as a badge.** It sits among the other facts, which are badges; a `<button class="badge worktree">`
  keeps it keyboard-reachable. The path is split into its parent (`head`, clipped with an ellipsis) and its last
  segment (`tail`, never clipped), reusing the branch badge's `.truncate` styles, so the worktree's directory name stays
  visible.
- **Confirmation** mirrors `CopyRefButton`: `Copied` for 1.5 s, only after the clipboard promise resolves; a rejected
  write is swallowed silently.
- **Component split.** `WorktreePath` uses hooks (`useSessionUi`, `useState`); `ChangeFacts` stays hook-free, so the
  existing vnode tests still expand it and see the component as a leaf with its props.

## Risks / Trade-offs

- A path is personal-looking data on screen — but it is the user's own machine and the page is loopback-only; nothing
  new leaves it.
- `navigator.clipboard` needs a secure context; `http://127.0.0.1` is one, and the existing copy controls rely on it.
