# Tasks

## 1. Fix the layout

- [~] 1.1 In `src/ui/styles.css`, give `.new-change .new-change-depends label` `flex-direction: row` (keeping `flex: 1 1 auto`, `min-width: 0`, the column hint's `margin-left: auto`), set `.new-change-depends li` to `align-items: baseline` and the row's checkbox to `flex: none; margin: 0`; verify by `bun run dev`, opening **New change** on a board with active changes, that each choice shows checkbox, name and column on one line, the column at the end, a long name wrapping only within itself, and that clicking the name toggles the box
- [~] 1.2 Check the By label checklist and the name/prompt fields of the same form are unchanged (labels still stacked above their inputs); verify visually in `bun run dev`

## 2. Regression test

- [x] 2.1 Add a stylesheet test (`test/dependsOnLayout.test.ts`, in the style of `test/consoleLayout.test.ts`) that reads `src/ui/styles.css` and asserts the `.new-change .new-change-depends label` rule sets `flex-direction: row`; verify it fails without the fix from 1.1 and passes with it (`bun test <file>`)

## 3. Finish

- [x] 3.1 Run `bun run check` and verify lint, typecheck and tests pass
- [x] 3.2 No What's new entry: this is a fix, and per CONTRIBUTING.md ("What's new") fixes do not add one; verify `src/ui/changelog.ts` is unchanged in the diff
