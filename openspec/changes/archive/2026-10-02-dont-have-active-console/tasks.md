# Tasks

## 1. Predicate

- [x] 1.1 Add a pure `hasRunningSession(card, sessions)` to `src/ui/sessionState.ts` next to `archivePending`: true when a session with the card's `repoId` and `name` as `change` is `running`, whatever its action. Verify with unit tests (`test/hideMerged.test.ts`) covering: running own session, running archive session, only exited/failed sessions, a running session of a same-named change in another repository, and no sessions.

## 2. Board

- [x] 2.1 In `src/ui/kanban.tsx`, take `sessions` from `useSessionUi()` and keep an archived card under **Hide merged** when `archivePending(...) || hasRunningSession(...)`; leave `archivePending` and the bound/count code unchanged. Verify by a test of the column's card selection (extract a small pure helper if needed) showing a merged archive with a running session is kept and counted, and dropped once that session is `exited`.
- [x] 2.2 Update the **Hide merged** tooltip in `src/ui/boardFilters.tsx` to say that a change with a running agent session stays shown until that session is ended. Verify by reading the rendered `title` in the UI (`bun run dev`).

## 3. Checks

- [x] 3.1 Run `openspec validate dont-have-active-console --strict` and `bun run check`; both pass.
- [x] 3.2 Manually with `bun run dev`: with **Hide merged** on, a merged archived change with a running session appears in `Archived`; ending the session from its console removes it after the next poll.
