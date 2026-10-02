## MODIFIED Requirements

### Requirement: The running session badge shows activity through motion
The session badge of a running session whose terminal is producing output — the badge that reads `working` — SHALL be animated wherever it is shown (cards, the Open work list and the Console tab): its dot pulses and a lighter colour sweeps across its label, in a loop of about two seconds that never hides the label or reduces its contrast below that of the static badge. The card of a change whose session badge is in that same state SHALL also show it as a whole: the card's background and edge SHALL take a soft tint of the `info` role, and a band in the `info` colour SHALL sweep across the change name in the same loop, never hiding the name, and the name SHALL keep a contrast ratio of at least 4.5:1 against the tinted background at every point of the sweep. The tint SHALL change the background's hue, not its lightness, so that every role's text keeps its contrast ratio of at least 4.5:1 against the role's soft background laid over the tinted card in both themes; hovering a tinted card SHALL give it the usual hover edge and lift but keep the tint. The `may need you`, ended and failed badges, work-status badges and every other badge MUST NOT be animated, and a card whose change has no session in that state — including every card of a repository with agent sessions disabled — MUST NOT be tinted and its name MUST NOT be animated, so that motion means exactly "an agent is working now". The animation and the tint MUST be decorative only: the badge still reads `working`, the name still reads the change name, the dot is hidden from assistive technology, and status remains conveyed by text as well as colour. When the user prefers reduced motion (`prefers-reduced-motion: reduce`) the badge and the name MUST be static and look as they did without this requirement; the card's tint SHALL remain, as it is not motion. Colours MUST come from the theme tokens so that both themes apply.

#### Scenario: Running
- **WHEN** a change has a running session that printed something within the last 20 seconds
- **THEN** its badge reads `working`, its dot pulses and a colour sweeps across the label

#### Scenario: The working card stands out
- **WHEN** a card's change has a session whose badge reads `working`
- **THEN** the card's background and edge are tinted in the `info` role and a colour sweeps across the change name, which still reads in full

#### Scenario: An idle card stays plain
- **WHEN** a card's change has no session, or only an ended or failed one
- **THEN** the card has its usual background and edge and its name is not animated

#### Scenario: Quiet session is still
- **WHEN** a running session has been silent for longer than 20 seconds and its badge reads `may need you`
- **THEN** neither that badge nor the card's name is animated, and the card is not tinted

#### Scenario: Reduced motion
- **WHEN** the user's system asks for reduced motion and a card's change has a session whose badge reads `working`
- **THEN** the badge and the change name are static, the badge still reads `working`, and the card keeps its tint
