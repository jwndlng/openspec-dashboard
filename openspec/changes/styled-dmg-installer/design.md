# Design

## Context

See proposal.md for why. What exists today:

- `electrobun build --env=stable` assembles the real app, compresses it into a self-extracting wrapper `.app`, and makes
  `desktop/artifacts/<…>.dmg` holding that wrapper and an `/Applications` link, in its compressed `ULFO` format.
  `adhoc-sign.ts` signs both bundles in the `postBuild` and `postWrap` hooks. A `postPackage` hook runs after the image
  exists and gets `ELECTROBUN_ARTIFACT_DIR`. There is no hook between staging the image's contents and creating it.
- Electrobun 2.0.2's only image option is `mac.createDmg`. Background, icon positions and window size are not
  configurable.
- Finder keeps a folder's window layout in its `.DS_Store`: window bounds, view options, the background picture (as an
  alias to a file on the same volume, so it resolves through the volume's name) and each icon's position.
- `prepare.ts` already draws images from SVG at build time with `rasterise.swift` (AppKit). AppKit's SVG renderer also
  draws text, which the background's one line needs; that was checked in a throwaway prototype.

## Goals / Non-Goals

**Goals:**
- A release `.dmg` that opens as the laid-out window of the `desktop-app` spec, with the app inside bit-for-bit what
  Electrobun packaged.
- The same result from `bun run build:desktop` on a developer's Mac and from the release workflow on `macos-latest`.
- Fail loudly rather than ship an unstyled image.

**Non-Goals:**
- An in-app "Move to Applications?" prompt, or the app moving itself.
- Styling a Developer ID build's image (it would need re-signing and re-notarising the image).
- A dark-mode variant of the background: Finder shows one picture whatever the appearance.

## Decisions

### D1. Rebuild Electrobun's image in the `postPackage` hook, around the app copied out of it
`desktop/scripts/style-dmg.ts` runs as `postPackage`. It mounts Electrobun's image read-only and copies the wrapper app
out with `ditto`, which keeps the signature, extended attributes and links. It then stages that app, an
`/Applications` link and `.background/background.tiff`, creates a writable HFS+ image from them, lays it out (D2),
converts it to the format `hdiutil imageinfo` reports for Electrobun's image, and replaces that image with it.

Alternatives:
- *Build the image ourselves and set `createDmg: false`.* We would then also own which app goes in it and how
  Electrobun names it, and we would drift from Electrobun's packaging when it changes. Copying the app out of
  Electrobun's own image keeps "what goes in" Electrobun's decision.
- *Style Electrobun's staging folder before it creates the image.* There is no hook at that point.

### D2. Finder lays out the window through AppleScript
With the writable image mounted at `/Volumes/Spec Control`, `osascript` tells Finder to open the disk, switch it to icon
view, hide the toolbar and status bar, set the bounds, icon size, text size, background picture and the two icons'
positions, then close, reopen and close the window. Finder then writes `.DS_Store` itself, in whatever form the running
macOS expects. The script waits for that file and tries up to three times before failing.

Alternatives:
- *`appdmg` (npm), which writes `.DS_Store` without Finder.* It is unmaintained since 2023 and depends on two native
  `node-gyp` add-ons (`macos-alias`, `fs-xattr`), which Bun only builds for trusted dependencies and may not load. That
  is a large build-time dependency for one file.
- *`dmgbuild` (Python).* It is robust and needs no Finder, but it would bring a Python toolchain and `pip` packages into
  a Bun-only build.
- *Writing `.DS_Store` and the background alias in our own code.* That is an undocumented binary format plus a
  classic alias record. Getting it subtly wrong shows no background on some macOS version, and we could not test that
  without Finder anyway.
- *A checked-in `.DS_Store`.* The alias inside it depends on the volume, and every layout change would mean editing a
  binary by hand.

The trade-off is that Finder must be scriptable where the build runs (see Risks).

### D3. The volume has its final name from the start, and a same-named mounted volume is refused
The background alias resolves through the volume's name, so the image is created as **Spec Control** and never
renamed. If `/Volumes/Spec Control` already exists, typically a previously opened image, the script stops and says
to eject it. Otherwise the new image would mount as `Spec Control 1`, and Finder would lay out the wrong volume. The
script checks that the writable image mounted at exactly `/Volumes/Spec Control`.

### D4. The background is an SVG drawn at build time, 1x and 2x in one TIFF
`desktop/scripts/dmgLayout.ts` holds the window size (640 × 400 points), the icon size (128) and positions, and
`backgroundSvg()`: a light gradient, a dotted arrow between the icon positions and the instruction line.
`rasterise.swift` learns `<width>x<height>`. `tiffutil -cathidpicheck` combines the 640 × 400 and 1280 × 800
renderings into one TIFF, from which Finder picks by screen scale. The ground is light and the colours are neutral
greys. Whether Finder's icon labels stay readable on it in Dark Mode is checked by eye (tasks).

### D5. The volume icon is the app's icon
After mounting, the wrapper's `Contents/Resources/AppIcon.icns` is copied to `.VolumeIcon.icns` on the volume, and
the root gets Finder's custom-icon flag (`com.apple.FinderInfo` with `0x0400`). Leading dots keep `.background` and
`.VolumeIcon.icns` out of the window.

### D6. Checked twice: by the script, and by the release workflow
Before it exits, the script mounts the final image and requires the app, `Applications`, the background and
`.DS_Store` to be there, and the app to pass `codesign --verify --deep --strict`. The release workflow's smoke test,
which already mounts the image for the signature check, also requires `.DS_Store` and `.background/background.tiff`,
so the `release-publishing` requirement is enforced where releases are made.

### D7. Testable parts are kept apart from the build steps
`dmgLayout.ts` has no side effects: constants, the SVG and the AppleScript text, including quoting of names into
AppleScript strings. `test/desktop/dmgLayout.test.ts` checks that the icons lie inside the window and do not overlap,
that the arrow runs between them, and that the script names the volume, the app and the background file and escapes
quotes. The root typecheck reaches it through the test.

## Risks / Trade-offs

- [Finder is not scriptable on the GitHub runner, or times out] → `macos-latest` runners have a logged-in GUI session
  in which create-dmg-style Finder scripting is commonly used, but this is verified before merging with a throwaway
  workflow on the branch (tasks). The script retries three times, and the job fails rather than attaching an unstyled
  image. If it proves unreliable, falling back to a `.DS_Store` writer (D2's alternatives) is a change of its own.
- [Local builds need Automation permission] → The first `bun run build:desktop` asks to let the terminal control
  Finder. The failure message names the setting, and CONTRIBUTING mentions it.
- [A previously opened image blocks the build] → D3's clear message. The script never ejects a volume it did not
  mount.
- [Finder briefly shows the window during a local build] → Accepted: it is what makes Finder write the layout.
- [Build time] → About 35 seconds locally in the prototype, mostly `hdiutil` and Finder's delay.
- [Electrobun changes its image's contents or format] → The script copies by the app's name, reads the format from
  the image, and fails if it finds anything other than exactly one `.dmg`.

## Migration Plan

None for users. The next release's image is styled. Rolling back means removing the `postPackage` hook.
