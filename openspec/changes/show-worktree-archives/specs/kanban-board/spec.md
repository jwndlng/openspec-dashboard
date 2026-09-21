## ADDED Requirements

### Requirement: Cards mark an archive that the main checkout does not have yet
A card of an archived change whose checkout is a linked worktree SHALL show a badge, as text plus colour, naming the branch that holds the archive and stating that it is not in the main checkout yet. Its tooltip SHALL name the worktree and list the checkouts that still hold an active copy with their columns, and say that merging the branch and updating the main checkout resolves it. Cards of changes archived in the main checkout MUST look as before.

#### Scenario: Pending archive
- **WHEN** `audit-trail` is archived only in a worktree on `chore/archive-audit-trail` and still `Implementing` in the main checkout
- **THEN** its card is in `Archived` with a badge naming `chore/archive-audit-trail`, and the tooltip says the main checkout still has it in `Implementing`

#### Scenario: Ordinary archive
- **WHEN** a change is archived in the main checkout
- **THEN** its card shows no such badge
