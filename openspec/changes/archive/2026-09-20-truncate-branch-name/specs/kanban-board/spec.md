## MODIFIED Requirements

### Requirement: Cards show repository, name, progress, activity and branch
Each card SHALL display the change name in monospace, a progress bar with `done/total` when tasks exist, the relative age of `lastActivityAt` (e.g. "3d ago"), and a branch badge when `branchMatch` is set. On the combined board each card SHALL also display the repository name; on a single-repository board the repository name SHALL be omitted from cards. Cards in `Done` SHALL additionally show how long the change has been complete.

The branch badge MUST NOT extend beyond the card's content area at any column width. A branch name that fits SHALL be shown in full. A branch name that does not fit SHALL be shortened in the middle with an ellipsis so that both its beginning and its end remain readable, and the branch glyph SHALL remain visible. The full branch name SHALL remain available as the badge's tooltip and as its accessible name. The badge MAY wrap onto its own line within the card but MUST NOT shrink or displace the card's other badges out of the card. The same rules SHALL apply to the current-branch badge in the repository board header.

#### Scenario: Card content
- **WHEN** a change `cloud-deployment` in repo `demo-ops` has `tasks 30/30`, last activity 12 days ago and no branch match, and is shown on the combined board
- **THEN** the card shows `demo-ops`, `cloud-deployment`, a full progress bar labelled `30/30`, `12d ago`, and no branch badge

#### Scenario: Card on a repository board
- **WHEN** the same change is shown on the board for repository `demo-ops`
- **THEN** the card shows `cloud-deployment`, the progress bar, `12d ago` and the copy action, but not the repository name

#### Scenario: Short branch name is shown in full
- **WHEN** a card has `branchMatch: feat/add-login`
- **THEN** the badge reads `⎇ feat/add-login` with no ellipsis

#### Scenario: Long branch name stays inside the card
- **WHEN** a card has `branchMatch: feat/introduce-tenant-quota-enforcement` and the name does not fit the card width
- **THEN** the badge ends at or before the card's content edge, shows the beginning of the name, an ellipsis, and the end of the name (ending in `quota-enforcement`), and no part of the badge is painted outside the card

#### Scenario: Full name stays available
- **WHEN** the user hovers a shortened branch badge, or a screen reader reads it
- **THEN** the full name `feat/introduce-tenant-quota-enforcement` is presented

#### Scenario: Other badges are not squeezed
- **WHEN** a card shows an age badge and a long branch badge that do not fit on one line
- **THEN** the branch badge moves to its own line and the age badge keeps its full text
