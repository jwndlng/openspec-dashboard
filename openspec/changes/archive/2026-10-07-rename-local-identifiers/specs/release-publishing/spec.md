## MODIFIED Requirements

### Requirement: The binary reports its version
`spec-control --version` SHALL print the version the binary was built as and exit with status 0 without starting the server, opening a browser or reading configuration. A binary built by the release workflow SHALL report its release tag (for example `v0.4.0`); any other build, including `bun run dev` and a local `bun run build`, SHALL report `dev`, unless the build was given a version in `SPEC_CONTROL_VERSION` (or, for one release, the former `OPENSPEC_DASHBOARD_VERSION` when `SPEC_CONTROL_VERSION` is unset), which the release workflow sets to the tag. The `--help` output SHALL list `--version`.

#### Scenario: Release binary
- **WHEN** the binary attached to release `v0.4.0` is run with `--version`
- **THEN** it prints `v0.4.0` and exits 0

#### Scenario: Local build
- **WHEN** a contributor runs `bun run build` and then `./dist/spec-control --version`
- **THEN** it prints `dev` and exits 0

#### Scenario: No side effects
- **WHEN** `--version` is passed
- **THEN** no port is bound, no browser is opened and nothing under `~/.spec-control/` or `~/.openspec-dashboard/` is written or moved

#### Scenario: Build as a given version
- **WHEN** a contributor runs `SPEC_CONTROL_VERSION=v1.2.3 bun run build` and then `./dist/spec-control --version`
- **THEN** it prints `v1.2.3` and exits 0
