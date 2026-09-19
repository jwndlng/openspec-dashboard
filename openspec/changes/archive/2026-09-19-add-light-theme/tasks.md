## 1. Tokens and stylesheet

- [x] 1.1 In `src/ui/styles.css`, add a `--danger-bg` token (`#3d001522`) to the `:root` block and use it for the `.notice.danger` background instead of the literal colour
- [x] 1.2 Add `color-scheme: dark` to the `:root` block and update the header comment to describe both themes
- [x] 1.3 Add a `:root[data-theme="light"]` block overriding every colour token with the light values from design.md D6, plus `color-scheme: light`
- [x] 1.4 Grep `styles.css` for colour literals (`#`, `rgb`, `hsl`) outside the two token blocks and replace any found with tokens

## 2. Theme module

- [x] 2.1 Create `src/ui/theme.ts` exporting `THEME_STORAGE_KEY` (`openspec-dashboard.theme`) and the `ThemePreference` (`system | light | dark`) and `Theme` (`light | dark`) types
- [x] 2.2 Implement pure functions `parsePreference(raw)`, `resolveTheme(pref, systemPrefersDark)` and `nextPreference(pref)` (cycle `system → light → dark → system`)
- [x] 2.3 Implement `loadPreference()` and `savePreference(pref)` with `localStorage` access wrapped in try/catch (`system` removes the key), and `applyTheme(theme)` setting `document.documentElement.dataset.theme`
- [x] 2.4 Add `test/theme.test.ts` covering `parsePreference` (valid, null, unrecognised value), `resolveTheme` (all preference × system combinations) and `nextPreference` (full cycle)

## 3. Top bar control

- [x] 3.1 In `src/ui/app.tsx`, hold the theme preference in state initialised from `loadPreference()` and apply the resolved theme in an effect
- [x] 3.2 While the preference is `system`, subscribe to `matchMedia("(prefers-color-scheme: dark)")` `change` events and re-apply the theme; unsubscribe on cleanup or when the preference becomes explicit
- [x] 3.3 Add a `btn sm ghost` button in the top bar, before the status area, labelled `Theme: System|Light|Dark` with a `title` explaining it cycles; on click, advance with `nextPreference`, save, and update state

## 4. HTML shell

- [x] 4.1 In `scripts/build-ui.ts`, change the `color-scheme` meta to `light dark`
- [x] 4.2 Emit an inline classic `<script>` in `<head>` before the `<style>` tag that reads `THEME_STORAGE_KEY` (imported from `src/ui/theme.ts`), falls back to `matchMedia`, and sets `data-theme` on `<html>`, all inside try/catch

## 5. Verification and docs

- [x] 5.1 Check contrast of `--fg-heading`, `--fg-body`, `--fg-subtle`, `--brand-fg`, `--success`, `--warning` and `--danger` in the light set against `--bg-base`, `--bg-section` and `--bg-raised`; adjust any value below 4.5:1 and keep design.md D6 and the `kanban-board` delta spec in sync if a value changes
- [x] 5.2 Run `bun run dev` and check the board and settings pages in both themes: columns, cards, badges, meters, chips, inputs, checkboxes, notices, empty state, save bar, scrollbars
- [x] 5.3 Verify behaviour: the control cycles correctly, the choice survives reload, `System` follows a live OS appearance change, and reloading with `Light` stored on a dark OS shows no dark flash
- [x] 5.4 Confirm the dark theme is visually unchanged against `main`
- [x] 5.5 Run `bun test` and `bun run typecheck`
- [x] 5.6 Mention the theme control and its browser-local persistence in `README.md`
