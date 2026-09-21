# Tasks

## 1. The focus-once helper

- [x] 1.1 Add `src/ui/focus.ts` exporting `focusOnce()`, which returns a ref callback that focuses the first non-null element it receives and ignores every later call; verify `bun run typecheck` and `bun run lint` pass
- [x] 1.2 Add `test/focus.test.ts` covering a fake element: the first call focuses, a second call with the same element does not, a `null` (detach) followed by another element does not, and two `focusOnce()` instances are independent; verify `bun test test/focus.test.ts` passes

## 2. The form

- [x] 2.1 In `src/ui/newChangeForm.tsx`, replace `ref={(el) => el?.focus()}` on the change name input with one instance held for the life of the component (`useMemo(focusOnce, [])`), so the ref value is stable across renders; verify by reading the diff that no other behaviour of the form changed
- [x] 2.2 Confirm no other component uses an inline focusing ref (`grep -rn "ref={(" src/ui/` finds none; the only remaining `focus()` calls are `focus.ts` and `sessionPanel.tsx`'s deliberate terminal focus)

## 3. Verification

- [x] 3.1 Run `bun run check` (lint, typecheck, full test suite) and verify it passes
- [x] 3.2 Verify the spec's four scenarios in a real browser: the demo build (`bun run build:demo`) driven in headless Chrome over CDP with real mouse and key events — name field focused on open; 18 keystrokes all reach the prompt field with the caret at its end; focus and caret unchanged across a 60s board poll; reopening focuses the name field again. The same check against the pre-fix code reproduces the report (the first character lands in the prompt, the rest in the name field), so it would catch the regression
