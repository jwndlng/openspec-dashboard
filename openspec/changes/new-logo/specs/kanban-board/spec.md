# Spec Delta

## MODIFIED Requirements

### Requirement: The product has its own mark
The dashboard SHALL show its own product mark instead of a generic icon: a drafting drawing of a change travelling through its artifacts — a rounded square framed by faint dashed construction lines that overshoot it, a short tick at each corner-radius centre, a small hub in the middle, and four circular nodes centred on the square's four edges, each carrying a glyph: an arrow for the proposal at the top, a document for the spec on the right, a triangle for the delta at the bottom and a prompt for the code on the left. The mark in the page SHALL be a line drawing on the page's own ground, with its strokes in the theme's accent text colour and its nodes and hub filled with the page background, drawn from theme tokens only so that it stays legible in every supported theme, and SHALL be hidden from assistive technology, as the product name stands beside it. The page SHALL carry the same mark as its favicon, embedded in the page itself so no request is made for it. Because a favicon is shown at 16–32px and cannot follow the page's theme, it SHALL draw the mark on a filled rounded square in fixed colours and MAY leave out the construction lines and ticks; the square, the hub and the four nodes with their glyphs SHALL be the same as in the page.

#### Scenario: Favicon without a request
- **WHEN** the dashboard is opened offline
- **THEN** the browser tab shows the mark, and no request for an icon is made

#### Scenario: One mark
- **WHEN** the favicon and the mark in the hero are compared
- **THEN** they show the same square, hub and four nodes with the same glyphs in the same places

#### Scenario: Mark in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** the mark in the hero is redrawn in that theme's accent and background colours, and its nodes, glyphs and square stay clearly visible against the hero's ground

#### Scenario: Mark is decorative
- **WHEN** a screen reader reads the hero
- **THEN** it reads `OpenSpec Dashboard` and nothing for the mark
