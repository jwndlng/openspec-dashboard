# Spec Delta

## Purpose

Defines how this project's releases are made: pull requests labelled from their Conventional Commit titles, a draft
GitHub release kept current from `main`, and what publishing that draft builds, verifies and attaches — the
single-binary downloads — together with the version the binary reports.

## ADDED Requirements

### Requirement: Pull requests are labelled from their title
Every pull request SHALL be labelled from the Conventional Commit type in its title whenever it is opened, edited, reopened or updated: `feat` with `feat`, `fix` with `fix`, `docs` with `docs`, and `chore`, `refactor`, `test`, `style`, `ci`, `build` and `perf` each with a label of the same name. Labels added by hand, including `major`, SHALL be left in place. The labelling job MUST NOT check out or run code from the pull request.

#### Scenario: Feature title gets the feature label
- **WHEN** a pull request titled `feat(board): group by owner` is opened
- **THEN** it carries the label `feat`

#### Scenario: Scoped maintenance title
- **WHEN** a pull request titled `chore(openspec): archive demo-change` is opened
- **THEN** it carries the label `chore`

#### Scenario: Retitled pull request
- **WHEN** a pull request's title is edited from `chore: tweak` to `fix: tweak`
- **THEN** it carries the label `fix` after the edit

#### Scenario: Fork pull request
- **WHEN** a pull request is opened from a fork
- **THEN** it is labelled the same way and no code from the fork is executed

### Requirement: A draft release is kept current
Each push to `main` SHALL create or update a single draft GitHub release whose notes list every pull request merged since the last published release as `- <title> @<author> (#<number>)`, grouped under **Features** (`feat`), **Bug Fixes** (`fix`), **Maintenance** (`chore`, `refactor`, `style`, `perf`, `test`, `ci`, `build`) and **Documentation** (`docs`); pull requests with none of these labels SHALL still be listed. The draft's name and tag SHALL be `v<major>.<minor>.<patch>`, resolved from the last published release: a `major` label bumps major, otherwise any `feat` bumps minor, otherwise patch. Updating the draft MUST NOT publish it, create a git tag or build anything.

#### Scenario: Merged fix after a feature
- **WHEN** the last published release is `v0.3.1` and pull requests labelled `feat` and `fix` have been merged since
- **THEN** the draft is named and tagged `v0.4.0` and lists the first under Features and the second under Bug Fixes

#### Scenario: Only maintenance merged
- **WHEN** the last published release is `v0.3.1` and only a `chore` pull request has been merged since
- **THEN** the draft is tagged `v0.3.2`

#### Scenario: Breaking change marked by hand
- **WHEN** a merged pull request since `v0.3.1` carries the label `major`
- **THEN** the draft is tagged `v1.0.0`

#### Scenario: Draft stays a draft
- **WHEN** a pull request is merged to `main`
- **THEN** the draft release is updated, no release is published and no tag is pushed

### Requirement: Publishing a release attaches verified binaries
When a release whose tag starts with `v` is published, the release workflow SHALL build the single binary from that tag for `darwin-arm64`, `darwin-x64`, `linux-x64` and `linux-arm64`, each on a runner of that platform, and SHALL attach them to the release as `openspec-dashboard-<tag>-<platform>`, together with a `SHA256SUMS` file covering every attached binary. Each binary SHALL have a GitHub build-provenance attestation. Before anything is attached, each binary MUST run successfully with `--help`, and `--version` MUST print exactly the release tag; if any platform fails to build or verify, nothing SHALL be attached. After attaching, the workflow SHALL append to the release notes a section naming the downloads and showing how to verify a download's checksum and attestation. A draft release, or a release whose tag does not start with `v`, SHALL trigger no build.

#### Scenario: Publishing the draft
- **WHEN** the maintainer publishes the draft release `v0.4.0`
- **THEN** the release gains `openspec-dashboard-v0.4.0-darwin-arm64`, `-darwin-x64`, `-linux-x64`, `-linux-arm64` and `SHA256SUMS`, each binary has a provenance attestation, and the notes end with download and verification instructions

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
`openspec-dashboard --version` SHALL print the version the binary was built as and exit with status 0 without starting the server, opening a browser or reading configuration. A binary built by the release workflow SHALL report its release tag (for example `v0.4.0`); any other build, including `bun run dev` and a local `bun run build`, SHALL report `dev`. The `--help` output SHALL list `--version`.

#### Scenario: Release binary
- **WHEN** the binary attached to release `v0.4.0` is run with `--version`
- **THEN** it prints `v0.4.0` and exits 0

#### Scenario: Local build
- **WHEN** a contributor runs `bun run build` and then `./dist/openspec-dashboard --version`
- **THEN** it prints `dev` and exits 0

#### Scenario: No side effects
- **WHEN** `--version` is passed
- **THEN** no port is bound, no browser is opened and nothing under `~/.openspec-dashboard/` is written

### Requirement: Releasing is documented
`CONTRIBUTING.md` SHALL describe how a release is made — labels come from pull request titles, the draft is updated on every merge to `main`, the maintainer reviews and publishes it, publishing builds and attaches the binaries, and a `major` label forces a major bump — and `README.md` SHALL point to the releases page for downloading a binary, including how to verify it and that the macOS binary is not notarised.

#### Scenario: Contributor looks for how to release
- **WHEN** a contributor reads `CONTRIBUTING.md`
- **THEN** a Releasing section explains the draft, the version rules and that publishing the draft is the only manual step

#### Scenario: User wants a binary
- **WHEN** a user reads the **Run** section of `README.md`
- **THEN** it links to the releases page and explains checksum verification and the macOS quarantine prompt
