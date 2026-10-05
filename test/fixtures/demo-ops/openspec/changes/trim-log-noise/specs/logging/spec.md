## MODIFIED Requirements

### Requirement: Default log level
The service SHALL log at `info` by default.

#### Scenario: Debug hidden
- **WHEN** the service starts without a log level
- **THEN** no debug line is written
