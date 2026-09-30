# Spec Delta

## MODIFIED Requirements

### Requirement: Board columns follow the lifecycle phases
The board SHALL place each change in exactly one column, where a column names the phase of the lifecycle the change is in. Using, in order: `Archived` if the change is archived; `Done` if `tasks.total > 0` and every task is settled — `tasks.done + tasks.awaiting == tasks.total` — whether or not the change's delta specs are already synced into the main specs; `Implementing` if at least one task is settled; `Ready` if every artifact is done (ready to apply, nothing ticked yet); `Unknown` if the change's artifacts could not be read; `Backlog` if no artifact is done; otherwise `Drafts` (at least one artifact is done and at least one is not). Which artifacts are done, and in which order they were written, SHALL NOT matter beyond that: every schema's artifacts count alike.

A change in `Done` SHALL additionally carry one sub-state: `validate` when `tasks.awaiting > 0` — the work is finished but a person still has to confirm it — and `complete` otherwise. The sub-state SHALL be derived from the snapshot alone, exactly like the column. It SHALL NOT be a column: `Done` holds both, the column's count SHALL be the whole column, and every "to archive" count SHALL keep counting both, because a change awaiting validation can be archived.

The board SHALL show the columns `Backlog`, `Drafts`, `Ready`, `Implementing`, `Done`, `Archived`, in that order, on the combined board and on every repository board, whether or not a column holds a change; `Unknown` SHALL be shown between `Drafts` and `Ready` only while at least one change on that board is in it. Columns MUST NOT depend on the schemas the tracked changes use: there SHALL be no column per artifact, no `Synced` column and no `Validate` column.

#### Scenario: Every task ticked
- **WHEN** a change has `tasks` `done: 12, awaiting: 0, total: 12` and is not archived
- **THEN** it appears in `Done` with the sub-state `complete`

#### Scenario: Awaiting validation
- **WHEN** a change has `tasks` `done: 13, awaiting: 2, total: 15` and is not archived
- **THEN** it appears in `Done` with the sub-state `validate`

#### Scenario: Awaiting validation with nothing ticked
- **WHEN** a change has `tasks` `done: 0, awaiting: 9, total: 9`
- **THEN** it appears in `Done` with the sub-state `validate`

#### Scenario: Still implementing
- **WHEN** a change has `tasks` `done: 13, awaiting: 1, total: 15`
- **THEN** it appears in `Implementing`, because a task is still open

#### Scenario: First task left for validation
- **WHEN** all artifacts are done and a change has `tasks` `done: 0, awaiting: 1, total: 12`
- **THEN** it appears in `Implementing`, not in `Ready`

#### Scenario: The column count covers both sub-states
- **WHEN** the `Done` column holds three complete changes and two awaiting validation
- **THEN** its header count is `5` and every "to archive" count is `5`

#### Scenario: Validate is not a column
- **WHEN** changes awaiting validation are on the board
- **THEN** the board shows the columns `Backlog`, `Drafts`, `Ready`, `Implementing`, `Done`, `Archived` and no `Validate` column

### Requirement: Cards show only what an overview needs
A card SHALL show only what an overview needs: the change name in monospace, the relative age of `lastActivityAt` under it (e.g. `updated 3d ago`, or the archive date for an archived change), the change's session status as the "Cards offer session starters and show session state" requirement gives it, a progress bar, and a footer with the next-step starter and **Show details**, and — when the change has a console — the console quick link beside its session status.

The change name and its age SHALL have the full width of the card's top to themselves: nothing SHALL sit beside them, so the name wraps only when it is longer than the card is wide. The session status and the console quick link SHALL sit together on their own line directly below the age and above the progress bar; a card with neither SHALL show no such line and no space for one. **Show details** SHALL have the same height and text size as the next-step starter button in the footer, so the two sit on the footer's line as a pair; at rest it keeps its quieter look than the starter. The progress bar SHALL be, for a change in `Drafts`, the drafting progress: the number of the change's artifacts that are done out of all of its schema's artifacts, labelled `done/total Artifacts`, with a tooltip and accessible name that say it counts artifacts (e.g. `2 of 4 artifacts written`); for any other change with tasks (`tasks.total > 0`), the task progress labelled `done/total Tasks`, with a tooltip and accessible name that say it counts tasks. Both bars SHALL share one shape and style; the word after the count is what tells them apart at a glance. A card in `Backlog`, and a card outside `Drafts` without tasks, SHALL show no progress bar. A card SHALL additionally show the `no tasks` warning and an error mark for any other warning the snapshot carries. A card SHALL NOT show the repository name — on the combined board every card sits in its repository's group, whose header names it, and a repository board names it in its header — nor the branch badge, the checkouts holding the change, the worktree's work status, the prompt, how long the change has been complete, whether its specs are synced, or which artifacts are written: the change's detail view shows those (change-detail: "Detail header shows the change's state"), and the column and the progress bar say how far the change has come.

