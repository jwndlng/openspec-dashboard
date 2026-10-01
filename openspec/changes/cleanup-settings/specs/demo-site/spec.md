## MODIFIED Requirements

### Requirement: The mock API lets the UI be explored without saving anything
The mock API SHALL implement every API operation the UI uses, including the stream of a session's terminal, and adding an operation to the UI's API interface without a demo implementation SHALL fail type checking. A scan SHALL complete and update the snapshot time so that Refresh finishes. Config edits SHALL apply for the current page session only and SHALL be gone after a reload; this includes the per-project settings and Forget on the projects overview, which SHALL change the demo's in-memory configuration at once and be refused in the same cases as by the dashboard. Discovery SHALL return canned candidates that are not already tracked. Session operations SHALL be simulated in memory rather than refused, and SHALL be gone after a reload. The demo SHALL show a persistent banner stating that the data is sample data, that agent sessions are simulated, and that nothing is saved, with a link to the repository.

#### Scenario: Refresh completes
- **WHEN** the user clicks Refresh in the demo
- **THEN** the button returns to its idle state within two seconds and the header shows `updated just now`

#### Scenario: Settings edits are not persisted
- **WHEN** the visitor switches agent sessions off in the demo's Settings, saves, and reloads the page
- **THEN** cards offer no session starter after saving and offer them again after the reload

#### Scenario: Overview edits are not persisted
- **WHEN** the visitor disables a repository on the demo's projects overview and reloads the page
- **THEN** the repository disappears from the board at once and is back after the reload

#### Scenario: Per-project settings in the demo
- **WHEN** the visitor renames a project, switches its agent sessions to Disabled and forgets a disabled repository on the demo's projects overview
- **THEN** each change shows at once without any Save, the renamed project's board shows the new name, its cards offer no session starter, and after a reload all three are back as on first load

#### Scenario: Missing demo operation
- **WHEN** a developer adds `createChange` to the API interface and implements it only for HTTP
- **THEN** `bun run typecheck` fails until the demo API implements it

#### Scenario: Session actions are not persisted
- **WHEN** the visitor starts a session, ships another and removes a merged worktree, and then reloads the page
- **THEN** the seeded sessions and worktrees are back exactly as on first load
