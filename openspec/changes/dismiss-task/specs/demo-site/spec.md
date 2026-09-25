# Spec Delta

## ADDED Requirements

### Requirement: Dismissal is simulated in the demo
The demo's mock API SHALL implement the dismiss preview and the dismissal in memory: the preview SHALL list files
derived from the sample change's artifacts, with at least one sample change showing a file that would be lost for good,
and confirming SHALL remove the change from the demo's snapshot so the board follows as it would
after a real dismissal. The demo MUST NOT write anywhere or make a network request for it, and a dismissal SHALL NOT
persist across a reload.

#### Scenario: Dismiss in the demo
- **WHEN** the visitor dismisses a sample change in `Drafts` from its detail view
- **THEN** the change disappears from the board and no network request is made

#### Scenario: Reload restores it
- **WHEN** the visitor reloads the demo after dismissing a sample change
- **THEN** the change is back on the board
