# Tasks

## 1. Selector

- [x] 1.1 In `src/ui/sessionState.ts`, replace `openWork()` with `openSessions(sessions)` — running sessions only, oldest `createdAt` first — and verify with a new unit test in `test/workStatusUi.test.ts` (ended and failed sessions are excluded; order is oldest first; empty input gives an empty list), replacing the old `openWork` test

## 2. Open work control

- [x] 2.1 Rewrite `OpenWork` in `src/ui/sessions.tsx` to render `openSessions(ui.sessions)`: hidden when sessions are disabled or none run; button `Open work <n>` in the neutral style; each row shows repository, change, action, agent, branch, `SessionBadgeView(sessionBadge(s))`, the `WorkBadge` of the worktree whose `path` equals `s.worktreePath` (when present) and `started <relTime> ago`; `Open` calls `ui.openPanel(s.id)` and closes the list — verify with `bun run dev` against a repo with one running and one ended session
- [x] 2.2 Remove `OrphanActions` and the now-unused imports (`openWork`, `cdCommand` in `sessions.tsx`, `api` if unused) and adjust `.open-work-*` styles in `src/ui/styles.css` only if the new row needs it — verify `bun run check` reports no lint or type errors
- [x] 2.3 Reword the orphan `WorkBadge` tooltip (drop "see Open work") and the end-session dialog hint in `src/ui/endSessionDialog.tsx` (the work stays visible on the change's card instead of "under Open work") — verify by grepping `src/ui` for "Open work" and finding only the control itself

## 3. Demo and tests

- [x] 3.1 Update the comment in `src/ui/demo/demoSessions.ts` `delete()` and rename the `test/demoSessions.test.ts` case "deleting a record leaves its worktree in the Open work list…" to describe what it checks (the worktree is still reported); add an assertion that the seeded demo has at least one running session — verify `bun test test/demoSessions.test.ts` passes
- [x] 3.2 Run `bun run check` and `bun run build`, then open the built binary's UI and confirm the Open work control lists only running sessions and disappears when the last one ends
