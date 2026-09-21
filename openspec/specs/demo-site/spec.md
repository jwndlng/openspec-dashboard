# demo-site Specification

## Purpose
Defines the public demo of the dashboard: a build of the real UI on an in-memory mock API with synthetic sample data, the guarantees that no data from anyone's machine can appear in it, server-less navigation, screenshot generation from the demo build only, and publishing to GitHub Pages with the README entry points.
## Requirements
### Requirement: The demo is the real UI on a mock API
The project SHALL provide a demo build, produced by `bun run build:demo`, that renders the same UI components, styles and views as the normal build but obtains all data from an in-memory mock API instead of HTTP. The output SHALL be a single self-contained `dist/demo/index.html` that makes no network requests and works when served from a site root, from a sub-path, and when opened directly from disk. The normal UI bundle and the compiled binary MUST NOT contain the demo code or its sample data.

#### Scenario: Opened from disk
- **WHEN** `dist/demo/index.html` is opened via `file://` with no network connectivity
- **THEN** the Projects overview renders with the sample repositories, fonts and styles, and no request leaves the page

#### Scenario: Served from a sub-path
- **WHEN** the demo is served at `https://example.org/openspec-dashboard/`
- **THEN** every view is reachable and no navigation leaves that sub-path

#### Scenario: Production bundle is free of demo data
- **WHEN** `bun run build:ui` has run
- **THEN** `dist/ui/index.html` contains neither the demo marker nor any sample repository name

### Requirement: Demo data is synthetic and never read from a machine
All data shown by the demo SHALL come from a sample dataset checked into the repository. The demo build and the demo at runtime MUST NOT read the dashboard's config, its snapshot cache, the file system or any HTTP API. Every repository path in the sample SHALL be under the fictional prefix `/home/demo/`. Automated tests SHALL fail if the sample or the built demo contains a string that looks like a real home directory (`/Users/<name>`, `/home/<name other than demo>`, `C:\Users\<name>`).

#### Scenario: Sample paths are fictional
- **WHEN** the test suite inspects the sample dataset
- **THEN** every repository and worktree path starts with `/home/demo/`

#### Scenario: A real path slips in
- **WHEN** a sample entry is given the path `/Users/alice/Workspace/secret-repo`
- **THEN** `bun run check` fails

### Requirement: The sample showcases the dashboard and stays fresh
The sample SHALL contain at least five repositories and enough changes that every board column has at least one card, including a change with a branch match, a change with the "no tasks" warning, a change with a load warning, a repository whose scan failed, and more than 25 archived changes. Column and stage of each sample change SHALL be derived by the same rules the scanner uses. All dates in the sample SHALL be expressed relative to the moment the demo loads, so relative ages do not grow as the published demo gets older.

#### Scenario: Every column is populated
- **WHEN** the combined board of the demo is shown with no filters
- **THEN** every column has at least one card and `Archived` shows `25 of <total>`

#### Scenario: Ages do not drift
- **WHEN** the demo is opened six months after it was built
- **THEN** a change defined as "3 days old" still shows `3d ago`

### Requirement: The mock API lets the UI be explored without saving anything
The mock API SHALL implement every API operation the UI uses, and adding an operation to the UI's API interface without a demo implementation SHALL fail type checking. A scan SHALL complete and update the snapshot time so that Refresh finishes. Config edits SHALL apply for the current page session only and SHALL be gone after a reload. Discovery SHALL return canned candidates that are not already tracked. The demo SHALL show a persistent banner stating that the data is sample data and nothing is saved, with a link to the repository.

#### Scenario: Refresh completes
- **WHEN** the user clicks Refresh in the demo
- **THEN** the button returns to its idle state within two seconds and the header shows `updated just now`

#### Scenario: Settings edits are not persisted
- **WHEN** the user disables a repository in the demo's Settings, saves, and reloads the page
- **THEN** the repository disappears from the board after saving and is back after the reload

#### Scenario: Missing demo operation
- **WHEN** a developer adds `createChange` to the API interface and implements it only for HTTP
- **THEN** `bun run typecheck` fails until the demo API implements it

### Requirement: Demo navigation works without a server
In the demo build, routes SHALL be carried in the URL fragment (`#/board`, `#/repo/<id>`, `#/settings`), while filter and overview state SHALL continue to persist in the query string. Reloading or sharing a demo URL SHALL restore the same view and filters. Updating filters MUST NOT discard the current route. The normal build SHALL keep its existing path-based URLs unchanged.

#### Scenario: Deep link into the demo
- **WHEN** `index.html?q=terraform#/board` is opened
- **THEN** the combined board is shown with the search filter `terraform` applied

#### Scenario: Filter change keeps the route
- **WHEN** the user is on `#/repo/<id>` and toggles "hide archived"
- **THEN** the URL still ends in `#/repo/<id>` and a reload shows the same repository board with archived hidden

#### Scenario: Normal build unchanged
- **WHEN** the user opens `/board?repos=a,b` on the locally running dashboard
- **THEN** the combined board opens filtered to those repositories, exactly as before

### Requirement: Screenshots come only from the demo build
`bun run screenshots` SHALL render the demo build in a headless browser at a fixed viewport and write at least a dark-theme and a light-theme image of the combined board to `dist/demo/screenshots/`. The script SHALL take its input exclusively from `dist/demo/index.html`: it MUST NOT start the dashboard server and MUST NOT accept a URL of a running dashboard. It SHALL fail with a clear message when no Chrome/Chromium is found or when an expected image was not produced. Screenshots published in the README or on the demo site SHALL be produced by this script.

#### Scenario: Both themes
- **WHEN** `bun run build:demo && bun run screenshots` is run on a machine with Chrome installed
- **THEN** `dist/demo/screenshots/board-dark.png` and `board-light.png` exist, show the sample board in the respective theme, and `git status --porcelain` is empty

#### Scenario: No browser available
- **WHEN** no Chrome or Chromium can be found
- **THEN** the script exits non-zero and names the `CHROME_BIN` variable as the way to point it at one

### Requirement: The demo is published and linked from the README
On every push to `main`, the demo build and its screenshots SHALL be published to GitHub Pages. No generated demo file or screenshot SHALL be committed to the repository. The README SHALL, near the top, link to the live demo and embed the board screenshot from the published site, choosing the dark or light image according to the reader's colour scheme, with meaningful alternative text.

#### Scenario: Demo follows main
- **WHEN** a UI change is merged to `main`
- **THEN** the published demo and screenshots reflect it after the deploy workflow finishes, with no further commit

#### Scenario: README entry points
- **WHEN** a visitor opens the repository page with a dark GitHub theme
- **THEN** the README shows the dark board screenshot and a "Live demo" link that opens the published demo
