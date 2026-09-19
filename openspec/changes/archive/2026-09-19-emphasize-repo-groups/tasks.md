## 1. Tokens and group styles

- [x] 1.1 Add `--repo-group-mix` and `--repo-group-border-mix` next to the other repository tokens in both theme blocks of `src/ui/styles.css` (start: dark `10%` / `28%`, light `7%` / `30%`)
- [x] 1.2 Style `.repo-group` as a panel: `color-mix(in oklch, var(--repo-color) var(--repo-group-mix), var(--bg-section))` background, 1px border with `--repo-group-border-mix`, `var(--radius)`, `padding: 6px`; no literal colours
- [x] 1.3 Set `.repo-group-head .name` to `font-weight: 700` and adjust header padding so swatch, name and count align with the card edges inside the panel
- [x] 1.4 Increase `.repo-group + .repo-group` spacing to 8px so groups are clearly further apart than cards (6px)
- [x] 1.5 Confirm `src/ui/kanban.tsx` needs no change: header and cards are inside `section.repo-group.repo-tint`, and the flat single-repository path renders no panel

## 2. Contrast guard

- [x] 2.1 Add `test/repoContrast.test.ts`: parse `--repo-l`, `--repo-c`, `--repo-group-mix`, `--bg-section` per theme from `styles.css`; implement OKLCH → sRGB → WCAG luminance and the `color-mix(in oklch)` interpolation; assert ≥ 4.5:1 for hues 0–345 in steps of 15 in both themes
- [x] 2.2 If any hue fails, tune the mix tokens (not individual hues) until the test passes

## 3. Verification

- [x] 3.1 `bun run check` passes
- [x] 3.2 `bun run build:ui`, then check the real multi-repo board in dark and light: group names bold, panels visibly tinted but not loud, cards still stand out, Archived column (expanded) looks right, single-repo board unchanged
