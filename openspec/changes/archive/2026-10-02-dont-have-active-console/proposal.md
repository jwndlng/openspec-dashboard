# Proposal

## Why

With **Hide merged** on (the default), an archived change disappears from the `Archived` column as soon as its archive
reaches the main checkout — even while an agent session for that change is still running. The card is the user's way
back to that session's console, so a session that is still open becomes hard to find and easy to forget. A running
session should keep its change on the board; only once the user has ended it may **Hide merged** hide the change.

## What Changes

- **Hide merged** never hides an archived change that has a **running** agent session (the change's own session or its
  archive session). The card stays in the `Archived` column, counts toward the column's header count and the bound of
  25, and is shown regardless of whether the change is merged or pending.
- Once that session has ended (exited or failed), the change follows the existing merged/pending rule again, so a merged
  change disappears from the column with **Hide merged** on.
- The merged/pending distinction itself is unchanged: a running session does not make a change "pending"; it only keeps
  the card visible.
- The **Hide merged** switch's tooltip says that changes with a running agent session stay shown until it is ended.
- Nothing new is read, fetched or written: the board already has the session list it needs. The main console and
  integration sessions belong to no change and never keep a card.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: the **Board filters** requirement — **Hide merged** keeps archived changes with a running agent
  session; and **The board's filters form one filter bar** — the **Hide merged** tooltip explains that exception.

## Impact

- `src/ui/sessionState.ts` — a pure predicate for "an archived change with a running session", next to `archivePending`.
- `src/ui/kanban.tsx` — the `Archived` column's **Hide merged** filter also keeps such changes.
- `src/ui/boardFilters.tsx` — the **Hide merged** tooltip.
- `test/archivePending.test.ts` (or a new `test/hideMerged.test.ts`) — unit tests for the predicate.
- No server, API, spec of agent sessions or invariant changes; the demo-site sample is unaffected.
