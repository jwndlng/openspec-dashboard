## Context

`RepoGroups` in `src/ui/kanban.tsx` renders, per column, one `<section class="repo-group repo-tint" style="--repo-hue: N">` per repository containing a `.repo-group-head` (swatch, name, count) and the cards. `.repo-tint` already exposes `--repo-color` and `--repo-soft`, both built with `oklch()` from theme tokens (`--repo-l`, `--repo-c`, `--repo-soft-l`) and the per-repo hue. Columns use `--bg-section`, cards `--bg-raised`. The stylesheet's rule is: components use tokens, never literal colours; the light theme overrides colour tokens only.

## Goals / Non-Goals

**Goals:**
- Group boundaries are obvious at a glance in both themes, with 17+ repositories on the board.
- Pure CSS change, token-driven, no new assets.

**Non-Goals:**
- Collapsible groups, sticky group headers, per-group actions.
- Changing the repository hue assignment or the card design.
- Styling the single-repository (flat) board or the project overview.

## Decisions

### D1: Tint via `color-mix()` into the column background
`.repo-group { background: color-mix(in oklch, var(--repo-color) var(--repo-group-mix), var(--bg-section)); }` with `--repo-group-mix` defined per theme (start: `10%` dark, `7%` light) and a border using `--repo-group-border-mix` (start: `28%` dark, `30%` light).

*Why:* the panel automatically follows both the theme's column background and the repository colour, needs one number per theme to tune, and cannot drift from the hue used for the header, accent and chip. *Alternatives:* reuse `--repo-soft` — rejected, it is tuned as the "selected chip" fill and is far too strong as a large surface (dark L 0.30 vs. cards at ≈0.23 would invert the card/panel hierarchy). A neutral `--bg-raised` panel — rejected, cards use that very token and would disappear into it; it also ignores the "slightly different colouring" ask. `color-mix()` is supported by every current evergreen browser, which is all this local tool targets.

### D2: Cards stay on `--bg-raised`
No card CSS changes. Measured OKLCH lightness with the shipped mix values: dark — column 0.197, panel 0.255, card 0.227; light — column 0.957, panel 0.923, card 1.000. So in light the cards are raised (white on a faintly tinted panel) and in dark they read as slightly inset (darker than the panel). Both keep cards clearly distinguishable, helped by the card border and 3px repo accent. Getting the dark panel *below* the card lightness would need a mix ≤ 5%, which is too faint to register as a group background — the inset look is the accepted trade-off.

### D3: Header typography
Name: `font-weight: 700`, same 11px uppercase tracking and repository colour. Count stays mono/subtle. The header moves inside the panel padding (panel `padding: 6px`, header `padding: 0 2px`), so the swatch, name and count align with the card edges.

### D4: Spacing
`.cards` gap stays 6px between cards; `.repo-group + .repo-group` margin grows from 4px to 8px (14px total between panels vs. 6px between cards). Panel padding costs 12px of card width in a 272px column; acceptable, card content already wraps.

### D5: Contrast is tested, not eyeballed
New `test/repoContrast.test.ts` reads `--repo-l`, `--repo-c`, `--repo-group-mix` and `--bg-section` for both themes out of `styles.css`, converts OKLCH → linear sRGB → WCAG relative luminance (≈30 lines, no dependency), reproduces the `color-mix(in oklch)` interpolation, and asserts ≥ 4.5:1 for all 24 hues (multiples of 15°). If a hue fails, tune the mix token (or `--repo-l`) rather than special-casing hues.

## Risks / Trade-offs

- [Tint too loud with many groups, "rainbow" columns] → Mix strength is a single token per theme; start low (7–10%) and verify on the real 17-repo board in both themes.
- [Dark theme: panel is lighter than the cards (inset look) instead of cards being raised] → Verified on screenshots that cards stay distinct via border and accent; see D2 for the numbers.
- [Light theme contrast headroom is thin: worst hue 4.65:1 at 7% mix (dark: 7.5:1 at 10%)] → `test/repoContrast.test.ts` fails if the light mix is raised too far.
- [Test re-implements colour math and could diverge from browsers] → It only guards a threshold with margin; hue interpolation is irrelevant because only lightness/chroma differ meaningfully at these mix ratios, and the test uses the same shorter-arc rule as CSS.
- [Concurrent edits to `styles.css` by other sessions] → Touch only `.repo-group*` rules and the repo token lines.
