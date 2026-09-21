# Design

## Context

`sessionBadge()` in `src/ui/sessionState.ts` returns `{ label: "● running", tone, title }`; the dot is part of the label string, and three places render it (`SessionControls`, the panel header, indirectly the Open work list via `WorkBadge`, which is a different badge and stays as is). `styles.css` has no animation yet.

## Goals / Non-Goals

**Goals:** motion that means "an agent is working now"; zero cost when nothing runs; accessible.
**Non-Goals:** animating columns, cards, progress meters or the `quiet` state; any JS-driven animation.

## Decisions

### D1 — Split dot and text, add a `live` flag
`SessionBadge` becomes `{ icon, label, tone, title, live }`: `icon` is the leading glyph (`●`, `◆`, `⚠`, or none), `label` the words. `live` is true only for running-and-not-quiet. A small `SessionBadgeView` component renders `<span class="dot" aria-hidden="true">` plus `<span class="text">` and adds the class `live`; both call sites use it, so the markup cannot drift. *Alternative:* animate the whole string with one gradient — cannot pulse the dot separately.

### D2 — CSS only
- Dot: `@keyframes session-pulse` on `opacity` and `transform: scale()` (compositor-only, no layout).
- Text: the label is painted with a `linear-gradient` of `--brand-fg → --fg-heading → --brand-fg`, `background-size: 200%`, `background-clip: text`, and `@keyframes session-sweep` moves `background-position`. `--fg-heading` is the strongest text token in both themes, so contrast only ever goes up. A slow sweep rather than a hard blink: several cards can run at once, and blinking text is tiring and an accessibility problem (WCAG 2.3.1 / 2.2.2).
- Everything sits inside `@media (prefers-reduced-motion: no-preference)`, so reduced motion needs no override and gets today's badge. Where `background-clip: text` is unsupported, `@supports` keeps the plain colour.

### D3 — Quiet stays still
Quiet means "probably waiting for you". Keeping it static makes the contrast between working and waiting visible across the board.

## Risks / Trade-offs

- Many running cards → many animations: opacity/transform/background-position on tiny elements; negligible.
- I cannot see the result rendered; timing and intensity are a judgement call the user should confirm in both themes. Values are two custom properties (`--session-pulse`, `--session-sweep`) for easy tuning.
