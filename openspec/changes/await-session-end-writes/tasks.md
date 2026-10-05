# Tasks

## 1. Fix

- [x] 1.1 Keep the exit handler's `end()` promise in `SessionManager` and await it in `close()` and `shutdown()`;
  verify with `bun run typecheck`.
- [x] 1.2 Add a regression test to `test/terminalSessions.test.ts` asserting the on-disk record is the ended one once
  `close()` and `shutdown()` return; verify it fails without 1.1 and passes with it.
- [x] 1.3 Run `bun run check` and confirm it passes; confirm the macOS CI job passes on the pull request.
