# Design

## Context

The `Archived` column's **Hide merged** filter is one line in `src/ui/kanban.tsx`: a card is kept when
`!filters.hideMerged || archivePending(card, worktrees)`. `archivePending` (`src/ui/sessionState.ts`) decides merged vs
pending from the card's checkout and the session worktrees' work status only. The board already sits inside
`SessionProvider`, whose context carries `sessions: ChangeSession[]` (each with `repoId`, `change`, `state`), polled by
the session UI. The main console and integration sessions are kept out of that list by `changeSessions()`.

## Goals / Non-Goals

**Goals:**
- An archived change with a running session survives **Hide merged**, and is hidden again once that session ends.
- Keep the merged/pending distinction exactly as specified; this is a visibility exception, not a new state.

**Non-Goals:**
- Changing **Hide archived**, the stale filter, search or repository filters: those are the user's explicit choices and
  still hide a card with a running session.
- Ending sessions automatically, or prompting to end them, when a change is merged.
- Any server or API change.

## Decisions

- **A separate predicate, not a wider `archivePending`.** Add `hasRunningSession(card, sessions)` — true when a session
  with the card's `repoId` and `name` as `change` is in state `running`, whatever its action (the archive session runs
  under the same change name). The column filter becomes
  `!filters.hideMerged || archivePending(card, worktrees) || hasRunningSession(card, sessions)`.
  *Alternative*: fold it into `archivePending`. Rejected: "pending" means work still to be pushed or merged, and the
  spec keeps that meaning; mixing in session liveness would blur the requirement that defines it and its tests.
- **Only `running` counts.** `exited` and `failed` sessions keep nothing, so ending a session in the end-session
  dialog is exactly what lets a merged change go — the "close the session first" behaviour the prompt asks for. The
  card disappears on the next session poll after the end, with no extra trigger.
- **Matched by repository and change name**, like `sessionsForChange`, so a same-named change in another repository is
  not kept.
- **Bound and count follow naturally.** Kept cards enter `archivedCards` before the 25-bound and the header count are
  applied, so they count like any other shown archived card; no change to the column code.

## Risks / Trade-offs

- [A long-forgotten running session keeps a merged card on the board indefinitely] → Intended: the card is the way
  back to that session; the tooltip tells the user ending the session lets it go.
- [Session list not loaded yet or polling failed] → `sessions` is empty, so the board behaves as today; the card
  appears once the list arrives.
- [With agent sessions disabled] → there are no sessions, so behaviour is unchanged.
