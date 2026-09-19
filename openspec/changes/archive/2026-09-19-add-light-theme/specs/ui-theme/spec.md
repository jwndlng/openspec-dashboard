## ADDED Requirements

### Requirement: Light and dark themes are available
The dashboard UI SHALL provide two themes, `dark` and `light`. Exactly one theme SHALL be active at a time and SHALL apply to every view (board and settings), including native form controls and scrollbars.

#### Scenario: Light theme active
- **WHEN** the active theme is `light`
- **THEN** the page, top bar, columns, cards, filters and settings panels render with the light token set and native checkboxes and scrollbars use the light colour scheme

#### Scenario: Dark theme unchanged
- **WHEN** the active theme is `dark`
- **THEN** the UI renders with the same colours as before this change

### Requirement: Theme follows the system preference by default
When the user has not chosen a theme explicitly, the theme preference SHALL be `system`, and the active theme SHALL be `light` if the operating system reports `prefers-color-scheme: light` and `dark` otherwise. While the preference is `system`, the active theme SHALL update without a page reload when the operating system preference changes.

#### Scenario: First visit on a light OS
- **WHEN** a user with no stored theme preference opens the dashboard on an operating system set to light appearance
- **THEN** the light theme is active

#### Scenario: First visit on a dark OS
- **WHEN** a user with no stored theme preference opens the dashboard on an operating system set to dark appearance
- **THEN** the dark theme is active

#### Scenario: OS appearance changes while open
- **WHEN** the preference is `system` and the operating system switches from dark to light appearance
- **THEN** the dashboard switches to the light theme without a reload

### Requirement: User can override the theme
The top bar SHALL contain a theme control, visible on every route, that cycles the preference `system` → `light` → `dark` → `system`. The control SHALL show the current preference as text (e.g. `Theme: Light`) and MUST NOT rely on an icon or colour alone. Changing the preference SHALL take effect immediately without a page reload and MUST NOT trigger a rescan or any server request.

#### Scenario: Switch to light on a dark OS
- **WHEN** the preference is `system` on a dark operating system and the user activates the theme control once
- **THEN** the control reads `Theme: Light` and the light theme is active

#### Scenario: Explicit choice ignores OS changes
- **WHEN** the preference is `dark` and the operating system switches to light appearance
- **THEN** the dark theme stays active

#### Scenario: Return to system
- **WHEN** the preference is `dark` and the user activates the theme control once
- **THEN** the control reads `Theme: System` and the active theme matches the operating system preference

### Requirement: Theme preference persists in the browser
An explicit `light` or `dark` preference SHALL be stored in the browser's `localStorage` and restored on the next load. Selecting `system` SHALL remove the stored value. An unrecognised stored value SHALL be treated as `system`. If `localStorage` is unavailable, the dashboard SHALL behave as `system` and the theme control SHALL still work for the current page session. The preference MUST NOT be written to the server configuration or the URL.

#### Scenario: Preference survives reload
- **WHEN** the user selects `Light` and reloads the page on a dark operating system
- **THEN** the light theme is active and the control reads `Theme: Light`

#### Scenario: Corrupt stored value
- **WHEN** the stored theme value is `"purple"`
- **THEN** the preference is treated as `system`

#### Scenario: Storage unavailable
- **WHEN** `localStorage` access throws
- **THEN** the dashboard loads with the system theme and no error is shown

### Requirement: Theme is applied before first paint
The active theme SHALL be resolved and applied before the page's first paint, so that the UI never renders a frame in the other theme during load.

#### Scenario: No dark flash for a light-theme user
- **WHEN** a user with stored preference `light` loads the dashboard
- **THEN** the first painted frame already uses the light background
