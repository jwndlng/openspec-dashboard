## MODIFIED Requirements

### Requirement: Detail header shows the change's state
The detail view SHALL show, above the artifacts: the change name in monospace, the repository name linking to that repository's board, a close control, and every warning the snapshot carries for the change. Below them it SHALL show the change's state and whereabouts that the card on the board leaves out: its column; its task progress as a bar with `done/total` when tasks exist; the relative age of its last activity, or its archive date when archived; how long it has been complete when it is in `Done` or `Synced`; its branch badge when `branchMatch` is set, whose tooltip names the worktree the data comes from and lists the other checkouts holding a copy with their branch and column; for an archive found only in a linked worktree, a badge naming the branch that holds it and stating that the main checkout does not have it yet, with a tooltip listing the checkouts still holding an active copy and how to resolve it; when agent sessions apply and a session worktree exists for the change, the work-status badge (uncommitted files, commits not pushed, `pushed` or `merged`, highlighted as stale by the same rules as before), which opens the change's Console tab; and the text of its `prompt.md`, without the heading the create form writes, as plain text that scrolls when long. Status SHALL be conveyed by text as well as colour. All of these SHALL come from the existing snapshot; the detail view MUST NOT introduce facts about a change that the snapshot does not carry, and it SHALL NOT show the change's creation date or schema. For a change that is gone from the snapshot but whose worktree remains, the header SHALL show only its name, the repository and the close control.

#### Scenario: Header content
- **WHEN** a change `cloud-deployment` of repository `demo-ops` is in `Implementing` with `tasks 4/12`, created `2026-03-02`, last activity 3 days ago and `branchMatch: feat/cloud-deployment`
- **THEN** the header shows `cloud-deployment`, `demo-ops` as a link to that repository's board, a close control, `Implementing`, a progress bar with `4/12`, `updated 3d ago` and the branch badge `feat/cloud-deployment`, and shows neither the creation date nor the schema

#### Scenario: Worktree and other checkouts
- **WHEN** `audit-trail` is `Implementing` in a worktree on `feat/audit-trail` and `Proposal` in the main checkout
- **THEN** its detail header shows the badge `feat/audit-trail`, whose tooltip names the worktree path and lists the main checkout with `Proposal`

#### Scenario: Work status
- **WHEN** a change's session has ended and its worktree holds 3 uncommitted files
- **THEN** the detail header shows "3 uncommitted", and activating it opens the Console tab

#### Scenario: Pending archive
- **WHEN** `audit-trail` is archived only in a worktree on `chore/archive-audit-trail`
- **THEN** its detail header names `chore/archive-audit-trail` and says the main checkout does not have the archive yet

#### Scenario: Prompt
- **WHEN** the change has a `prompt.md` reading `# Prompt`, an empty line and `Log every mutation`
- **THEN** the header shows `Log every mutation` as plain text, without the heading

#### Scenario: Warnings are surfaced
- **WHEN** the snapshot carries a warning for the change
- **THEN** the warning text is shown in the header

#### Scenario: Archived change
- **WHEN** the detail view is open for an archived change
- **THEN** its artifacts are shown like any other change's, and the header shows its archive date
