# Design

## Context

The mark is kept as data in `src/ui/logoMark.ts` so that the hero mark (`src/ui/logo.tsx`, `<LogoMark size={60}>` in
`app.tsx`, shrunk to 48px and 44px by `styles.css`) and the favicon (`faviconSvg()`, inlined as a data URI by
`scripts/build-ui.ts`) never drift apart. The hero mark is white-on-tile: `color: var(--on-brand)` over an
accent-gradient `<rect>`. The favicon repeats that with the dark theme's accent values written out, because it cannot
read CSS tokens.

The new drawing (`prompt.md`) sits on a 128×128 grid, strokes in `currentColor`, and uses literal `fill="white"` for
the four nodes and the hub, so that they mask the square's outline behind them. The kanban-board token rules forbid
literal colours in component styles, and a white fill would glare in the dark theme.

## Goals / Non-Goals

**Goals:**
- One source of truth for the drawing, shared by the hero mark and the favicon, as today.
- The hero mark follows the theme through tokens; no literal colour in `logo.tsx` or `styles.css`.
- A favicon that is recognisable at 16px and 32px on light and dark browser chrome.

**Non-Goals:**
- Changing the hero's layout, the mark's sizes or the product name and tagline.
- A logo file for the README, a PNG/ICO favicon or an app icon; the repository ships none today.
- Animating the mark.

## Decisions

**1. The drawing as a list of parts, each tagged with its paint roles.** `logoMark.ts` exports the viewBox
(`0 0 128 128`) and an ordered list of parts — construction lines, square, ticks, hub, four nodes (a circle plus its
glyph, positioned by a translate) — each giving its SVG element, its geometry, its stroke width and opacity, and a fill
role: `none`, `ink` (the stroke colour) or `ground` (the background colour). Construction lines and ticks are marked as
`detail`. `logo.tsx` maps the list to JSX with `stroke="currentColor"` and `ground` → `var(--bg-base)`;
`faviconSvg()` serialises the same list with literal colours, skipping `detail` parts. *Alternative:* keep the SVG as
one string and inject it with `dangerouslySetInnerHTML` — rejected: the white fills would have to be patched by string
replacement, and the favicon could not drop the details without a second copy of the drawing.

**2. The hero mark is a line drawing on the page's ground, not on a tile.** The drawing's own rounded square already
is the "tile"; putting it on the old gradient tile would double the frame. `.logo-mark` sets `color: var(--brand-fg)`
— the accent's text colour, already held to 4.5:1 against the backgrounds in both themes — and keeps a softer accent
drop-shadow glow. The `ground` fill is `var(--bg-base)`, the page background the hero glow is painted over; the small
difference to the glow under a node is not visible at 44–60px. *Alternative:* `--on-brand` on the old tile — rejected,
see above; `--fg-heading` strokes — rejected: the mark would lose its accent and sit apart from the indigo title word.

**3. The favicon draws the essentials on a filled square, with heavier strokes.** At 16px one grid unit is 0.125px:
the 1px construction lines and 1.6px ticks vanish into blur, and the 2–2.6px outlines become a third of a pixel. The
favicon therefore fills the rounded square with the dark theme's `--bg-base` (`#26272b`), strokes in its `--brand-fg`
(`#a5b4fc`), fills the nodes and hub with the same background, leaves out the `detail` parts, crops the viewBox to the
nodes' extent (`6 6 116 116`) and multiplies every stroke width by one factor (starting at 1.75, settled by looking at
the result at 16px and 32px). The dark fill keeps it legible on both light and dark tab strips. A comment in
`logoMark.ts` names the tokens these literals mirror, as today. *Alternative:* a favicon that switches colours with an
inner `@media (prefers-color-scheme)` — rejected: support in tab strips is uneven, and a filled square already works
on both.

**4. Proof by a unit test, not a snapshot.** `test/logoMark.test.ts` checks that `faviconSvg()` is a standalone SVG
with no `href`/`url(` to anything but its own ids and no `detail` part, that it contains the square, hub and four node
glyphs of the shared list, and that the parts list has exactly four nodes. The visual check is a task, not a test.

## Risks / Trade-offs

- [Thin strokes at 44px on a narrow window: the 2.4px outline is under 1px] → accepted for the hero, where it reads
  as a fine drafting line; revisit the stroke widths during the visual check if nodes smear.
- [The favicon is no longer pixel-for-pixel the hero mark] → the spec now says what must match (square, hub, nodes,
  glyphs) and what may be left out; the shared parts list enforces it.
- [`--bg-base` fill differs slightly from the glowing hero ground behind a node] → negligible at these sizes; if it
  shows, switch the `ground` role to a transparent-knockout mask instead.
