# Proposal

## Why

The app's disk image opens as a plain Finder list of `Spec Control.app` and an `Applications` link, with nothing that
says what to do. Most Mac apps open their disk image as a laid-out window instead: the app and the Applications folder
side by side over a picture with an arrow, so that dragging one onto the other is obviously the install. The README
already says "open it and drag **Spec Control** to Applications"; the disk image should say the same thing itself.
Electrobun 2.0.2, which builds the image, has no setting for any of this (only `createDmg` on or off).

## What Changes

- The `.dmg` the desktop build produces opens as a **styled installer window**: icon view at a fixed size, no toolbar,
  status bar or sidebar, the app on the left and the `Applications` link on the right at fixed positions, over a
  background with an arrow from one to the other and the line "Drag Spec Control to Applications to install it." The
  volume is named **Spec Control** and carries the app's icon.
- A new build step runs after Electrobun has packaged the image (its `postPackage` hook). It takes the app out of
  Electrobun's image **unchanged** (same bytes, same ad-hoc signature, same self-extracting wrapper), builds a new image
  around it with the layout, converts it back to Electrobun's compressed format in place of the original and checks the
  result. The background is drawn at build time from an SVG, like the app and menu bar icons, so no image is checked in.
  Only macOS's own tools are used; no dependency is added.
- The release workflow's smoke test also checks that the disk image holds the layout (Finder's `.DS_Store`, the
  background and the `Applications` link), so an unstyled image is never attached.
- A Developer ID build (`ELECTROBUN_DEVELOPER_ID` set) keeps Electrobun's own image unchanged, because rebuilding it
  would drop the image's signature and notarisation. Releases are not built that way today.
- Nothing about the app changes once it is installed: not what it runs, what it reads or writes, or what it contacts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `desktop-app`: a new requirement that the app is distributed as a disk image whose window shows how to install it by
  dragging, and that building that window changes nothing in the app it holds.
- `release-publishing`: the checks before anything is attached also require the disk image's installer layout.

## Impact

- `desktop/scripts/style-dmg.ts` (new): the `postPackage` step that rebuilds and checks the image.
- `desktop/scripts/dmgLayout.ts` (new): window size, icon positions, the background SVG and the Finder AppleScript, kept
  free of build steps so they can be tested.
- `desktop/scripts/rasterise.swift`: accepts `<width>x<height>` as well as a square size.
- `desktop/electrobun.config.ts`: registers the `postPackage` hook.
- `test/desktop/dmgLayout.test.ts` (new).
- `.github/workflows/release.yml`: the `desktop` job's smoke test checks the layout.
- `CONTRIBUTING.md`: a local desktop build needs the terminal to be allowed to control Finder once.
- No change to the server, the app's runtime behaviour, the CLI binaries or the README's install text, which already
  describes dragging the app to Applications.
