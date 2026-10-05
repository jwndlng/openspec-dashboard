# Spec Delta

## MODIFIED Requirements

### Requirement: Artifact status is computed with the OpenSpec library
For every change directory under `openspec/changes/` (excluding `archive/`) and under `openspec/changes/archive/`, the scanner SHALL compute artifact statuses using `@fission-ai/openspec` (`resolveSchema`, `loadChangeContext`, `formatChangeStatus`) in-process. The scanner MUST NOT invoke the `openspec` CLI. Artifacts MUST be reported in schema order with status `done`, `ready` or `blocked`. Each artifact SHALL also be reported as **required** when the change's schema names it in `apply.requires`; when the schema declares no `apply.requires`, every artifact SHALL be reported as required. Being required SHALL NOT change an artifact's status: `done`, `ready` and `blocked` keep their meaning, and an artifact that is not required is still `ready` or `blocked` until it is written.

#### Scenario: Spec-driven change with proposal only
- **WHEN** a change contains only `proposal.md`
- **THEN** artifacts are reported as `proposal: done`, `design: ready`, `specs: ready`, `tasks: blocked`

#### Scenario: Required artifacts of the spec-driven schema
- **WHEN** a `spec-driven` change is scanned
- **THEN** `tasks` is reported as required and `proposal`, `specs` and `design` are reported as not required

#### Scenario: Schema without apply.requires
- **WHEN** a change uses a schema that declares no `apply.requires`
- **THEN** every one of its artifacts is reported as required

#### Scenario: Repos written by older CLI versions
- **WHEN** a repository was initialised with OpenSpec CLI 1.3.x
- **THEN** its changes are parsed and reported without error
