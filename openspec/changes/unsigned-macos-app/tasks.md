# Tasks

## 1. Ad-hoc signature

- [x] 1.1 Add `desktop/scripts/adhoc-sign.ts` (run as `postBuild` and `postWrap`; `codesign --force --deep --sign -` on the bundle that step produced; nothing when `ELECTROBUN_DEVELOPER_ID` is set; fails when the expected bundle is missing) and register it in `desktop/electrobun.config.ts` `scripts`; verify by reading and with `bun run check`
- [~] 1.2 Verify on an Apple silicon Mac: `bun run build:desktop` produces a disk image whose app passes `codesign --verify --deep --strict` and launches after `xattr -dr com.apple.quarantine`

## 2. Release workflow

- [x] 2.1 In `.github/workflows/release.yml`, remove `environment: release`, the certificate and API-key steps and their clean-up from the `desktop` job; replace `spctl --assess` and `xcrun stapler validate` with `codesign --verify --deep --strict` on the mounted app; keep the bundled `--version` check; verify the YAML parses and no `secrets.` reference remains
- [x] 2.2 Update the release notes template: the app is not notarised, with the `xattr -dr` command and Open Anyway; verify by reading
- [~] 2.3 Verify by publishing the next release: the `.dmg` is attached, and on a clean Apple silicon Mac the app opens after the documented workaround

## 3. Documentation

- [x] 3.1 README Run section: neither the app nor the macOS binaries are notarised; the first-open workaround for the app; drop "signed and notarised"; verify against the release-publishing scenarios
- [x] 3.2 CONTRIBUTING Releasing: the `desktop` job builds an ad-hoc signed app and needs no secrets; drop the secrets list; local builds unchanged; verify by reading
- [x] 3.3 Verify `openspec validate unsigned-macos-app --strict` and `bun run check` pass
