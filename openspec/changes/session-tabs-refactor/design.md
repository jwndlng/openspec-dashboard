# Design

## Context

The strip is `.dock-bar` (36px, `--bg-base`, bottom border `--border-light`) holding `.session-tabs`, which holds one
`<button class="session-tab">` per tab. Today:

- not shown: `background: transparent`, `border: 1px solid transparent` — no surface at all. With a repository colour
  the only visible edge is `box-shadow: inset 3px 0 0 var(--repo-color)`, the "weird border" in the prompt.
- shown (`.shown`): `--bg-section` background and a `--border-light` outline, flat bottom, so it merges into the panes.
- focused (`.active`): `border-top-color: var(--brand)` — a 1px change.

`DOCK_TABS_HEIGHT` (`src/ui/sessionState.ts`) is the height the page reserves for a collapsed dock and must equal the
strip's CSS height. `test/repoContrast.test.ts` proves repository-coloured text keeps 4.5:1 on `--bg-base` and
`--bg-section`, the two tab grounds the kanban-board spec names.

## Goals / Non-Goals

**Goals:** a surface for every tab; shape-level difference between shown and not shown; a focused marking that matches
the focused pane's 2px brand top bar; a taller strip. Both themes, tokens only.

**Non-Goals:** changing the tab markup's semantics (roles, `aria-selected`, keyboard), closing tabs from the strip,
reordering tabs, new colour tokens.

## Decisions

1. **Tab grounds stay `--bg-section` for every tab; the difference is shape and outline, not a new colour.** A not-shown
   tab gets `--bg-section` with a `--border` outline on all four sides, rounded on all corners, and sits inset from
   the strip's bottom edge (a 3px bottom margin) — a chip on the strip. A shown tab keeps rounded top corners only,
   reaches the strip's bottom edge (the chip's margin becomes padding, so both tops line up) and has a transparent
   bottom border showing its own ground, so it is joined to the panes like a classic tab. The strip's bottom line is
   an inset shadow (`inset 0 -1px 0 var(--border-light)`) rather than a border, so the shown tab covers it: a
   `margin-bottom: -1px` cannot reach into a real border, because `.session-tabs` scrolls horizontally and clips
   anything outside its box. *Alternative:* `--bg-raised` or a mixed colour for not-shown tabs —
   rejected: in the dark theme `--bg-raised` is lighter than `--bg-section`, so idle tabs would look more prominent
   than shown ones, and any new ground would have to be added to the contrast test. Staying on `--bg-section` keeps the
   existing contrast proof valid unchanged.
2. **Not-shown tabs are quieter by text, not by background.** Their change name uses `--fg-body` and the mark
   `--fg-subtle` as today; shown tabs use `--fg-heading`. Hover brightens the outline to `--border-strong`.
3. **Focused tab: a 2px brand bar on top plus heading-weight text.** Implemented as a second inset shadow
   (`inset 0 2px 0 var(--brand)`), combined with the repository accent (`inset 3px 0 0 var(--repo-color)`) in one
   `box-shadow` list so neither overrides the other and geometry does not shift. The change name becomes semibold, so
   the marking is not colour alone. `--brand` is already kept ≥12° away from every repository hue (existing test).
   *Alternative:* a thicker `border-top` — rejected because it changes the tab's height relative to its neighbours.
4. **Strip height 36px → 44px**, tab vertical padding 5px → 7px. With the 20px badge a tab is 36px tall, so the strip
   splits the rest as 5px top padding (air above a shown tab's top edge, was 6px) and the chip's 3px inset:
   5 + 36 + 3 = 44. The repository name does not wrap, so a tab stays on one line at its maximum width; the change
   name truncates as before. `DOCK_TABS_HEIGHT` becomes 44 in the same commit, and a small test reads the `.dock-bar` height from
   `styles.css` and asserts it equals the constant, so the two cannot silently drift. *Alternative:* have the dock set
   the strip height as a CSS variable from the constant — rejected as more moving parts for one number.
5. **Markup stays as is.** `.shown` and `.active` already exist; the focused combination with a repository tint is a
   CSS selector (`.session-tab.repo-tint.active`). No TSX change is expected.

## Risks / Trade-offs

- [Taller strip takes 8px from the board when collapsed] → acceptable; the prompt asks for it and `DOCK_MIN_BOARD` is
  unaffected.
- [Combining two inset shadows needs a separate rule for tinted + focused, else one wins] → explicit
  `.repo-tint.active` rule; checked visually in both themes and in the demo.
- [Chip-shaped idle tabs next to attached shown tabs could look uneven] → both use the same top radius and height
  above the inset; verified with 1, 3 and 5 tabs, collapsed and open, dark and light.
