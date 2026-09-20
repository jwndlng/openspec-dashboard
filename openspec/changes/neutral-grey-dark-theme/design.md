## Context

The dark theme is the default `:root` token block in `src/ui/styles.css`. Its backgrounds sit at OKLCH hue ≈ 263 with chroma 0.02–0.06, which reads as navy; body text carries the same hue and the borders are translucent teal (`#71c7c5` with alpha). Components reference tokens only, so the whole look is controlled by about 13 values. `test/repoContrast.test.ts` reads the token values from the stylesheet and guards the 4.5:1 rule for repository-coloured text on the tinted group panel.

## Goals / Non-Goals

**Goals:**
- A near-neutral grey dark ground, with the same five-step elevation hierarchy.
- Neutral text and border tokens; teal appears only as an accent.
- Text tokens used for readable text reach 4.5:1 on the backgrounds they are rendered on.

**Non-Goals:**
- Any selector, layout, typography, radius or spacing change.
- Any change to the light theme, the brand tokens or the status tokens.
- New tests or test helpers; verification is a contrast script plus the existing suite.

## Decisions

**Keep OKLCH lightness, drop chroma.** Each background token keeps the lightness of the value it replaces and gets chroma 0.006 at hue 255. The elevation steps therefore keep their relative spacing, and every existing contrast relationship is preserved by construction. Picking a new ramp by eye was rejected because it would silently shift the hierarchy.

| Token | Old | New |
| --- | --- | --- |
| `--bg-base` | `#080d16` | `#0b0d10` |
| `--bg-section` | `#0e1524` | `#141618` |
| `--bg-raised` | `#111c30` | `#1a1c1f` |
| `--bg-surface` | `#1a2640` | `#25272a` |
| `--bg-elevated` | `#243350` | `#313437` |
| `--fg-heading` | `#f0f5fa` | `#f3f5f7` |
| `--fg-body` | `#8a9bb5` | `#a0a3a8` |
| `--fg-subtle` | `#6a7a94` | `#82858a` |
| `--fg-disabled` | `#3a4a64` | `#474a4e` |
| `--border` | `#71c7c52e` | `#b2b6bb2e` |
| `--border-light` | `#71c7c514` | `#b2b6bb14` |
| `--border-subtle` | `#1a2640` | `#25272a` |
| `--border-strong` | `#71c7c56b` | `#b2b6bb6b` |

**Near-neutral, not pure neutral.** Chroma 0.006–0.008 at a cool hue. Equal-channel greys look flat and slightly warm beside the teal brand. This is the choice the proposal recommended.

**Subtle text gets lighter, body follows.** The old `--fg-subtle` only reached 3.9:1 on cards (`--bg-raised`), below the spec's 4.5:1 rule. The new value is the darkest near-neutral grey that reaches 4.6:1 on `--bg-raised`, the lightest background that subtle text is rendered on. `--fg-body` moves up slightly (OKLCH L 0.685 → 0.715) so the body/subtle step stays visible.

**Disabled text keeps its lightness.** `--fg-disabled` stays at about 2:1, as today. It marks inactive controls and placeholders, which WCAG exempts from the contrast minimum; raising it to 4.5:1 would make it indistinguishable from subtle text.

**Borders keep teal's lightness and alpha.** The border grey `#b2b6bb` has the same OKLCH lightness as `#71c7c5`, and the three alpha values are unchanged, so outlines keep their visual weight and only lose the hue.

**Repository colour tokens stay.** Backgrounds keep their lightness, so `--repo-l`, `--repo-c`, `--repo-soft-l` and the group mixes behave as before. `test/repoContrast.test.ts` re-checks all 24 hues against the new `--bg-section`.

## Risks / Trade-offs

- [Body and subtle text are closer together than before] → Body was raised to keep a visible step; check the overview table and card meta lines visually.
- [Other in-flight changes edit `src/ui/styles.css`] → This change touches only values inside the dark `:root` block; no selector lines move.
- [Hardcoded base colour outside the stylesheet] → Searched `scripts/`, `src/` and `README.md`; none exists, so the pre-paint frame already follows the token.
