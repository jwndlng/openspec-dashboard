# Proposal

## Why

The current product mark — a ring of four fading arcs on an indigo gradient tile — reads as a generic "loading" or
"sync" glyph and says little about OpenSpec. A new mark has been drawn (see `prompt.md`) that shows what the dashboard
is about: a change travelling through its artifacts, drawn as a drafting sheet with construction lines, a rounded
square and four stations on it — proposal, spec, delta and code — around a centre hub.

## What Changes

- Replace the product mark in the hero header with the new drawing: faint dashed construction lines overshooting a
  rounded square, a tick mark at each corner-radius centre, a centre hub, and four circular nodes on the square's
  edges — an arrow (proposal) at the top, a document (spec) on the right, a triangle (delta) at the bottom and a
  prompt glyph (code) on the left.
- The mark becomes a **line drawing on the page's own ground** instead of white shapes on an accent-gradient tile: its
  strokes use the theme's accent text colour and the nodes and hub are filled with the page background, so it works in
  the dark and the light theme. The drawing's literal `white` fills are replaced by theme tokens.
- The favicon is replaced by the same drawing. Because a favicon cannot read the page's tokens and is shown at 16–32px,
  it carries literal colours on a filled rounded square and leaves out the hair-thin construction lines and tick marks,
  which would only render as blur at that size.
- The hero keeps its layout and sizes (60px, 48px, 44px); only the drawing changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: the "The product has its own mark" requirement describes the new drawing, how it follows the theme,
  and that the favicon is the same drawing without the construction details.

## Impact

- `src/ui/logoMark.ts` — the mark's data rewritten for the new drawing on a 128×128 grid; `faviconSvg()` rewritten.
- `src/ui/logo.tsx` — `LogoMark` draws the new parts from `logoMark.ts`, in theme tokens; the gradient tile goes.
- `src/ui/styles.css` — the `.logo-mark` rule only (colour and glow); the other changes in flight that edit
  `styles.css` do not touch it.
- `scripts/build-ui.ts` — unchanged apart from what `faviconSvg()` returns; the favicon stays an inline data URI.
- `test/logoMark.test.ts` — new: the favicon is self-contained, and the hero mark and favicon share their parts.
- No server, API, git or network behaviour changes; the read-only and no-network invariants are untouched.
