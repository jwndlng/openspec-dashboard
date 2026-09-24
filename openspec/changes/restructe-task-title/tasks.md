# Tasks

## 1. Card top: name first, status below

- [x] 1.1 In `src/ui/styles.css`, make `.card-top` a column (`flex-direction: column; align-items: stretch`, small gap) and `.card-status` start-aligned (`justify-content: flex-start`), keeping `.card-status:empty { display: none }`; update the `.card` comment to describe the order. Verify with `bun run dev` that a card with a session shows the whole name on the top line and the badge and console link on the line below.
- [x] 1.2 In `src/ui/kanban.tsx`, update the comment in `ChangeCard` to say the session status sits under the name (markup order already puts `.card-title` before `.card-status`). Verify that a card without a session or worktree shows no gap between the age and the progress bar.

## 2. Show details sized like the starter

- [x] 2.1 In `src/ui/styles.css`, set `.card .show-details` to `font-size: 12px` with the starter's vertical padding and narrow sides (`padding: 3px 2px 3px 5px`, `gap: 1px`), keeping its transparent border, colours and hover, with a comment that it follows `.btn.sm`. Verify on the board that **Show details** and **▶ Implement** on a `Ready` card have the same height and text size.

## 3. Progress bar names its unit

- [x] 3.1 In `src/ui/kanban.tsx`, give `Meter` a `showUnit` option that renders the value as `done/total Artifacts` or `done/total Tasks` (from `unit`), and pass it from `ChangeCard` only; in `src/ui/styles.css` let the labelled value size to its text. Verify on the board that a `Drafts` card reads e.g. `2/4 Artifacts`, an `Implementing` card `3/12 Tasks`, and the detail view's task bar still reads `3/12`.

## 4. Tests and checks

- [x] 4.1 In `test/changeDetail.test.ts`, extend the card-content test to assert that `.card-title` precedes `.card-status` inside `.card-top`, and that the card's meter value reads `4/12 Tasks` while the detail header's reads `4/12`; add a `Drafts` card case reading `n/m Artifacts`. Verify with `bun test test/changeDetail.test.ts`.
- [x] 4.2 Run `bun run check` and confirm lint, typecheck and tests pass; run `openspec validate restructe-task-title --strict`.
