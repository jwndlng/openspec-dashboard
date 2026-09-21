# Spec Delta

## ADDED Requirements

### Requirement: Status labels use a semantic colour palette
Every label the board paints in a colour SHALL draw that colour from a fixed set of semantic roles, and each role SHALL
mean one thing across the whole UI. The roles are `info` (blue), `branch` (orange), `success`, `warning`, `danger` and
`neutral`. Each role SHALL be defined as theme tokens for its text and border in both themes; every role SHALL share
the badge's own background so that one contrast check covers them all. Component styles MUST reference those tokens
rather than literal colours or the brand accent.

Labels SHALL use the roles as follows:

- `info` — something in flight: an agent session that is running, including its `quiet` state, and outside the board an
  action that is planned but not yet applied. On a card no label other than a running session's SHALL use it, so that
  on the board blue means exactly "an agent is up".
- `branch` — anything naming a working copy that is not merged yet: the branch badge on a card, on the change detail
  view and in the repository board header, and the `uncommitted`, `unpushed` and `pushed` work-status badges.
- `success` — a complete change and `merged` work.
- `warning` — a condition the user should look at but that is not an error: a missing tasks file, an archive the main
  checkout does not have yet.
- `danger` — a failed or erroring session, a scan warning, and uncommitted or unpushed work that has gone stale.
  Stale `pushed` work stays `warning`: a pushed branch may simply be waiting for review.
- `neutral` — labels that carry no status: the activity age, the `prompt` note, the column a change sits in, and
  markers such as which agent profile is the default.

The brand accent SHALL NOT be the colour of any status label; it stays reserved for focus, active state, primary
actions and progress. Colour MUST NOT be the only cue: every label SHALL keep its text, and its role MUST NOT change
what it says. Every role's text SHALL keep a contrast ratio of at least 4.5:1 against the card and panel backgrounds in
both themes.

#### Scenario: A live agent is blue
- **WHEN** a card's change has a running session that printed something within the last minute
- **THEN** its badge reads `running` in the `info` role, and no other label on that card uses `info`

#### Scenario: A quiet session keeps the live role
- **WHEN** a running session's terminal has printed nothing for more than a minute
- **THEN** its badge reads `quiet <duration>` in the `info` role, without motion

#### Scenario: Branch and uncommitted work share the orange role
- **WHEN** a card shows the branch badge `feat/add-login` and its worktree holds 3 uncommitted files
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

#### Scenario: Roles are legible in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** each role's text keeps a contrast ratio of at least 4.5:1 against the badge's own ground and against the card it sits in

## MODIFIED Requirements

### Requirement: Visual design follows the dashboard token set
The UI SHALL define its colours as two token sets sharing the same token names: the dark set defined in design.md (neutral grey backgrounds `#0b0d10`…`#313437`, teal brand `#71c7c5`) and a light set (backgrounds `#f6f8fb`…`#d3dbe6`, teal brand `#1f8a88`). The dark theme's background, text and border tokens SHALL be near-neutral greys with at most a slight cool tint; in the dark theme teal SHALL be used only as an accent (focus, active state, primary actions, progress) and MUST NOT be the colour of panel or card borders, nor the colour of any status label. Both themes SHALL share Space Grotesk for text, JetBrains Mono for identifiers and a 4px radius, with fonts bundled locally. Component styles MUST reference colour tokens only and MUST NOT contain literal colour values. In both themes, text and status colours SHALL have a contrast ratio of at least 4.5:1 against the backgrounds they are rendered on. The token set SHALL keep the status roles, the brand accent and the repository colours in three disjoint colour ranges, so that no status label can be mistaken for a repository accent and no repository can be shown in a colour that means a status. The UI MUST render correctly without network access.

#### Scenario: Offline rendering
- **WHEN** the dashboard is opened with no network connectivity
- **THEN** fonts and styles render as designed in the active theme with no external requests

#### Scenario: Same layout in both themes
- **WHEN** the theme is switched between dark and light
- **THEN** only colours change; layout, spacing, typography and radius are identical

#### Scenario: Status badges readable in light theme
- **WHEN** the light theme is active and a card shows success, warning and danger badges
- **THEN** each badge's text has a contrast ratio of at least 4.5:1 against the card background and is still accompanied by a text label

#### Scenario: Dark ground is neutral grey
- **WHEN** the dark theme is active
- **THEN** the page, column, card and panel backgrounds are near-neutral greys whose red, green and blue channels differ by no more than 6 of 255, and panel and card borders are grey rather than teal

#### Scenario: Subtle text readable on dark cards
- **WHEN** the dark theme is active and a card shows heading, body and subtle text
- **THEN** each has a contrast ratio of at least 4.5:1 against the card background

#### Scenario: Status, brand and repository colours do not overlap
- **WHEN** the colours a repository can be assigned are compared with the status roles and the brand accent
- **THEN** none of them coincides, in either theme

### Requirement: Each repository has its own stable colour
The board SHALL assign every repository in the snapshot a colour derived deterministically from its repository id, without any configuration. The assignment SHALL be computed over all repositories in the snapshot, independent of the active filters, so that the same set of tracked repositories always yields the same colours across reloads, scans and filter changes. Repositories tracked at the same time SHALL receive distinct colours for up to 19 repositories. The colours a repository can be assigned SHALL exclude the hues the status roles and the brand accent own: every assignable repository hue SHALL differ from every one of those hues by at least 12°, so a repository is never shown in a colour that means "running", "uncommitted", "complete", "needs attention" or "error". The repository colour SHALL be shown on the repository's group header, as an accent on each of its cards including the card's repository label, and on its repository filter chip. The colour SHALL adapt to the active theme so that repository-coloured text keeps a contrast ratio of at least 4.5:1 against its background in every supported theme. Colour MUST NOT be the only cue: wherever a repository colour is shown, the repository name SHALL be shown with it. The error styling of a repository filter chip SHALL take precedence over its repository colour.

#### Scenario: Distinct colours
- **WHEN** 17 repositories are tracked
- **THEN** no two of them have the same colour

#### Scenario: Stable across reload and rescan
- **WHEN** the page is reloaded or a scan completes and the set of tracked repositories is unchanged
- **THEN** every repository has the same colour as before

#### Scenario: Filters do not change colours
- **WHEN** the user filters the board to repository `vcs-admin` only
- **THEN** `vcs-admin` cards, group headers and filter chip keep the colour they had with no filter applied

#### Scenario: Colour is consistent across the board
- **WHEN** repository `beta-soc` has cards in three columns
- **THEN** its group headers, the accent and repository label on all of its cards, and its filter chip all use the same colour, each alongside the name `beta-soc`

#### Scenario: Theme change
- **WHEN** the user switches from the dark to the light theme
- **THEN** each repository keeps the same hue, and repository-coloured text remains legible (contrast ≥ 4.5:1) on the light backgrounds

#### Scenario: Repository in error
- **WHEN** a tracked repository failed to scan
- **THEN** its filter chip shows the error styling rather than its repository colour

#### Scenario: No repository wears a status colour
- **WHEN** 19 repositories are tracked
- **THEN** every assigned hue is at least 12° away from each of the status role hues and from the brand accent
