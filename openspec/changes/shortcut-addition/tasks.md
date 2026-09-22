# Tasks

## 1. The new response

- [x] 1.1 Add `{ id: "resolve-conflicts", label: "Resolve PR conflicts", text: "Resolve PR conflicts", submit: true }` to `DEFAULT_QUICK_REPLIES` in `src/ui/quickReplies.ts`, after `Yes, create a PR`; verify by updating the expected order in `test/quickReplies.test.ts` and running `bun test test/quickReplies.test.ts` (the existing loops then also cover the new entry: text equals label, submitted, no control characters)

## 2. The `Shortcuts:` label

- [x] 2.1 In `TerminalView` (`src/ui/sessionPanel.tsx`), render a `<span class="hint session-replies-label">Shortcuts:</span>` with a per-session id as the first child of `.session-replies`, and replace the group's `aria-label="Default responses"` with `aria-labelledby` pointing at it; verify with `bun run dev` that a running session shows `Shortcuts:` before the four buttons, and that an ended session shows neither
- [x] 2.2 Add `.session-replies-label { flex: none; }` (and any spacing needed) to `src/ui/styles.css` next to `.session-replies`; verify in `bun run dev` with three panes shown that the row wraps without the label separating oddly or the terminal overlapping it

## 3. Check

- [x] 3.1 Run `bun run check` and verify lint, typecheck and tests pass
- [x] 3.2 Run `bun run build` and verify `dist/openspec-dashboard` serves the panel with the label and the new response
