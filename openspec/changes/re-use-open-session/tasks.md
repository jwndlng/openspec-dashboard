# Tasks

Order matters: the server rule is what makes a second console impossible, so it and its tests come first. The UI helper
then has one case fewer to express, and the demo follows the server so the recording answers the same way.

## 1. One open session per change, in the manager

- [x] 1.1 In `src/server/sessions/manager.ts` `open()`, drop the `archiving` comparison so the existing-session lookup
      is `repoId` + `change` + `OPEN_SESSION_STATES`, and rewrite the comment above it to state the rule (one open
      session per change, whatever the action, `list()` being newest-first so the newest open one is returned) and why
      the in-place case needs it too; verify `bun run typecheck` reports no unused `archiving` binding
- [x] 1.2 Rewrite `test/sessionPrompt.test.ts`'s "archive runs in its own worktree next to the change's running
      session" test for the new rule: with an Implement session running and the change moved to `done`, opening
      `archive` returns the same session id, `list()` has exactly one running session, and no `archive-<change>`
      worktree directory was created; verify `bun test test/sessionPrompt.test.ts`
- [x] 1.3 Add a case to the same test file proving the in-place path: for a tracked folder without git (the harness's
      non-git repository, as `test/integration.test.ts` and the in-place tests set one up), a running session and an
      `archive` open give one running session and one agent process; verify `bun test test/sessionPrompt.test.ts`
- [x] 1.4 Update `test/terminalSessions.test.ts`'s "one running session per change; archive gets its own worktree and
      branch" test so its archive assertions keep proving the opening path for a change with **no** session running
      (it already uses a second change) and its name says "per change"; verify `bun test test/terminalSessions.test.ts`

## 2. Every available action reaches the running session

- [x] 2.1 In `manager.ts` `prompt()`, remove the `action === "archive" || session.action === "archive"` refusal and
      rewrite the method's doc comment: every action the change's stage allows may be sent, including Archive, and the
      prompt runs where that session runs; verify `bun run typecheck` passes
- [x] 2.2 In `test/sessionPrompt.test.ts`, change the refusal test so `archive` is no longer among the `400`s (keep
      stage, unknown action, unknown session and feature-off) and add a test that sending `archive` to the running
      session of a change in `Done` is submitted, leaves `list()` with one running session and sets that session's
      `action` to `archive`; verify `bun test test/sessionPrompt.test.ts`
- [x] 2.3 In the same file's API test, replace the `{ action: "archive" }` → `400` expectation with `200`, keeping the
      cross-origin `403` and the fresh-work-status assertions; verify `bun test test/sessionPrompt.test.ts`
- [x] 2.4 Add a test that an action is accepted for a session whose own action is `archive` (a session opened as
      `archive` for a change in `Done` with a `validate` sub-state takes `validate`); verify
      `bun test test/sessionPrompt.test.ts`

## 3. The UI helper loses its exception

- [x] 3.1 In `src/ui/sessionState.ts`, reduce `nextStepFor` to `(sessions, repoId, change)` returning
      `{ promptSessionId }` for the change's running session, drop the `blocked` result, and rewrite its doc comment;
      verify `bun run typecheck` reports no caller left passing an action
- [x] 3.2 Update the two call sites — `src/ui/sessions.tsx` (`start`) and `src/ui/sessionPanel.tsx` (the next-step
      filter) — for the new signature, so every starter of the change's stage is offered for its running session;
      verify `bun run typecheck` and `bun run lint` pass
- [x] 3.3 Correct the comments that state the old exception: the `SessionControls` starter comment in
      `src/ui/sessions.tsx`, `ConsoleSessionList`'s "A change can legitimately have two" in
      `src/ui/sessionPanel.tsx` (two records, only one of them running), and `sessionsForChange`'s note about
      archiving running alongside; verify `bun run lint` passes
- [x] 3.4 Rewrite the `nextStepFor` expectations in `test/workStatusUi.test.ts` (its "a starter goes into the change's
      running session; archive always gets its own" test): archive now targets the running session, and a session whose
      action is `archive` is a valid target; verify `bun test test/workStatusUi.test.ts`

## 4. The demo answers the same way

- [x] 4.1 In `src/ui/demo/demoSessions.ts` `prompt`, remove the `archiving runs in its own session` refusal and note in
      a comment that `open` already reuses the change's running session; verify `bun run typecheck` passes
- [x] 4.2 Update `test/demoSessions.test.ts`'s `promptSession(pushed.id, "archive")` expectation to the demo's new
      answer (submitted, one running session for that change, its action `archive`); verify
      `bun test test/demoSessions.test.ts`

## 5. Whole-project verification

- [x] 5.1 Run `bun run check` and fix anything it reports
- [x] 5.2 Run `bun run build` and start `dist/openspec-dashboard` against a scratch repository with agent sessions on:
      with a session running for a change in `Done`, the Console tab offers **Archive**, activating it types the
      archive prompt into that terminal, Open work still shows one row for the change, and no `archive-<change>`
      directory appears under `~/.openspec-dashboard/worktrees/`
- [x] 5.3 In the same build, confirm the unchanged path: with no session running, **Archive** on a `Done` change opens
      a session on `chore/archive-<change>` in its own worktree, as before
