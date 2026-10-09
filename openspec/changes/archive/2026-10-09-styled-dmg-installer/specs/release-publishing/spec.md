## MODIFIED Requirements

### Requirement: Publishing a release attaches verified binaries
When a release whose tag starts with `v` is published, the release workflow SHALL build the single binary from that tag for `darwin-arm64`, `darwin-x64`, `linux-x64` and `linux-arm64`, each on a runner of that platform, and SHALL attach them to the release as `spec-control-<tag>-<platform>`. From the same tag it SHALL also build the macOS desktop app (`desktop-app` capability) for `darwin-arm64`, bundling the `darwin-arm64` binary built in the same run, with an ad-hoc code signature and without notarisation, and SHALL attach it as `Spec-Control-<tag>-darwin-arm64.dmg`. A `SHA256SUMS` file SHALL cover every attached binary and disk image. Each binary and disk image SHALL have a GitHub build-provenance attestation. Before anything is attached, each binary MUST run successfully with `--help`, and `--version` MUST print exactly the release tag; the binary inside the app MUST likewise print exactly the release tag, the app in the disk image MUST pass a strict, deep verification of its code signature, and the disk image MUST hold the installer layout of the `desktop-app` capability (the `Applications` link, the background and Finder's layout file). If any platform fails to build or verify, nothing SHALL be attached. After attaching, the workflow SHALL append to the release notes a section naming the downloads, showing how to verify a download's checksum and attestation, and saying that the app and the macOS binaries are not notarised and how to open them. A draft release, or a release whose tag does not start with `v`, SHALL trigger no build. The workflow SHALL need no Apple account, signing certificate or other signing credential, and no secret beyond the token GitHub provides to the run.

#### Scenario: Publishing the draft
- **WHEN** the maintainer publishes the draft release `v0.4.0`
- **THEN** the release gains `spec-control-v0.4.0-darwin-arm64`, `-darwin-x64`, `-linux-x64`, `-linux-arm64`, `Spec-Control-v0.4.0-darwin-arm64.dmg` and `SHA256SUMS`, each binary and disk image has a provenance attestation, and the notes end with download and verification instructions

#### Scenario: Version mismatch blocks the upload
- **WHEN** a binary built for release `v0.4.0` prints anything other than `v0.4.0` for `--version`
- **THEN** the workflow fails and no file is attached to the release

#### Scenario: One platform fails
- **WHEN** the `linux-arm64` build fails while the others succeed
- **THEN** no binary, no disk image and no `SHA256SUMS` are attached

#### Scenario: Broken app signature blocks the upload
- **WHEN** the app in the disk image fails `codesign --verify --deep --strict`
- **THEN** the workflow fails and nothing is attached to the release

#### Scenario: Unstyled disk image blocks the upload
- **WHEN** the disk image the `desktop` job built has no background or no Finder layout file
- **THEN** the workflow fails and nothing is attached to the release

#### Scenario: No signing secrets
- **WHEN** the repository has no Apple certificate, API key or other signing secret configured and a release is published
- **THEN** the app is built, verified and attached like the binaries

#### Scenario: Checksums match
- **WHEN** a user downloads a binary or disk image and `SHA256SUMS` from a release and runs `shasum -a 256 -c` on the line for that file
- **THEN** the check passes

#### Scenario: Non-version tag
- **WHEN** a release tagged `nightly-test` is published
- **THEN** the release workflow builds nothing and attaches nothing
