# Design

## Context

See proposal.md for why. What exists after `macos-desktop-app`:

- `desktop/electrobun.config.ts` sets `mac.codesign` only when `ELECTROBUN_DEVELOPER_ID` is set, and `mac.notarize`
  only when the API key is set as well. Without them Electrobun builds the app without signing it.
- A stable Electrobun build has two bundles. The real app is in the build folder and is compressed into the bundle's
  payload. The disk image holds a small self-extracting wrapper `.app`, which unpacks the real app on first launch.
  Build hooks run between these steps:
  - `postBuild` runs after the real app is assembled (`ELECTROBUN_BUILD_DIR`);
  - `postWrap` runs after the wrapper is made (`ELECTROBUN_WRAPPER_BUNDLE_PATH`);
  - `postPackage` runs after the disk image is made.
- Apple silicon runs no unsigned code at all. An ad-hoc signature (`codesign --sign -`) is enough to run it and needs
  no certificate. Gatekeeper still blocks a quarantined download that has no Developer ID signature and no
  notarisation, until the user removes the quarantine attribute or chooses **Open Anyway**.
- The bundled `spec-control` binary is already ad-hoc signed by Bun's compiler, as the published macOS binaries are.

## Goals / Non-Goals

**Goals:**
- Release the app with no Apple account or secret, and fail the release if its signature is broken.
- Keep Developer ID signing available, switched on only by the presence of its credentials.

**Non-Goals:**
- Changing how the app behaves, or how it is unpacked on first launch.
- Homebrew cask or any other channel that would avoid quarantine.

## Decisions

### D1. Ad-hoc sign in the build hooks, only when no Developer ID is configured
A script `desktop/scripts/adhoc-sign.ts` runs as both `postBuild` and `postWrap`. Each time, it runs
`codesign --force --deep --sign - <bundle>` on the bundle that step produced:

- for `postBuild`, the `.app` under `ELECTROBUN_BUILD_DIR`;
- for `postWrap`, `ELECTROBUN_WRAPPER_BUNDLE_PATH`.

So both the app that ends up compressed in the payload and the wrapper in the disk image carry a valid signature. When
`ELECTROBUN_DEVELOPER_ID` is set, the script does nothing, and Electrobun's own signing and notarisation take over.

Alternatives:
- *Re-sign after packaging.* This would mean mounting, copying and rebuilding the disk image, which duplicates
  Electrobun's packaging. It would also miss the inner app, which is already compressed by then.
- *Rely on the linker's ad-hoc signature.* That covers single executables only. A bundle with resources needs a
  bundle signature for `codesign --verify --deep --strict` to pass, and Gatekeeper's assessment of an ad-hoc app
  depends on it too.

### D2. Verify with `codesign`, not Gatekeeper
The smoke step mounts the disk image and runs `codesign --verify --deep --strict --verbose=2` on `Spec Control.app`. It
keeps the bundled binary's `--version` check. `spctl --assess` would reject every ad-hoc app, and there is no
notarisation ticket to staple or validate.

### D3. No environment, no secrets
The `desktop` job loses `environment: release`, the keychain import, the API-key file and their clean-up. It reads no
`secrets.*`, so it behaves the same in a fork. Nothing in the job needs write scopes: the publish job still does all
attaching.

### D4. Documentation names one first-open route and one fallback
The README and the release notes give the command `xattr -dr com.apple.quarantine "/Applications/Spec Control.app"`
first, because it works on every macOS version. They also name **System Settings → Privacy & Security → Open Anyway**,
for users who avoid the terminal. The app unpacks itself into a managed location on first launch, so the attribute
only has to be removed once, from the copy in Applications.

## Risks / Trade-offs

- **The first open needs a workaround again.** That is the friction the app was meant to remove for macOS users. →
  Accepted by the maintainer in exchange for no Apple membership. The README says so plainly, and a Developer ID
  signature can return in a later change by adding the secrets.
- **Electrobun's hook environment is documented but unverified here.** → The script fails loudly when the path it
  expects is missing, and the workflow's `codesign --verify` would catch an unsigned bundle anyway.
- **Quarantine on the extracted app.** If the self-extractor passes the quarantine attribute on to the app it unpacks,
  a second prompt could appear. → To be checked when the first release is tested on a clean Mac (tasks); if it does,
  the README names the managed location as well.

## Migration Plan

No app has been released yet, so no user is affected. Once this is merged, the next published release attaches the
ad-hoc signed app. To roll back to Developer ID signing, add the secrets and revert this change's workflow and
documentation edits.
