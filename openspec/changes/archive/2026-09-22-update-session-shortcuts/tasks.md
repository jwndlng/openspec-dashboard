# Tasks

## 1. Server: submit the next-step prompt

- [x] 1.1 Add the prompt route's result type to `src/shared/types.ts` (`Session & { submitted: boolean }`, the shape
      `ShipResult` already has) and verify `bun run check` typechecks.
- [x] 1.2 Make `SessionManager.prompt()` in `src/server/sessions/manager.ts` async: keep every existing check and
      refusal unchanged, set `session.action` before sending, then `await this.submit(id, text)` instead of
      `proc.write(text)`, and return the session with `submitted`. Update the method's comment — it currently states
      the "never Enter" rule that this change replaces. Verify with `bun test test/sessionPrompt.test.ts`.
- [x] 1.3 Await the result in the `prompt` sub-route of `src/server/api.ts` and verify the route still answers with the
      session plus `submitted` (`bun test test/sessionPrompt.test.ts test/api.test.ts`).

## 2. UI: report whether it was sent

- [x] 2.1 Change `promptSession` in `src/ui/api.ts` to return the new result type; verify `bun run check` typechecks
      both the real and the demo implementation.
- [x] 2.2 In `start()` in `src/ui/sessions.tsx`, report the unsent notice for the targeted session when
      `submitted` is false (and clear it when true), next to the existing focus tick. Verify the notice appears on the
      right pane only.
- [x] 2.3 Update the next-step button tooltips in `src/ui/sessions.tsx` (card) and `src/ui/sessionPanel.tsx` (panel
      header) to say the prompt is sent to the running session, with no mention of pressing Enter. Verify by reading
      both tooltips in the running dashboard.

## 3. Demo site

- [x] 3.1 Make `demoSessions.prompt` in `src/ui/demo/demoSessions.ts` submit the prompt the way `ship` does and return
      `submitted: true`; drop the "Enter stays with the visitor" comment. Verify with
      `bun test test/demoSessions.test.ts`.
- [x] 3.2 Update `promptSession` in `src/ui/demo/demoApi.ts` for the new result and verify `bun run check` passes.
      (No edit needed: `attempt()` passes the result type through; typecheck confirms it.)

## 4. Tests

- [x] 4.1 Rewrite the first test in `test/sessionPrompt.test.ts`: the next step is typed, echoed and submitted with no
      keystroke from the user — assert the fake agent reports `you said: implement upgrade-runtime` without
      `manager.write(s.id, "\r")`, and that the result's `submitted` is true and no second process started.
- [x] 4.2 Add a case where the terminal never echoes the prompt (the harness's menu/no-echo path used by the Ship and
      default-response tests): assert no Enter is sent, the session keeps running, `submitted` is false, and
      `session.action` is still the requested one.
- [x] 4.3 Keep the refusal test (`stage, archive, unknown action, not running, feature off`) green with the now-async
      `prompt()` — awaiting the rejection rather than catching a synchronous throw. Verify
      `bun test test/sessionPrompt.test.ts`.

## 5. Documentation and validation

- [x] 5.1 Update the agent-sessions note in `CLAUDE.md` so it no longer says next-step prompts never include Enter;
      state the current rule (typed, echo-checked, separate Enter; never confirms a menu). Verify by reading it back
      against `openspec/specs/agent-sessions/spec.md`.
- [x] 5.2 Run `openspec validate update-session-shortcuts --strict` and `bun run check`; both must pass.
- [ ] 5.3 Verify in the running dashboard (`bun run dev`): with a session running, pressing **Implement** on the card
      and in the panel header sends the prompt with one click, and the agent starts on it without a further key press.