A card whose change has `tasks.awaiting > 0` SHALL additionally show a **Validate** badge in the `warning` role, and its task progress bar SHALL have three parts: the done tasks filled, the awaiting tasks as a distinct unfinished segment between the filled part and the remainder, and the open tasks empty. Its label SHALL name the awaiting count in words rather than by colour alone (e.g. `13 + 2 awaiting / 15 Tasks`), and the tooltip and accessible name SHALL say how many tasks are done, how many await validation and how many are open. With `tasks.awaiting` zero or absent the bar and its label SHALL be exactly as they are without this requirement. The badge SHALL NOT be shown for an archived change.

The branch badge in the repository board header MUST NOT extend beyond its container at any width. A branch name that fits SHALL be shown in full; one that does not SHALL be shortened in the middle with an ellipsis so that both its beginning and its end remain readable, with the branch glyph visible and the full name as its tooltip and accessible name.

#### Scenario: Card content
- **WHEN** a change `cloud-deployment` in repo `demo-ops` has `tasks 30/30`, last activity 12 days ago and a branch match `feat/cloud-deployment`, and is shown on the combined board
- **THEN** the card sits in the `demo-ops` group and shows `cloud-deployment`, `updated 12d ago`, a full progress bar labelled `30/30 Tasks` and **Show details**, and shows neither `demo-ops`, the branch, nor a completion badge

#### Scenario: Drafting progress
- **WHEN** a `spec-driven` change has `proposal` and `design` done and `specs` and `tasks` not done
- **THEN** its card in `Drafts` shows a progress bar half filled and labelled `2/4 Artifacts`, whose tooltip and accessible name read `2 of 4 artifacts written`

#### Scenario: Drafting progress for another schema
- **WHEN** a change of a schema with the artifacts `brief`, `plan`, `checklist` has `brief` done
- **THEN** its card in `Drafts` shows a drafting progress bar labelled `1/3 Artifacts`

#### Scenario: Backlog card has no bar
- **WHEN** a change in `Backlog` has a `tasks.md` that is not written yet
- **THEN** its card shows no progress bar

#### Scenario: Task progress replaces drafting progress
- **WHEN** a change moves from `Drafts` to `Ready` with `tasks` `done: 0, total: 12`
- **THEN** its card shows the task progress bar labelled `0/12 Tasks`, whose tooltip says it counts tasks, and no drafting progress

#### Scenario: Card with a running session
- **WHEN** a change in `Implementing` has a session whose agent is waiting for the user
- **THEN** its card shows the change name and its age, under them the session's status, then the task progress, and the next step in its footer

#### Scenario: Session status does not squeeze the name
- **WHEN** the change `introduce-tenant-quota-enforcement` has a running session and a session worktree, and its name fits the card's width on one line
- **THEN** its card shows the whole name on one line, with the session badge and the console quick link on the line below the age

#### Scenario: No session, no status line
- **WHEN** a change has neither a session nor a session worktree
- **THEN** its card goes straight from the age to the progress bar, with no empty line between them

#### Scenario: Show details matches the starter
- **WHEN** a card in `Ready` offers **▶ Implement** and **Show details** in its footer
- **THEN** both are drawn with the same height and the same text size

#### Scenario: Details live in the detail view
- **WHEN** a change has a `prompt.md`, a worktree with uncommitted files and all of its artifacts written
- **THEN** its card shows none of these, and its detail view shows the prompt, the work status and each artifact's state

#### Scenario: Long branch name in the repository header
- **WHEN** the repository board's current branch is `feat/introduce-tenant-quota-enforcement` and it does not fit
- **THEN** its badge shows the beginning, an ellipsis and `quota-enforcement`, stays inside the header, and presents the full name on hover and to a screen reader

#### Scenario: Awaiting validation
- **WHEN** a change in `Done` has `tasks` `done: 13, awaiting: 2, total: 15`
- **THEN** its card shows a **Validate** badge and a progress bar labelled `13 + 2 awaiting / 15 Tasks`, whose accessible name says thirteen tasks are done, two await validation and none are open

#### Scenario: Awaiting segment is not the only cue
- **WHEN** a screen reader reads a card awaiting validation
- **THEN** it reads the **Validate** badge and a progress label naming the awaiting count, without relying on the segment's colour

#### Scenario: No awaiting tasks
- **WHEN** a change has `tasks` `done: 4, awaiting: 0, total: 12`
- **THEN** its card shows no **Validate** badge and a two-part bar labelled `4/12 Tasks`
