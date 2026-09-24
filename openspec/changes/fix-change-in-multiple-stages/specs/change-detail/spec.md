## ADDED Requirements

### Requirement: Detail header marks an active copy left behind next to its archive
The detail header of a change archived in the main checkout (or, in a repository without git, in the tracked folder) whose other checkouts include the main checkout SHALL show a warning badge, as text plus colour, stating that an active copy is left in the main checkout and naming that copy's column. Its tooltip SHALL name the leftover directory `openspec/changes/<name>/`, say that it usually holds files that were never committed and stayed behind when the archive arrived, and say that removing that directory clears the badge. The dashboard MUST NOT offer to remove it. The badge SHALL NOT be shown for an active change, for a pending archive (whose own badge applies), or for an archive without such a leftover, whose header MUST look as before. The board SHALL show such a change as one card, in `Archived`, like any other archived change.

#### Scenario: Leftover active copy
- **WHEN** `audit-trail` is archived in the main checkout and a leftover `openspec/changes/audit-trail/` in the main checkout would be in `Synced`
- **THEN** exactly one `audit-trail` card is on the board, in `Archived`, and its detail header shows a warning badge saying an active copy in `Synced` is left in the main checkout, whose tooltip names `openspec/changes/audit-trail/` and says that removing it clears the badge

#### Scenario: Ordinary archive
- **WHEN** a change is archived in the main checkout and no active copy of it is left there
- **THEN** its detail header shows no such badge

#### Scenario: Pending archive
- **WHEN** `audit-trail` is archived only in a worktree on `chore/archive-audit-trail` and still `Implementing` in the main checkout
- **THEN** its detail header shows the pending-archive badge and not the leftover badge
