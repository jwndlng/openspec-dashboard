## MODIFIED Requirements

### Requirement: Visual design follows the dashboard token set
The UI SHALL define its colours as two token sets sharing the same token names: the dark set defined in design.md (neutral grey backgrounds `#0b0d10`…`#313437`, teal brand `#71c7c5`) and a light set (backgrounds `#f6f8fb`…`#d3dbe6`, teal brand `#1f8a88`). The dark theme's background, text and border tokens SHALL be near-neutral greys with at most a slight cool tint; in the dark theme teal SHALL be used only as an accent (focus, active state, primary actions, progress) and MUST NOT be the colour of panel or card borders. Both themes SHALL share Space Grotesk for text, JetBrains Mono for identifiers and a 4px radius, with fonts bundled locally. Component styles MUST reference colour tokens only and MUST NOT contain literal colour values. In both themes, text and status colours SHALL have a contrast ratio of at least 4.5:1 against the backgrounds they are rendered on. The UI MUST render correctly without network access.

#### Scenario: Offline rendering
- **WHEN** the dashboard is opened with no network connectivity
- **THEN** fonts and styles render as designed in the active theme with no external requests

#### Scenario: Same layout in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** only colours change; layout, spacing, typography and radius are identical

#### Scenario: Status badges readable in light theme
- **WHEN** the light theme is active and a card shows success, warning and danger badges
- **THEN** each badge's text has a contrast ratio of at least 4.5:1 against the card background and is still accompanied by a text label

#### Scenario: Dark ground is neutral grey
- **WHEN** the dark theme is active
- **THEN** the page, column, card and panel backgrounds are near-neutral greys whose red, green and blue channels differ by no more than 6 of 255, and panel and card borders are grey rather than teal

#### Scenario: Subtle text readable on dark cards
- **WHEN** the dark theme is active and a card shows heading, body and subtle text
- **THEN** each has a contrast ratio of at least 4.5:1 against the card background
