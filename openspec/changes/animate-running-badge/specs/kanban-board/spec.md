## ADDED Requirements

### Requirement: The running session badge shows activity through motion
The session badge of a running session whose terminal is not quiet SHALL be animated wherever it is shown (cards and the session panel): its dot pulses and a lighter colour sweeps across its label, in a loop of about two seconds that never hides the label or reduces its contrast below that of the static badge. The `quiet`, ended and failed badges, work-status badges and every other badge MUST NOT be animated, so that motion means exactly "an agent is working now". The animation MUST be decorative only: the label still reads `running`, the dot is hidden from assistive technology, and status remains conveyed by text as well as colour. When the user prefers reduced motion (`prefers-reduced-motion: reduce`) the badge MUST be static and look as it did without this requirement. Colours MUST come from the theme tokens so that both themes apply.

#### Scenario: Running
- **WHEN** a change has a running session that printed something within the last minute
- **THEN** its badge reads `running`, its dot pulses and a colour sweeps across the label

#### Scenario: Quiet session is still
- **WHEN** a running session has been silent for more than a minute
- **THEN** its `quiet` badge is not animated

#### Scenario: Reduced motion
- **WHEN** the user's system asks for reduced motion
- **THEN** the running badge is static and still reads `running`
