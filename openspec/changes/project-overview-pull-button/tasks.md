## 1. Pull button variant

- [x] 1.1 In `src/ui/pull.tsx`, replace `PullButton`'s `compact` prop with `variant?: "board" | "overview"` (default `"board"`); for `"overview"` render `btn sm pull-btn on-overview` with no `ghost`, everything else unchanged
- [x] 1.2 In `src/ui/overview.tsx`, pass `variant="overview"` from `Row` and `Tile` instead of `compact`
- [x] 1.3 In `src/ui/styles.css`, add `.pull-btn.on-overview` to the `.project-console-btn.on-project` rule and to its `:hover` rule, so Pull has Console's height, padding, font size and `--border-strong` border at rest

## 2. Tests

- [x] 2.1 In `test/projectSettingsUi.test.ts`, assert that the `PullButton` in a row and in a tile gets `variant: "overview"`
- [x] 2.2 In `test/overviewStyles.test.ts`, assert that the rule covering `.pull-btn.on-overview` sets `border-color` and the same height as `.project-console-btn.on-project`, and that `pull.tsx` no longer applies `ghost` to the Pull button

## 3. Verify

- [x] 3.1 Run `bun run check`
- [~] 3.2 With `bun run dev`, check the overview in table and tiles layouts, light and dark, and at 200% zoom: Pull is bordered at rest, as tall as Console, and the row's actions stay on one line
