## Context

The UI is a Preact SPA built by `scripts/build-ui.ts` into one self-contained `index.html` (JS, CSS and fonts inlined) that the server embeds in the compiled binary. All colours live as CSS custom properties in a single `:root` block in `src/ui/styles.css`; components reference only tokens, with one exception (`.notice.danger` uses a literal `#3d001522` background). The HTML shell declares `<meta name="color-scheme" content="dark">`. There is no client-side persistence today other than filters in the URL query string, and the server config (`Config`) holds only scanning concerns.

Constraints: must keep working offline from a single file, no new dependencies, and the dark theme must look exactly as it does now.

## Goals / Non-Goals

**Goals:**
- A light theme that is a pure token swap: no component CSS forks per theme.
- Default to the OS appearance; allow an explicit override that survives reloads.
- No flash of the wrong theme on load.
- Text and status colours in the light theme meet WCAG AA (4.5:1) on the backgrounds they are used on.

**Non-Goals:**
- User-defined or additional themes, accent-colour pickers, high-contrast mode.
- Storing the theme in the server config file or syncing it across browsers.
- Per-route or per-component theming.
- Redesigning layout, spacing, typography or the dark palette.

## Decisions

### D1: Theme is selected by a `data-theme` attribute on `<html>`, always set by JS
`:root` keeps the dark tokens (the default), and `:root[data-theme="light"]` overrides the colour tokens. JS always writes the *resolved* theme (`"light"` or `"dark"`) to `document.documentElement.dataset.theme`.

*Alternative considered:* `@media (prefers-color-scheme: light)` for the system default plus `[data-theme]` overrides. Plain CSS has no mixins, so the light block would have to be written twice (once in the media query, once under `[data-theme="light"]`) and kept in sync by hand. The app cannot render without JS anyway, so resolving in JS costs nothing and keeps a single light block.

Each theme block also sets the CSS `color-scheme` property (`dark` / `light`) so native checkboxes, number inputs and scrollbars match. The meta tag becomes `content="light dark"`.

### D2: Preference model is `system | light | dark`, stored in `localStorage`
Key: `openspec-dashboard.theme`. Values `"light"` or `"dark"`; choosing `System` removes the key. Anything else read from storage is treated as `system`.

*Alternatives considered:* (a) server `Config` — rejected: theme is a per-browser display preference, the config file is about what to scan, and it would add an API round-trip before first paint. (b) URL query string like the filters — rejected: a theme is not part of a shareable board view, and links pasted to others should not force their appearance.

`localStorage` access is wrapped in try/catch; if it is unavailable the dashboard behaves as `system` and the control still works for the current page session.

### D3: A new `src/ui/theme.ts` module with pure logic separated from DOM effects
Pure, unit-testable functions: `parsePreference(raw: string | null): ThemePreference`, `resolveTheme(pref, systemPrefersDark): "light" | "dark"`, `nextPreference(pref)` (cycle order `system → light → dark → system`). Thin effectful functions: `loadPreference()`, `savePreference(pref)`, `applyTheme(resolved)`. It also exports the storage key constant. `bun test` has no DOM, so tests cover the pure functions only.

`App` holds the preference in state, applies the theme in an effect, and while the preference is `system` subscribes to `matchMedia("(prefers-color-scheme: dark)")` `change` events so an OS switch is reflected live.

### D4: Flash prevention via a tiny inline script in `<head>`
`build-ui.ts` emits a classic (non-module, render-blocking) inline `<script>` before the `<style>` tag that reads the storage key, falls back to `matchMedia`, and sets `data-theme`, all inside try/catch. The module bundle is deferred by nature, so without this a light-theme user would see a dark frame first. The build script imports the storage key constant from `theme.ts` so the two cannot drift; the resolution logic is three lines and is intentionally duplicated rather than bundled separately.

### D5: Control is a single text-labelled cycling button in the top bar
A `btn sm ghost` button left of the status area showing `Theme: System` / `Theme: Light` / `Theme: Dark`, with a `title` explaining that clicking cycles. It follows the existing design rule that state is never conveyed by colour or icon alone, and it takes far less top-bar space than a three-segment control.

*Alternative considered:* a panel on the Settings page. Rejected: Settings has an explicit save bar tied to the server config, and mixing an instant, browser-local preference into it would be confusing.

### D6: Light palette
Same token names; only colour tokens are overridden (radius, gaps and fonts are shared). Surface hierarchy mirrors dark: page → section (top bar, columns, panels) → raised (cards, buttons) → surface (hover, meter track) → elevated.

| Token | Dark (unchanged) | Light |
|---|---|---|
| `--bg-base` | `#080d16` | `#f6f8fb` |
| `--bg-section` | `#0e1524` | `#edf1f6` |
| `--bg-raised` | `#111c30` | `#ffffff` |
| `--bg-surface` | `#1a2640` | `#e1e7ef` |
| `--bg-elevated` | `#243350` | `#d3dbe6` |
| `--fg-heading` | `#f0f5fa` | `#0f1a2b` |
| `--fg-body` | `#8a9bb5` | `#42526b` |
| `--fg-subtle` | `#6a7a94` | `#5c6b84` |
| `--fg-disabled` | `#3a4a64` | `#a3afc2` |
| `--brand` | `#71c7c5` | `#1f8a88` |
| `--brand-strong` | `#4a9b99` | `#176f6d` |
| `--brand-fg` | `#9ddcdb` | `#0f5f5d` |
| `--brand-soft` | `#164040` | `#b5e0df` |
| `--brand-softer` | `#0c2424` | `#e2f4f3` |
| `--success` / `-border` | `#10b981` / `#004f3b` | `#047857` / `#a7e3cc` |
| `--warning` / `-strong` / `-border` | `#fbbf24` / `#ff8c42` / `#7c2d12` | `#a84d08` / `#c2410c` / `#f5cfa0` |
| `--danger` / `-border` | `#ff2d6b` / `#6b0028` | `#c81e4a` / `#f5b5c5` |
| `--danger-bg` (new) | `#3d001522` | `#fdecef` |
| `--border` | `#71c7c52e` | `#0f5f5d33` |
| `--border-light` | `#71c7c514` | `#0f5f5d1f` |
| `--border-subtle` | `#1a2640` | `#e1e7ef` |
| `--border-strong` | `#71c7c56b` | `#0f5f5d80` |

The teal brand is darkened in light mode because `#71c7c5` on white is roughly 2:1. The light values are the starting point; the implementation verifies contrast and may nudge a value, keeping the hue family. `.btn.primary:hover` (`--bg-base` text on `--brand-strong`) works in both themes because both tokens invert together.

## Risks / Trade-offs

- [A future style uses a literal colour and looks wrong in one theme] → The spec requires components to use tokens only; a task greps `styles.css` for colour literals outside the token blocks.
- [Light values fail AA on some background combination, e.g. `--fg-subtle` on `--bg-section`] → A verification task checks each text/status token against the backgrounds it is actually used on and adjusts.
- [Inline script and `theme.ts` resolution logic drift] → Shared key constant, trivially small logic, and a manual check that reload in each mode shows no flash.
- [`localStorage` blocked (private mode, policy)] → try/catch; degrades to system preference with a working in-session toggle.
- [Cycling button needs up to two clicks to reach a given mode] → Accepted for top-bar compactness; only three states.

## Migration Plan

Pure additive UI change. Existing users have no stored preference, so they get `system`: dark-OS users see no change; light-OS users see the new light theme and can pin `Dark` with two clicks. Rollback is reverting the commit; a leftover `localStorage` key is harmless.

## Open Questions

None blocking.
