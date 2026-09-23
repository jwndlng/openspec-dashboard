## MODIFIED Requirements

### Requirement: The feed can be filtered
The feed SHALL be filterable by repository, using the same **Repositories** menu and removable repository tags as the board's filter bar, and by kind of event in the groups *Changes*, *Tasks*, *Sessions* and *Repositories*, shown as one group of toggles, with **Clear filters** while any filter is active. Filters SHALL apply to older entries loaded on demand as well and SHALL be kept in the URL query string.

#### Scenario: One repository, sessions only
- **WHEN** the user selects repository `demo-ops` and the group *Sessions*
- **THEN** only session events of `demo-ops` are shown, the URL reflects both filters, and reloading the page shows the same selection
