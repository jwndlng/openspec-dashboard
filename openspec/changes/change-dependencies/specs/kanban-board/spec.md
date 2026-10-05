# Spec Delta

## MODIFIED Requirements

### Requirement: Cards offer session starters and show session state
When agent sessions are enabled and the card's repository is tracked and not excluded, a card SHALL offer the session starters available for its change — **Draft artifacts** while an artifact is not done, **Implement** in `Ready` or `Implementing`, **Archive** in `Done`, none for archived changes — in its footer, limited to the starters the repository's agent has a prompt for, and disabled with an explanation when that agent's executable is not found.

A card whose change is in `Ready` or `Implementing` and is **blocked** by its dependencies (change-dependencies) SHALL NOT offer **Implement**; in its place it SHALL show a "waits for" note naming the change's dependencies that are not `met` — the first by name and the number of others (e.g. `waits for add-billing-api +1`), or saying that its `depends-on.yaml` could not be read — whose tooltip and accessible name list every such dependency with its state. The note SHALL NOT be a control and SHALL NOT start anything; **Show details** stays beside it. The note SHALL be shown whether or not agent sessions are enabled, since it states an order rather than a session. A blocked change in any other column SHALL show no note on its card; its detail view says what it waits for. Blocking SHALL NOT move a card, change its progress bar or hide it from any filter.

While any session of the card's change is running, the card SHALL show that session's badge **in the place the starters occupy** and SHALL offer no starter at all. The badge SHALL read the running state the terminal can tell — that the agent is working, or that it may need the user with how long the terminal has been silent — and the starters SHALL stay hidden for every one of those states, so no button appears or vanishes as a terminal falls silent. Activating the badge SHALL open that change's detail view with its Console tab selected and that session shown.

A card whose latest session failed to start or ended with an error SHALL show that badge and SHALL still offer the starters its change's stage allows, so the next attempt stays one activation away. A card MUST NOT offer a control that ends a session. Status MUST be conveyed by text as well as colour. **Show details** remains available. When agent sessions are disabled or the repository is excluded, cards MUST look and behave exactly as before, apart from the "waits for" note.

#### Scenario: Done change offers Archive
- **WHEN** a change is in `Done` and agent sessions are enabled
- **THEN** the card offers **Archive** in its footer

#### Scenario: Ready change
- **WHEN** a change is in `Ready`, agent sessions are enabled and its repository is not excluded
- **THEN** the card offers **Implement** and still offers **Show details**

#### Scenario: Running session
- **WHEN** a change has a running session whose terminal is printing
- **THEN** its card shows the `working` badge where the **Implement** button was, offers no starter and no control that ends the session, and activating the badge opens that change's detail view on its Console tab

#### Scenario: Silent session shows the same badge and no starter
- **WHEN** that session's terminal has printed nothing for 45 seconds
- **THEN** the card's badge says the agent may need the user, and the card still offers no starter

#### Scenario: Failed session keeps its starter
- **WHEN** a change's latest session failed to start and no session of that change is running
- **THEN** its card shows the failure badge and the starter for its stage beside it

#### Scenario: Feature off
- **WHEN** agent sessions are disabled
- **THEN** no card shows a starter, a session badge or a console link

#### Scenario: Blocked card waits instead of offering Implement
- **WHEN** a change in `Ready` depends on `add-billing-api` (`waiting`) and `add-billing-scheme` (`missing`), and agent sessions are enabled
- **THEN** its footer shows `waits for add-billing-api +1` beside **Show details** and no **Implement**, and the note's tooltip lists `add-billing-api — waiting` and `add-billing-scheme — missing`

#### Scenario: Waiting is shown without agent sessions
- **WHEN** agent sessions are disabled and a change in `Ready` is blocked
- **THEN** its card shows the "waits for" note and no starter

#### Scenario: Drafting card is unchanged
- **WHEN** a blocked change is in `Drafts` and agent sessions are enabled
- **THEN** its card offers **Draft artifacts** as before and shows no "waits for" note

#### Scenario: Running session takes precedence
- **WHEN** a blocked change in `Implementing` has a running session
- **THEN** its card shows that session's badge, as for any running session, and no "waits for" note
