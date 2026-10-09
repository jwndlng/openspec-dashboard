# Spec Delta

## MODIFIED Requirements

### Requirement: Releasing is documented
`CONTRIBUTING.md` SHALL describe how a release is made — labels come from pull request titles, the draft is updated on every merge to `main`, the maintainer reviews and publishes it, publishing builds and attaches the binaries and the macOS app (Apple silicon only; Intel Macs use the binary), and a `major` label forces a major bump — and that the macOS app is ad-hoc signed and needs no signing secrets. `README.md` SHALL point to the releases page for downloading the macOS app or a binary, including how to verify a download, that neither the macOS app nor the macOS binaries are notarised, how to open the app the first time (removing the quarantine attribute, or **Open Anyway** in System Settings → Privacy & Security), and how to update: Spec Control announces a newer release with a banner unless the user turned **Check for new versions** off in Settings → Updates (or set `updateCheck: false`), the check sends nothing but one request to the releases page, and a new version is installed by quitting Spec Control (or the app), replacing the binary or dragging the new app over the old one in Applications, and starting it again — settings, sessions and worktrees stay in `~/.spec-control/`. The update banner's How to update link SHALL point to that part of the README.

#### Scenario: Contributor looks for how to release
- **WHEN** a contributor reads `CONTRIBUTING.md`
- **THEN** a Releasing section explains the draft, the version rules, that publishing the draft is the only manual step, and that the macOS app job needs no secrets

#### Scenario: User wants a binary
- **WHEN** a user reads the **Run** section of `README.md`
- **THEN** it links to the releases page, offers the macOS app first on Apple silicon Macs and the binary on Intel Macs, and explains checksum verification, the quarantine workaround for both the app and the bare binary, and how to update the app and the binary

#### Scenario: macOS refuses to open the downloaded app
- **WHEN** a user drags the app from `Spec-Control-v0.4.0-darwin-arm64.dmg` to Applications and macOS says it cannot verify the app
- **THEN** the README's Run section tells them how to open it anyway, with the `xattr` command and the System Settings route

#### Scenario: User follows How to update
- **WHEN** a user follows the banner's How to update link
- **THEN** the README explains how to replace the app or the binary, that their data stays in `~/.spec-control/`, what the check sends, and how to turn it off
