## MODIFIED Requirements

### Requirement: The dashboard opens with a hero header
Every view SHALL open with a hero header. It SHALL show the product mark and the title `Spec Control` in large type, at least 32px and growing with the window up to 56px, with the one-line tagline `Mission control for every agent change across your repositories. Never miss a change.` under it. The status corner (Open work, scan errors, the theme control, the last-update age, Refresh and the auto-refresh control) SHALL sit in the hero's top-right corner, and the main navigation as large tabs, each with an icon beside its name, SHALL sit below the title. The auto-refresh control SHALL stand next to Refresh, at the same control size as the rest of the corner, and SHALL carry an accessible name saying it sets the auto-refresh interval. The current view's header band and filter bar SHALL continue on the hero's ground, a soft accent glow with a faint dot grid that fades out before the board, so that title, navigation, view header and filters read as one header; a line SHALL close the hero off from the board. The hero's decoration SHALL be drawn from theme tokens, be purely decorative, and SHALL NOT reduce the contrast of any text in it below the rules of the token set. On narrow windows the status corner SHALL move below the title and the title SHALL shrink, without horizontal scrolling.

#### Scenario: Hero on the combined board
- **WHEN** the combined board is opened in a 1920px wide window
- **THEN** the page shows the mark and `Spec Control` in type of at least 48px, the tagline `Mission control for every agent change across your repositories. Never miss a change.`, the status corner at the top right, the navigation tabs with icons, and then `All changes` with its counts, **New change** and the filter bar on the same glowing ground

#### Scenario: Every view has the hero
- **WHEN** the user moves to Settings or Activity
- **THEN** the same hero with its title and navigation is shown above the view

#### Scenario: Narrow window
- **WHEN** the window is 720px wide
- **THEN** the title is smaller but still the largest text on the page, the status corner sits below it, and nothing scrolls horizontally

#### Scenario: Auto-refresh sits with Refresh
- **WHEN** the status corner is shown
- **THEN** the auto-refresh control stands beside Refresh, shows the interval in force, and is reachable by keyboard with a name that says what it sets

#### Scenario: Auto-refresh on every view
- **WHEN** auto-refresh is `5s` and the user moves from the board to Activity
- **THEN** the control still shows `5s` and the dashboard keeps refreshing on that interval

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
- **THEN** it reads `Spec Control` and nothing for the mark
