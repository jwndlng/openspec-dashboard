# Spec Delta

## MODIFIED Requirements

### Requirement: The app makes no network request of its own
The app's own process MUST NOT contact any network: it requests only the loopback server it started or attached to. The server's network access stays exactly as the dashboard-api capability defines it, which includes the server's update check of the `update-notice` capability; the app MUST NOT pass the server any option that changes whether it checks. A newer version SHALL be noticed through that check's banner, which the app's window shows because it shows the server's page. The app SHALL offer a **Releases Page** item in its application menu and its menu bar item that opens this project's GitHub releases page in the default browser, which is how the user finds and installs a newer version.

#### Scenario: Idle app
- **WHEN** the app runs for a day with the update check turned off and nobody using the pull action or a pull-request or issue query
- **THEN** no process of the app or its server has made a request to any host other than `127.0.0.1`

#### Scenario: Idle app with the update check on
- **WHEN** the app runs for a day with the update check on and nobody using the pull action or a pull-request or issue query
- **THEN** the only request to a host other than `127.0.0.1` is the server's update check, and the app's own process has made none

#### Scenario: Looking for a new version
- **WHEN** the user chooses Releases Page
- **THEN** the releases page opens in the default browser and the app makes no request itself

#### Scenario: New version in the app window
- **WHEN** the server the app shows has learned of a newer release
- **THEN** the app window shows the update banner, and its links open in the default browser
