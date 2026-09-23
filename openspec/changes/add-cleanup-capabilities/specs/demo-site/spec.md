# Spec Delta

## ADDED Requirements

### Requirement: Cleanup is simulated in the demo
The demo's mock API SHALL implement the cleanup preview and apply operations in memory without any network access or
process. The sample SHALL contain at least one repository with a merged linked worktree and its merged branch, at least
one kept worktree (for example with uncommitted files) and at least one kept, unmerged branch, so that the dialog shows
removable and kept items on first load. Applying a cleanup SHALL remove the selected items from the sample for the
current page session only, and SHALL report deleted branches with a commit and restore command like the real
dashboard. Removed items SHALL be back after a reload.

#### Scenario: Cleanup in the demo
- **WHEN** the visitor opens **Clean up** on the sample repository with a merged worktree and confirms
- **THEN** the result reports the worktree removed and the branch deleted, the worktree's chip disappears from the
  header, and no network request is made

#### Scenario: Not persisted
- **WHEN** the visitor reloads the page after a cleanup
- **THEN** the removed worktree and branch are back in the sample
