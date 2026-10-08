# Design

## Context

`src/ui/styles.css` sets `.row-actions { text-align: right; … }` (around line 675). A few lines later,
`.projects th, .projects td { … text-align: left; … }` sets every cell of the projects table, and its specificity
(one class plus one element) beats the single class of `.row-actions`. So the actions cell is left-aligned, and its
inline children (Console, Pull, the fetch note, the gear) start at the cell's left edge. The gear's horizontal
position therefore depends on which of the earlier actions a row renders. The demo shows it on `orbit-data`, whose
failed scan hides Pull.

The tile footer is a flex row and the gear has `margin-left: auto` (`.tile-foot .settings-btn`). It already sits at
the right edge.

## Goals / Non-Goals

**Goals:**
- The actions cell of the projects table, header and body, is right-aligned again, so the gear is flush right in every
  row.

**Non-Goals:**
- Reworking the actions cell into a grid with fixed slots, so that Console and Pull also line up across rows. With
  right alignment, everything left of the gear shifts by row. That is acceptable: the request is about the gear.
- The table being wider than a 1440 px window in the demo, which pushes the actions off-screen. That is a separate
  layout question and belongs in its own change.
- Any change to the tile footer, the board header or the settings dialog.

## Decisions

- **Raise the selector's specificity, not the cascade order or `!important`.** Use `.projects .row-actions` for the
  right alignment, so it beats `.projects td` on specificity no matter where either rule sits. Moving the rule below
  line 681 would also work, but it would break again silently if the rules were reordered. `!important` is not used
  anywhere else for layout here.
- **Keep the gear's separator and spacing as they are** (`.row-actions .settings-btn` with its `::before` rule). They
  stay correct once the cell is right-aligned.
- **Guard it with a style test** in `test/overviewStyles.test.ts`, in the same way that file already guards the
  table's other layout rules. Layout cannot be measured without a browser. The test therefore asserts that a rule
  scoped under `.projects` right-aligns `.row-actions`.

## Risks / Trade-offs

- [The `row-error` span and the fetch note now grow leftwards from the gear rather than rightwards from the cell's
  start] → That is the intended reading order for a right-aligned action cell. `row-error` keeps its `max-width`, so it
  cannot push the gear.
