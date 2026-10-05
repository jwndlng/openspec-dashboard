# Spec Delta

## MODIFIED Requirements

### Requirement: Cards link to their change's pull request
When a change has a linked pull request (`pull-requests`: "A pull request is linked to a change by its head branch"), its card SHALL show `PR #<number>` on the status line that carries the session status and the console quick link, as a link that opens that pull request on GitHub in a new browser tab. It SHALL convey the pull request's state — draft, open, merged or closed — as text or a symbol with a tooltip, and never by colour alone. For an open pull request it SHALL also convey its readiness (`pull-requests`: "A linked open pull request has a readiness"): `ready`, or the one reason it is not ready — `draft`, `conflicts`, `checks failing`, `checks running` or `mergeability unknown` — in words, with a tooltip saying what the pull request is waiting for and when its list was last fetched. Its accessible name SHALL name the repository's pull request, its number, its state and, when open, its readiness.

The readiness SHALL use the status roles: `success` for ready, `danger` for failing checks, `warning` for conflicts, and `branch` for a draft, running checks and unknown mergeability. It MUST NOT use the `info` role, which stays reserved for a running agent.

A card whose change has no linked pull request SHALL show nothing in its place and SHALL NOT reserve space for it, so a board with no pull requests renders exactly as it does without this requirement. A merged or closed pull request SHALL still be shown, more quietly than an open one. Cards in `Archived` SHALL follow the same rule as every other card, so an archive whose pull request still awaits review shows it. Nothing SHALL be shown when pull requests are unavailable for the repository — the Pull requests view reports the reason, and repeating it per card would be noise.

The link MUST NOT change the card's column, progress bar, counts, warnings, starters or session badge, MUST NOT become a board filter or a column count, MUST NOT decide whether an archived card is hidden by **Hide merged**, and MUST NOT be the only way to reach the pull request: the change's detail header carries it in full. The one thing beyond its own badge that it changes on the card is the working state ("A card keeps its working state until its pull request is ready").

#### Scenario: Card with an open pull request
- **WHEN** a card's change has an open pull request `#125`
- **THEN** the card shows `PR #125` on its status line as a link to that pull request, opening in a new tab, with its state given as text or a symbol

#### Scenario: Card with a ready pull request
- **WHEN** a card's change has open pull request `#125` with passing checks that is mergeable
- **THEN** the card shows `PR #125` with `ready` in the `success` role

#### Scenario: Card with running checks
- **WHEN** a card's change has open pull request `#125` whose checks are pending
- **THEN** the card shows `PR #125` with `checks running` in the `branch` role, and its tooltip says when the list was last fetched

#### Scenario: Card with a conflict
- **WHEN** a card's change has open pull request `#125` that conflicts with its base
- **THEN** the card shows `PR #125` with `conflicts` in the `warning` role

#### Scenario: Card without a pull request
- **WHEN** a card's change has no linked pull request
- **THEN** the card shows no pull-request link and no space is left for one

#### Scenario: Merged pull request
- **WHEN** a card's change has a merged pull request
- **THEN** the card still shows it, marked as merged, more quietly than an open one, and with no readiness

#### Scenario: State is not conveyed by colour alone
- **WHEN** a screen reader reads a card with a draft pull request
- **THEN** it reads the pull request's number and that it is a draft

#### Scenario: Archive awaiting review
- **WHEN** an archived change's archive pull request on `chore/archive-<name>` is open
- **THEN** its card in `Archived` shows that pull request as open, with its readiness

#### Scenario: Archived change
- **WHEN** an archived change's former branch still has a cached merged pull request
- **THEN** its card in `Archived` shows it, marked as merged, more quietly than an open one

#### Scenario: Pull requests unavailable
- **WHEN** `gh` is not installed
- **THEN** no card shows a pull-request link and no card shows an error for it

#### Scenario: The link is not a filter
- **WHEN** the user clears filters on a board whose cards show pull requests
- **THEN** the same cards are shown and the links are unaffected

## ADDED Requirements

### Requirement: A card keeps its working state until its pull request is ready
A card whose change links an open pull request that is not ready (`pull-requests`: "A linked open pull request has a readiness") SHALL be shown in its **working state** — the same card tint a card with an agent at work has — whether or not an agent session is running, so that the board tells the user the change is not finished without a visit to GitHub. While that pull request is in progress (its checks are running or its mergeability is unknown) the card's name SHALL sweep as it does for a working agent; while it is only waiting (a draft, failing checks or a conflict) the card SHALL keep the tint without motion. When the pull request becomes ready, is merged or is closed, or the card no longer links it, the working state it caused SHALL end, and a card whose agent is working SHALL keep the working state the agent gives it. Users who prefer reduced motion SHALL see the tint without the sweep, as for a working agent.

The working state caused by a pull request MUST NOT add or remove a starter, change the session badge, the column, the progress bar or any count, and MUST NOT be recorded in the activity log. When pull requests are unavailable for the repository, or have never been fetched, no card SHALL be put in the working state by a pull request.

#### Scenario: Checks running after a ship
- **WHEN** the agent's session for `add-validate-phase` has ended and its open pull request `#125`'s checks are running
- **THEN** the card is tinted as working with its name sweeping, shows `PR #125` with `checks running`, and still offers the starters its stage allows

#### Scenario: Failing checks keep the tint without motion
- **WHEN** `#125`'s checks fail
- **THEN** the card stays tinted as working, its name does not sweep, and its badge says `checks failing`

#### Scenario: Ready releases the card
- **WHEN** a refresh finds `#125` with passing checks and mergeable, and no agent session of the change is running
- **THEN** the card is no longer tinted, and shows `PR #125` with `ready`

#### Scenario: A working agent keeps the tint
- **WHEN** `#125` is ready and an agent session of the change is working
- **THEN** the card stays tinted because of the agent, with its `working` session badge

#### Scenario: Merged pull request
- **WHEN** `#125` is merged
- **THEN** the pull request puts the card in no working state

#### Scenario: Nothing fetched
- **WHEN** the pull-request cache is empty or `gh` is not signed in
- **THEN** no card is tinted because of a pull request

### Requirement: The board refreshes not-ready pull requests on its own
A Kanban board SHALL run the pull-request watch of the `pull-requests` capability ("The board watches pull requests that are not ready") for the cards it shows, and the cards and the pull-request badges SHALL update in place when a watch refresh answers, without reordering cards or changing any column or count. The Refresh control on the board's pull-request dialog SHALL show a watch refresh as running, like any other refresh.

#### Scenario: The card updates in place
- **WHEN** a watch refresh finds that `#125`'s checks now pass and it is mergeable
- **THEN** the card's badge changes to `ready` and its working state ends without the card moving or the board scrolling

#### Scenario: A repository board watches only its own cards
- **WHEN** the repository board of `beta-soc` is open and `alpha-infra` has a not-ready pull request but `beta-soc` has none
- **THEN** the board starts no watch refresh
