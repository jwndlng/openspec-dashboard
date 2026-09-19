## Why

The dashboard ships with a single dark token set. It is hard to read in bright rooms, on projectors and in screenshots pasted into light documents, and it ignores the operating system's appearance setting. Every colour already flows through CSS custom properties in one file, so adding a second palette is cheap now, before more hardcoded colours creep in.

## What Changes

- Add a light ("white") token set alongside the existing dark one, covering every colour token (backgrounds, foregrounds, brand, status, borders) with contrast-checked values.
- Follow the operating system's `prefers-color-scheme` by default, and react live when it changes.
- Add a theme control in the top bar that cycles `System` → `Light` → `Dark`, labelled with text (not icon-only).
- Persist the explicit choice in the browser (`localStorage`); `System` clears it. No server config or API change.
- Apply the stored theme before first paint so a light-theme user never sees a dark flash on load.
- Replace the one hardcoded colour in the stylesheet (`.notice.danger` background) with a token, and make the `color-scheme` meta tag advertise both schemes so native form controls and scrollbars match.
- The dark theme's appearance is unchanged.

## Capabilities

### New Capabilities
- `ui-theme`: Theme selection for the dashboard UI — available themes, system-preference default, the manual override control, persistence, and flash-free application on load.

### Modified Capabilities
- `kanban-board`: The "Visual design follows the dashboard token set" requirement currently mandates the dark token set only; it changes to require a dark and a light token set sharing the same token names, typography, radius and offline guarantee.

## Impact

- `src/ui/styles.css`: light token block, `color-scheme` per theme, one new token replacing a hardcoded colour.
- `src/ui/theme.ts` (new): preference read/write, resolution against `prefers-color-scheme`, applying `data-theme` to the root element.
- `src/ui/app.tsx`: theme control in the top bar.
- `scripts/build-ui.ts`: `color-scheme` meta becomes `light dark`; a small inline pre-paint script is added to the HTML shell.
- `test/`: unit tests for theme preference parsing and resolution.
- `README.md`: mention the theme control.
- No server, API, config-file or dependency changes. The UI remains a single self-contained offline HTML file.
