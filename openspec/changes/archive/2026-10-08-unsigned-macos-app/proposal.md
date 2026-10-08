# Proposal

## Why

`macos-desktop-app` releases the app signed with a Developer ID and notarised by Apple. That needs a paid Apple
Developer Program membership and six signing secrets, and without them the release workflow fails and attaches nothing
at all, not even the command-line binaries. The project does not want that dependency. The macOS binaries are already
published unnotarised, so the app can follow the same model: ad-hoc signed, which Apple silicon needs to run it, and
opened once through the documented quarantine workaround.

## What Changes

- The release workflow's `desktop` job builds the app **ad-hoc signed and not notarised**. It needs no Apple account, no
  certificate, no API key and no `release` environment. The temporary keychain and API-key steps are removed.
- The checks that a notarised app passes (`spctl --assess`, `xcrun stapler validate`) are replaced by
  `codesign --verify --deep --strict` on the app in the disk image. The check that the bundled binary's `--version` is
  the tag stays. A failure still attaches nothing.
- README, the release notes' Download section and CONTRIBUTING say that the app is not notarised, like the binaries,
  and how to open it the first time: `xattr -dr com.apple.quarantine "/Applications/Spec Control.app"`, or
  **Open Anyway** in System Settings → Privacy & Security. CONTRIBUTING drops the list of signing secrets.
- Developer ID signing stays possible later without code changes: the app build still signs and notarises when
  `ELECTROBUN_DEVELOPER_ID` and the API key are set. Going back to it would be a change of its own, which reverts this spec.
- **BREAKING** for nobody: no release with the app has been published yet.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `release-publishing`: the macOS app is attached ad-hoc signed and not notarised, verified with `codesign --verify`
  instead of Gatekeeper and stapler checks, and needs no signing secrets. The documentation describes the app's
  first-open workaround instead of the secrets.

## Impact

- `.github/workflows/release.yml`: the `desktop` job (no environment, no secrets, ad-hoc signature check) and the
  release notes template.
- `desktop/electrobun.config.ts`, `desktop/scripts/`: an ad-hoc signature when no Developer ID is configured.
- `README.md`, `CONTRIBUTING.md`.
- No change to the server, the app's behaviour or the CLI binaries.
