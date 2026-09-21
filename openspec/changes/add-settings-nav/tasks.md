## 1. Pure helpers

- [x] 1.1 Add `src/ui/settingsSections.ts` with the section id type/list (`roots`, `tracked`, `discovered`, `scanning`, `agents`, `shared-config`), `parseSection(query, knownIds)` / `serializeSection(query, id)` (keeps other query parameters, drops the parameter for the first section) and `currentSection(rects, viewport)` implementing design D4 (top-30% rule, last section at scroll end, empty input → undefined)
- [x] 1.2 Add `test/settingsSections.test.ts`: parsing valid/unknown/missing ids; serialising preserves other parameters and round-trips; `currentSection` for top of page, mid-page boundary, scrolled-to-end with short trailing sections, and a single section

## 2. Page structure

- [x] 2.1 In `src/ui/settings.tsx` build one `sections` array (`id`, `label`, `count?`, `attention?`, `content`) from the existing panels, `AgentSettings` and `SharedConfigPanel` (absent until `config` is loaded), and render the panels by mapping over it, each wrapped in `<div id="settings-<id>" class="settings-section" tabIndex={-1} aria-label={label}>`; no change to panel internals, the draft or the save bar
- [x] 2.2 Compute counts from the values the headings already use: `tracked` → `enabled/total`, `discovered` → untracked candidate count, `…` while discovering, `attention` when > 0
- [x] 2.3 Add the `SettingsNav` component: `<nav aria-label="Settings sections">` with a list of real links (`href` via `url.ts` + `serializeSection`), `aria-current="true"` on the current entry, count badge, attention styling with a non-colour cue; plain clicks intercepted, modified clicks left to the browser
- [x] 2.4 Wrap nav and `.settings` in `.settings-layout` so that only the sections column scrolls (design D3); confirm the save bar still spans the full width and stays pinned

## 3. Behaviour

- [x] 3.1 Jump: on activation set the entry current, `scrollIntoView({ block: "start" })` with smooth behaviour unless `prefers-reduced-motion: reduce`, then focus the section wrapper with `preventScroll`
- [x] 3.2 Track the section in view with a frame-throttled scroll listener on the scroll container feeding `currentSection` (design D4, changed from an `IntersectionObserver` during implementation); re-observe when the set of sections changes (shared-config appearing); lock updates after a click until `scrollend` or a ~600ms fallback
- [x] 3.3 URL: read `?section=` on mount via `currentQuery()` and jump without animation once that section exists (unknown id → ignore); write changes with `replaceQuery()` only when the current section actually changes
- [x] 3.4 Narrow screens: keep the current entry visible in the horizontal row (`scrollIntoView({ inline: "nearest", block: "nearest" })` on the entry when it changes)

## 4. Styles

- [x] 4.1 `src/ui/styles.css`: `.settings-layout` grid (nav 200px, shrinkable to 168px; content `minmax(0, 1fr)`; centred; max-width ≈ 1320px), nav entry, current entry (background + left marker + weight, tokens only), count badge, attention variant, `.settings-section:focus-visible` outline; verify both themes
- [x] 4.2 `@media (max-width: 720px)`: single column, nav as a non-wrapping `overflow-x: auto` row above the sections, current marker moves to the bottom edge
- [x] 4.3 Check contrast of nav text and the current/attention states against `--bg-base`/`--bg-section` in both themes (≥ 4.5:1)

## 5. Verification and docs

- [x] 5.1 `bun run check` passes, including the existing "only url.ts touches location and history" test
- [x] 5.2 Build the demo (`bun run build:demo`) and verify from `file://` with headless DOM dumps/screenshots: nav lists the sections in order with counts (`Discovered 3` emphasised), `?section=agents#/settings` opens at Agent sessions with that entry current, unknown section opens at the top, narrow viewport (400px) shows the row layout
- [ ] 5.3 (Not done: needs a person in a real browser — headless checks cover the static states only.) Verify in the running dashboard: jump to each section, highlight follows manual scrolling, last section becomes current at the end, unsaved edit survives jumping, back button returns to the previous view after scrolling through sections, keyboard Enter + Tab lands in the section
- [x] 5.4 Update the Settings bullet in `README.md` and add a line to `CONTRIBUTING.md`: a new settings panel is added as an entry of the `sections` array in `settings.tsx`
- [x] 5.5 `openspec validate add-settings-nav --strict` passes

## 6. Found during implementation

- [x] 6.1 Fix the pre-existing crash when Settings is the first page loaded (`runDiscovery` used before initialisation from the early-return render, aborting all later effects): declare it and the navigation hook before the early return; add a regression test
