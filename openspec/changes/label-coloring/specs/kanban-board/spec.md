# Spec Delta

## MODIFIED Requirements

### Requirement: Status labels use a semantic colour palette
Every status label the board paints in a colour SHALL draw that colour from a fixed set of semantic roles, and each role SHALL
mean one thing across the whole UI. The roles are `info` (blue), `branch` (orange), `success`, `warning`, `danger` and
`neutral`. Each role SHALL be defined as theme tokens for its text, its border and a soft background in both themes: a
label in a role SHALL be drawn on that role's soft background (a translucent tint of the role), so the role reads as a
filled chip. The `neutral` role keeps the badge's own background. Component styles MUST reference those tokens
rather than literal colours or the brand accent.

Labels SHALL use the roles as follows:

- `info` — something in flight: an agent session that is running, including its `quiet` state, and outside the board an
  action that is planned but not yet applied. On a card no label other than a running session's SHALL use it, so that
  on the board blue means exactly "an agent is up".
- `branch` — anything naming a working copy that is not merged yet: the branch badge on the change detail view and
  in the repository board header, and the `uncommitted`, `unpushed` and `pushed` work-status badges.
- `success` — a complete change and `merged` work.
- `warning` — a condition the user should look at but that is not an error: a missing tasks file, an archive the main
  checkout does not have yet.
- `danger` — a failed or erroring session, a scan warning, and uncommitted or unpushed work that has gone stale.
  Stale `pushed` work stays `warning`: a pushed branch may simply be waiting for review.
- `neutral` — labels that carry no status: the activity age, the `prompt` note, the column a change sits in, and
  markers such as which agent profile is the default.

A repository's labels (project-labels) are groupings, not status labels, and take no role: wherever they are shown,
including the repository board header, each is painted in its label colour, whose hue is drawn from the same assignable
hues as repository colours and therefore keeps at least 12° from every role hue and from the brand accent.

The brand accent SHALL NOT be the colour of any status label; it stays reserved for focus, active state, primary
actions and progress. Colour MUST NOT be the only cue: every label SHALL keep its text, and its role MUST NOT change
what it says. Every role's text SHALL keep a contrast ratio of at least 4.5:1 against the card and panel backgrounds in
both themes, and so SHALL it against the role's soft background laid over those backgrounds.

#### Scenario: A live agent is blue
- **WHEN** a card's change has a running session that printed something within the last minute
- **THEN** its badge reads `running` in the `info` role, and no other label on that card uses `info`

#### Scenario: A quiet session keeps the live role
- **WHEN** a running session's terminal has printed nothing for more than a minute
- **THEN** its badge reads `quiet <duration>` in the `info` role, without motion

#### Scenario: Branch and uncommitted work share the orange role
- **WHEN** a change's detail view shows the branch badge `feat/add-login` and its worktree holds 3 uncommitted files
- **THEN** both labels are painted in the `branch` role, and both still read their own text

#### Scenario: The brand accent is not a status
- **WHEN** any card on the board is rendered in either theme
- **THEN** none of its labels uses the brand accent colour, while focus rings, primary buttons and the progress bar still do

#### Scenario: Stale open work escalates
- **WHEN** a worktree has had unpushed commits for two days and no session is running
- **THEN** its badge is painted in the `danger` role and still says how long it has been untouched

#### Scenario: A stale pushed branch is only a warning
- **WHEN** a worktree's branch has been pushed and untouched for eight days and no session is running
- **THEN** its badge is painted in the `warning` role, not `danger`

#### Scenario: Repository labels take no role
- **WHEN** a repository board header shows the repository's labels `client` and `terraform`
- **THEN** neither chip is painted in a status role or the brand accent, and each keeps its label colour

#### Scenario: Roles are legible in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** each role's text keeps a contrast ratio of at least 4.5:1 against the badge's own ground and against the card it sits in
