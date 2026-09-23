## REMOVED Requirements

### Requirement: Light and dark themes are available
**Reason**: Its scenarios "Dark theme is a soft dark grey, not near-black" and "Dark theme stays readable after the lift" describe the grey ground this change replaces with a medium-dark neutral grey and new token values.
**Migration**: See "Light and dark themes are available on a grey ground" below; the two themes, their scope, the ascending surfaces, the contrast rule and the accent-lighter-than-ground rule are unchanged.

## ADDED Requirements

### Requirement: Light and dark themes are available on a grey ground
The dashboard UI SHALL provide two themes, `dark` and `light`. Exactly one theme SHALL be active at a time and SHALL apply to every view (board and settings), including native form controls and scrollbars.

#### Scenario: Light theme active
- **WHEN** the active theme is `light`
- **THEN** the page, top bar, columns, cards, filters and settings panels render with the light token set and native checkboxes and scrollbars use the light colour scheme

#### Scenario: Dark theme unchanged
- **WHEN** the active theme is `dark`
- **THEN** the page, top bar, columns, cards, filters and settings panels render with the dark token set and native checkboxes and scrollbars use the dark colour scheme

#### Scenario: Dark theme is a neutral grey, not near-black
- **WHEN** the active theme is `dark`
- **THEN** the page background is a neutral dark grey lighter than `#1a1b1e`, and the five background tokens ascend from page to elevated surface with each step visibly lighter than the one below it, so borders and the edges between surfaces stay visible

#### Scenario: Dark theme stays readable on the grey ground
- **WHEN** the active theme is `dark`
- **THEN** heading, body and subtle text and every status colour used as text have a contrast ratio of at least 4.5:1 against the background they are rendered on

#### Scenario: Accent backgrounds stay lighter than the ground
- **WHEN** the active theme is `dark` and a brand-tinted chip, badge or primary button is rendered on a column or card
- **THEN** its background is lighter than the background behind it, so the tint never reads as a hole in the surface
