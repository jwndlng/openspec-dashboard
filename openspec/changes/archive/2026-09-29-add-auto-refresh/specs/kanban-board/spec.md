# Spec Delta

## MODIFIED Requirements

### Requirement: Board refreshes from the snapshot
The board SHALL fetch `GET /api/state` on load, re-fetch on the poll interval, and provide a Refresh button that calls `POST /api/scan` and re-fetches when complete. The header SHALL show the snapshot's `generatedAt` and per-repo error indicators for repos with `ok: false`.

Beside the Refresh button the dashboard SHALL offer an auto-refresh control with exactly the choices `Off`, `2s`, `5s` and `10s`. While an interval is chosen, the dashboard SHALL repeat on that interval what the Refresh button does — trigger a scan and take the resulting snapshot — so that the data shown is re-read from the repositories and not merely the same snapshot fetched again. `Off` SHALL be the initial choice for a user who has never chosen one, and the control SHALL name the interval in force, so the user can always see whether the dashboard is refreshing itself.

The choice SHALL be remembered for the browser it was made in and SHALL survive a reload; it SHALL NOT be written to the dashboard's configuration, SHALL NOT change `pollIntervalSeconds`, and SHALL NOT be shared with another browser or machine. When the choice cannot be stored, it SHALL still apply for the current page session.

An automatic refresh SHALL NOT overlap another refresh: while a refresh is in flight, whether the user started it or the interval did, the due tick SHALL be dropped rather than queued, and the next tick SHALL be timed from the refresh that finished, so that an interval shorter than a scan cannot make scans pile up. While the page is hidden no tick SHALL run; the interval SHALL resume when the page becomes visible again. A failed automatic refresh SHALL be reported like a failed manual one and MUST NOT stop the interval. Auto-refresh SHALL drive nothing but the scan and the re-fetch: it MUST NOT trigger the pull action, which stays bound to the user's explicit request.

#### Scenario: Manual refresh
- **WHEN** the user clicks Refresh
- **THEN** a scan is triggered and the board updates with the new snapshot without a page reload

#### Scenario: Repo in error
- **WHEN** a tracked repo failed to scan
- **THEN** a warning indicator with the error message is visible in the header

#### Scenario: Auto-refresh is off until chosen
- **WHEN** the dashboard is opened by a user who has never used the auto-refresh control
- **THEN** the control shows `Off`, no scan is triggered by a timer, and the board still re-fetches the snapshot on the poll interval as before

#### Scenario: Choosing an interval
- **WHEN** the user chooses `5s`
- **THEN** about every five seconds a scan is triggered and the board and the `updated` age follow the new snapshot, without the user clicking anything

#### Scenario: The choice is remembered for this browser
- **WHEN** the user chooses `2s` and reloads the page
- **THEN** auto-refresh is still `2s`, and the dashboard's configured poll interval is unchanged

#### Scenario: Another browser is unaffected
- **WHEN** the user has chosen `2s` in one browser and opens the dashboard in a different browser
- **THEN** auto-refresh there is `Off`

#### Scenario: Turning it off
- **WHEN** auto-refresh is `10s` and the user chooses `Off`
- **THEN** no further scan is triggered by the timer, and Refresh still works

#### Scenario: A scan slower than the interval
- **WHEN** auto-refresh is `2s` and a scan takes six seconds
- **THEN** no second scan is started while the first is running, and the next one is timed from the first one finishing

#### Scenario: Refreshing by hand while auto-refresh runs
- **WHEN** the user clicks Refresh while an automatic refresh is in flight
- **THEN** no second concurrent scan is started, and the board still ends up on the newest snapshot

#### Scenario: Hidden tab
- **WHEN** auto-refresh is `2s` and the user switches to another tab for ten minutes
- **THEN** no scan is triggered while the page is hidden, and one refresh happens when the user comes back

#### Scenario: A failing scan does not stop the interval
- **WHEN** an automatic refresh fails
- **THEN** the error is shown in the header the same way a failed manual refresh is, and the next tick is still attempted

#### Scenario: Auto-refresh never pulls
- **WHEN** auto-refresh has been running at `2s` for an hour
- **THEN** no repository has been fetched from or merged, because only a scan was triggered

### Requirement: The dashboard opens with a hero header
Every view SHALL open with a hero header. It SHALL show the product mark and the title `OpenSpec Dashboard` in large type, at least 32px and growing with the window up to 56px, with a one-line tagline under it. The status corner (Open work, scan errors, the theme control, the last-update age, Refresh and the auto-refresh control) SHALL sit in the hero's top-right corner, and the main navigation as large tabs, each with an icon beside its name, SHALL sit below the title. The auto-refresh control SHALL stand next to Refresh, at the same control size as the rest of the corner, and SHALL carry an accessible name saying it sets the auto-refresh interval. The current view's header band and filter bar SHALL continue on the hero's ground, a soft accent glow with a faint dot grid that fades out before the board, so that title, navigation, view header and filters read as one header; a line SHALL close the hero off from the board. The hero's decoration SHALL be drawn from theme tokens, be purely decorative, and SHALL NOT reduce the contrast of any text in it below the rules of the token set. On narrow windows the status corner SHALL move below the title and the title SHALL shrink, without horizontal scrolling.

#### Scenario: Hero on the combined board
- **WHEN** the combined board is opened in a 1920px wide window
- **THEN** the page shows the mark and `OpenSpec Dashboard` in type of at least 48px, the tagline, the status corner at the top right, the navigation tabs with icons, and then `All changes` with its counts, **New change** and the filter bar on the same glowing ground

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
