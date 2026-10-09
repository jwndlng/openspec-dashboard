# Tasks

## 1. Layout

- [x] 1.1 Let `desktop/scripts/rasterise.swift` take `<width>x<height>` as well as a square size (D4); verify `bun run --cwd desktop prepare-assets` still produces the same icon sizes and a 640x400 test SVG rasterises to 640×400 pixels
- [x] 1.2 Add `desktop/scripts/dmgLayout.ts` (D4, D7): window size, icon size and positions, `backgroundSvg()`, `appleScriptString()` and `finderLayoutScript()`, with no side effects; verify with `test/desktop/dmgLayout.test.ts` (icons inside the window and apart, arrow between them, the script names the volume, app and `.background:background.tiff`, quotes escaped) and `bun run check`

## 2. Styling step

- [x] 2.1 Add `desktop/scripts/style-dmg.ts` (D1–D6): skip for a Developer ID build or a non-macOS build; require exactly one `.dmg` in `ELECTROBUN_ARTIFACT_DIR`; refuse when `/Volumes/Spec Control` exists; copy the app out with `ditto`; stage the `Applications` link and the 1x+2x background TIFF; create the writable image; set the volume icon; lay out with Finder (three attempts, wait for `.DS_Store`); convert to the original format in place; mount the result and check the app, `Applications`, background, `.DS_Store` and `codesign --verify --deep --strict`; detach every image it attached, also on failure. Verify by running it on a copy of a built image
- [x] 2.2 Register it as `postPackage` in `desktop/electrobun.config.ts`; verify `bun run build:desktop` on an Apple silicon Mac ends with `style-dmg: styled …` and the image under `desktop/artifacts/` opens as the laid-out window
- [~] 2.3 Check by eye in Finder, in both Light and Dark Mode: icons and arrow line up, the instruction line is readable, the volume shows the app icon, and dragging to Applications installs an app that launches; adjust the background colours if the labels are hard to read
- [x] 2.4 Verify the app is unchanged: the app copied out of the styled image and the one in Electrobun's original image compare equal (`diff -r`) and both pass `codesign --verify --deep --strict`

## 3. Release workflow

- [x] 3.1 In `.github/workflows/release.yml`, make the `desktop` job's smoke test also require `.DS_Store` and `.background/background.tiff` in the mounted image (D6, release-publishing); verify the YAML parses and the step fails on an unstyled image (Electrobun's original)
- [x] 3.2 Verify on GitHub's `macos-latest` before merging: a throwaway workflow on this branch runs `bun run build:desktop` and uploads the `.dmg`; it succeeds, and the downloaded image opens laid out. Remove the throwaway workflow before merging

## 4. Documentation

- [x] 4.1 CONTRIBUTING (Releasing): the `desktop` job lays out the disk image and checks the layout; a local `bun run build:desktop` lays it out too, needs the terminal allowed to control Finder once, and refuses while a `Spec Control` volume is mounted; verify by reading
- [x] 4.2 Add a What's new entry at the top of `src/ui/changelog.ts`: the macOS app's disk image now shows how to install it by dragging it to Applications; verify `bun test test/whatsNew.test.ts`
- [x] 4.3 Verify `openspec validate styled-dmg-installer --strict` and `bun run check` pass
