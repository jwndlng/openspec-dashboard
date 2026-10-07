# Spec Delta

## MODIFIED Requirements

### Requirement: The dashboard opens with a hero header
Every view SHALL open with a hero header. It SHALL show the product mark and the title `Spec Control` in large type, at least 32px and growing with the window up to 56px, with the one-line tagline `Mission control for every agent change across your repositories. Never miss a change.` under it. The mark and the title SHALL together be one way home: a link to the Projects overview `/`, reachable by keyboard as a single stop with the accessible name `Spec Control`, that navigates without a page reload on a plain click and, like any link, opens a new tab on a modifier or middle click; in the demo it SHALL use the demo's hash route. The tagline SHALL NOT be part of the link, and the link SHALL NOT change how the title looks apart from a hover and focus indication. The status corner (Open work, scan errors, the theme control, the last-update age, Refresh and the auto-refresh control) SHALL sit in the hero's top-right corner, and the main navigation as large tabs, each with an icon beside its name, SHALL sit below the title. The auto-refresh control SHALL stand next to Refresh, at the same control size as the rest of the corner, and SHALL carry an accessible name saying it sets the auto-refresh interval. The current view's header band and filter bar SHALL continue on the hero's ground, a soft accent glow with a faint dot grid that fades out before the board, so that title, navigation, view header and filters read as one header; a line SHALL close the hero off from the board. The hero's decoration SHALL be drawn from theme tokens, be purely decorative, and SHALL NOT reduce the contrast of any text in it below the rules of the token set. On narrow windows the status corner SHALL move below the title and the title SHALL shrink, without horizontal scrolling.

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

#### Scenario: Mark and title lead home
- **WHEN** the user is on a repository board and clicks the title `Spec Control` or the mark beside it
- **THEN** the Projects overview is shown without a page reload

#### Scenario: Home in a new tab
- **WHEN** the user Ctrl- or Cmd-clicks the title
- **THEN** the Projects overview opens in a new browser tab and the current view stays as it was

#### Scenario: Home in the demo
- **WHEN** the demo is open on its Activity view and the user clicks the title
- **THEN** the demo shows its Projects overview through its hash route, without leaving the demo's page
