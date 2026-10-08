## ADDED Requirements

### Requirement: The disk image shows how to install the app
The app SHALL be distributed as a disk image whose volume is named **Spec Control**, carries the app's icon and holds the app, a link to `/Applications` and the window layout, and nothing else visible. Opened in Finder, the volume's window SHALL show an icon view at a fixed size with no toolbar, status bar or sidebar, the app on the left and the `Applications` link on the right, over a background with an arrow from the app to `Applications` and the line "Drag Spec Control to Applications to install it." The background SHALL be generated when the app is built, at the window's size and at twice that size for Retina displays; no image file SHALL be checked in for it. Laying out the disk image MUST NOT change the app it holds: its files, its code signature and how it is unpacked on first launch SHALL be exactly what the app build produced. A build signed with a Developer ID SHALL keep the disk image the app build produced, unstyled, rather than lose its signature or notarisation. When the layout cannot be produced, the build SHALL fail and say why, instead of leaving an unstyled image in its place.

#### Scenario: Opening the downloaded disk image
- **WHEN** a user opens `Spec-Control-v0.4.0-darwin-arm64.dmg` in Finder
- **THEN** a window titled Spec Control shows the app icon, an arrow and the Applications folder, with the line telling them to drag the app to Applications

#### Scenario: Installing by dragging
- **WHEN** the user drags Spec Control onto the Applications folder in that window
- **THEN** the app is copied to `/Applications/Spec Control.app` and opens from there like any other copy of it

#### Scenario: The app inside is unchanged
- **WHEN** the app is taken out of the styled disk image
- **THEN** it has the same files as the app the build packaged and passes `codesign --verify --deep --strict`

#### Scenario: Finder cannot lay out the volume
- **WHEN** a local build runs in a terminal that is not allowed to control Finder
- **THEN** the build fails with a message saying to allow the terminal to control Finder, and no unstyled image replaces the styled one silently
