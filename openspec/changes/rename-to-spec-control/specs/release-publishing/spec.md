## MODIFIED Requirements

### Requirement: Publishing a release attaches verified binaries
When a release whose tag starts with `v` is published, the release workflow SHALL build the single binary from that tag for `darwin-arm64`, `darwin-x64`, `linux-x64` and `linux-arm64`, each on a runner of that platform, and SHALL attach them to the release as `spec-control-<tag>-<platform>`, together with a `SHA256SUMS` file covering every attached binary. Each binary SHALL have a GitHub build-provenance attestation. Before anything is attached, each binary MUST run successfully with `--help`, and `--version` MUST print exactly the release tag; if any platform fails to build or verify, nothing SHALL be attached. After attaching, the workflow SHALL append to the release notes a section naming the downloads and showing how to verify a download's checksum and attestation. A draft release, or a release whose tag does not start with `v`, SHALL trigger no build.

#### Scenario: Publishing the draft
- **WHEN** the maintainer publishes the draft release `v0.4.0`
- **THEN** the release gains `spec-control-v0.4.0-darwin-arm64`, `-darwin-x64`, `-linux-x64`, `-linux-arm64` and `SHA256SUMS`, each binary has a provenance attestation, and the notes end with download and verification instructions

#### Scenario: Version mismatch blocks the upload
- **WHEN** a binary built for release `v0.4.0` prints anything other than `v0.4.0` for `--version`
- **THEN** the workflow fails and no file is attached to the release

#### Scenario: One platform fails
- **WHEN** the `linux-arm64` build fails while the others succeed
- **THEN** no binary and no `SHA256SUMS` are attached

#### Scenario: Checksums match
- **WHEN** a user downloads a binary and `SHA256SUMS` from a release and runs `shasum -a 256 -c` on the line for that binary
- **THEN** the check passes

#### Scenario: Non-version tag
- **WHEN** a release tagged `nightly-test` is published
- **THEN** the release workflow builds nothing and attaches nothing

### Requirement: The binary reports its version
`spec-control --version` SHALL print the version the binary was built as and exit with status 0 without starting the server, opening a browser or reading configuration. A binary built by the release workflow SHALL report its release tag (for example `v0.4.0`); any other build, including `bun run dev` and a local `bun run build`, SHALL report `dev`. The `--help` output SHALL list `--version`.

#### Scenario: Release binary
- **WHEN** the binary attached to release `v0.4.0` is run with `--version`
- **THEN** it prints `v0.4.0` and exits 0

#### Scenario: Local build
- **WHEN** a contributor runs `bun run build` and then `./dist/spec-control --version`
- **THEN** it prints `dev` and exits 0

#### Scenario: No side effects
- **WHEN** `--version` is passed
- **THEN** no port is bound, no browser is opened and nothing under `~/.openspec-dashboard/` is written
