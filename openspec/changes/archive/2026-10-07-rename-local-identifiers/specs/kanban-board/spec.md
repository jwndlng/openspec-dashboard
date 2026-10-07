## ADDED Requirements

### Requirement: Preferences kept in the browser survive the rename
Every value the UI keeps in the browser's `localStorage` — the theme, whether the tour was seen, collapsed groups, the auto-refresh interval, the last seen What's new entry and the last seen activity — SHALL be stored under a key starting with `spec-control.`. Once per browser, before any of them is read, the UI SHALL copy every key under the former prefix `openspec-dashboard.` that holds a value to the key of the same name under `spec-control.`, unless that key already holds a value, and SHALL then record in `spec-control.migrated` that the copy was made. Once that record exists the UI SHALL NOT read any former key again, so that a preference changed or removed after the copy is never brought back by the former one. The copy SHALL NOT remove the former keys. When `localStorage` is unavailable or throws, the UI SHALL behave as it does without a stored value. The demo SHALL use the same keys.

#### Scenario: Theme carries over
- **WHEN** the browser holds `openspec-dashboard.theme` = `light` and no `spec-control.theme`, and the user opens the dashboard
- **THEN** the dashboard is shown in the light theme and `spec-control.theme` now holds `light`

#### Scenario: New value wins
- **WHEN** the browser holds `spec-control.autoRefresh` = `30s` and `openspec-dashboard.autoRefresh` = `5s`
- **THEN** auto-refresh is `30s`

#### Scenario: Removing a preference does not bring back the old one
- **WHEN** the theme was copied to `spec-control.theme` and the user then selects `system`, which removes that key, and reloads
- **THEN** the theme follows the system and is not taken from `openspec-dashboard.theme` again

#### Scenario: Tour not shown again after the upgrade
- **WHEN** the browser holds the former tour key marking the tour as seen
- **THEN** the tour does not start by itself after the upgrade
