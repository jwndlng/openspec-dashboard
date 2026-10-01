# Tasks

## 1. Start without navigating

- [x] 1.1 Add `startShowsConsole(place: "card" | "console")` to `src/ui/sessionState.ts` (card → false, console → true)
  and verify with a test in `test/consoleSession.test.ts` (or the nearest `sessionState` test) asserting both places.
- [x] 1.2 Give `start` in `src/ui/sessions.tsx` a required `show: boolean`: keep awaiting `refresh()`, and call
  `openConsole` only when `show` is true (design D1); update the `SessionUi` type and the context default. Verify with
  `bun run check` (typecheck fails on any caller that does not pass it).
- [x] 1.3 Add the `place` prop to `SessionControls` and pass `startShowsConsole(place)` to `start`; pass
  `place="card"` from `src/ui/kanban.tsx` and `place="console"` from the untouched-console branch of
  `src/ui/sessionPanel.tsx`. Verify `bun run check` passes.
- [x] 1.4 Pass `true` from the next-step starters in `src/ui/sessionPanel.tsx` so they keep showing the session. Verify
  `bun run check` passes.

## 2. Verify

- [~] 2.1 Run `bun run dev` with agent sessions on and confirm on a board: **Draft artifacts** on a card starts the
  session, the board stays on screen, the card shows the `working` badge, and the badge opens the Console tab; starting
  from an untouched change's Console tab still shows the terminal in that tab; a refused start (e.g. agent not found)
  shows its reason on the card.
- [x] 2.2 If `README.md` says a starter opens the console, update that sentence; verify by grepping it for the starter
  wording.
- [x] 2.3 Run `openspec validate do-not-open-console-on-action --strict` and `bun run check`; both pass.
