## MODIFIED Requirements

### Requirement: Publishing a release attaches verified binaries
When a release whose tag starts with `v` is published, the release workflow SHALL build the single binary from that tag for `darwin-arm64`, `darwin-x64`, `linux-x64` and `linux-arm64`, each on a runner of that platform, and SHALL attach them to the release as `spec-control-<tag>-<platform>`. From the same tag it SHALL also build the macOS desktop app (`desktop-app` capability) for `darwin-arm64`, bundling the `darwin-arm64` binary built in the same run, signed with the project's Developer ID and notarised by Apple with the notarisation ticket stapled, and SHALL attach it as `Spec-Control-<tag>-darwin-arm64.dmg`. A `SHA256SUMS` file SHALL cover every attached binary and disk image. Each binary and disk image SHALL have a GitHub build-provenance attestation. Before anything is attached, each binary MUST run successfully with `--help`, and `--version` MUST print exactly the release tag; the binary inside the app MUST likewise print exactly the release tag, and the app MUST pass Gatekeeper's assessment (`spctl --assess`) and the stapler's validation. If any platform fails to build, sign, notarise or verify, nothing SHALL be attached. After attaching, the workflow SHALL append to the release notes a section naming the downloads and showing how to verify a download's checksum and attestation. A draft release, or a release whose tag does not start with `v`, SHALL trigger no build. Signing credentials SHALL be read only from repository secrets in the job that signs, and MUST NOT be available to any job that runs pull-request code.

#### Scenario: Publishing the draft
- **WHEN** the maintainer publishes the draft release `v0.4.0`
- **THEN** the release gains `spec-control-v0.4.0-darwin-arm64`, `-darwin-x64`, `-linux-x64`, `-linux-arm64`, `Spec-Control-v0.4.0-darwin-arm64.dmg` and `SHA256SUMS`, each binary and disk image has a provenance attestation, and the notes end with download and verification instructions

#### Scenario: Version mismatch blocks the upload
- **WHEN** a binary built for release `v0.4.0` prints anything other than `v0.4.0` for `--version`
- **THEN** the workflow fails and no file is attached to the release

#### Scenario: One platform fails
- **WHEN** the `linux-arm64` build fails while the others succeed
- **THEN** no binary, no disk image and no `SHA256SUMS` are attached

#### Scenario: Notarisation fails
- **WHEN** Apple rejects the notarisation of the app
- **THEN** the workflow fails and nothing is attached to the release

#### Scenario: Downloaded app opens without a quarantine workaround
- **WHEN** a user downloads `Spec-Control-v0.4.0-darwin-arm64.dmg`, drags the app to Applications and opens it
- **THEN** macOS opens it after its standard first-open confirmation, without `xattr` or a security-settings override

#### Scenario: Checksums match
- **WHEN** a user downloads a binary or disk image and `SHA256SUMS` from a release and runs `shasum -a 256 -c` on the line for that file
- **THEN** the check passes

#### Scenario: Non-version tag
- **WHEN** a release tagged `nightly-test` is published
- **THEN** the release workflow builds nothing and attaches nothing

### Requirement: Releasing is documented
`CONTRIBUTING.md` SHALL describe how a release is made — labels come from pull request titles, the draft is updated on every merge to `main`, the maintainer reviews and publishes it, publishing builds and attaches the binaries and the signed macOS app (Apple silicon only; Intel Macs use the binary), and a `major` label forces a major bump — together with the repository secrets the macOS signing and notarisation need. `README.md` SHALL point to the releases page for downloading the macOS app or a binary, including how to verify a download, that the macOS app is signed and notarised while the bare macOS binary is not, and that a new app version is installed by downloading it from the releases page.

#### Scenario: Contributor looks for how to release
- **WHEN** a contributor reads `CONTRIBUTING.md`
- **THEN** a Releasing section explains the draft, the version rules, that publishing the draft is the only manual step, and which secrets the macOS app job needs

#### Scenario: User wants a binary
- **WHEN** a user reads the **Run** section of `README.md`
- **THEN** it links to the releases page, offers the macOS app first on Apple silicon Macs and the binary on Intel Macs, and explains checksum verification, the bare binary's quarantine prompt and how to update the app
