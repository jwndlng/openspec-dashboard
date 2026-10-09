# Spec Delta

## MODIFIED Requirements

### Requirement: Help offers the tour
The Help view SHALL offer **Take the tour** near its start, which starts the onboarding tour from its first step, and
next to it **Run setup again**, which opens the setup wizard at its first step as the `setup-wizard` capability
specifies.

#### Scenario: Take the tour
- **WHEN** the user activates **Take the tour**
- **THEN** the onboarding tour starts at its first step

#### Scenario: Run setup again
- **WHEN** the user activates **Run setup again**
- **THEN** the setup wizard opens at its Welcome step
