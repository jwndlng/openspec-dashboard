## 0. Prerequisite

- [x] 0.1 (Done 2026-09-22: `add-settings-nav` archived in #49; branch fast-forwarded to `main`.) `add-settings-nav` is archived and `openspec/specs/settings-page/spec.md` exists on `main` (this change only modifies that spec); rebase this branch on it

## 1. Row offset helper

- [x] 1.1 Add `rowScrollLeft(row: { scrollLeft, clientWidth }, entry: { offsetLeft, offsetWidth }): number` to `src/ui/settingsSections.ts`: unchanged when the entry is fully visible, otherwise the smallest shift that reveals it (clamped at 0)
- [x] 1.2 Unit tests in `test/settingsSections.test.ts`: entry visible → unchanged; entry cut off on the right → shifted so its right edge is visible; cut off on the left → shifted to its left edge; entry wider than the row → aligned to its left edge

## 2. One scroll area

- [x] 2.1 `src/ui/settings.tsx`: wrap `.settings-layout` in `div.settings-scroll` and move the `scroller` ref from `.settings` to it (loading state included, so the ref target exists for every render that lists sections)
- [x] 2.2 `src/ui/styles.css`: `.settings-scroll { flex: 1; min-height: 0; overflow: auto; }`; `.settings-layout` loses `flex`/`min-height`, gets `align-items: start`; `.settings` loses `overflow`; `.settings-nav` loses `overflow-y` and gets top padding matching the sections so the first entry is level with the first panel
- [x] 2.3 Narrow screens: remove the fixed `grid-template-rows` split, keep the row `overflow-x: auto`; the row is in flow above the sections and scrolls away with them
- [x] 2.4 Confirm the save bar is still pinned below the scroll area and spans the full width

## 3. Behaviour

- [x] 3.1 `src/ui/settingsNav.tsx`: replace the `scrollIntoView` on the current entry with a horizontal-only adjustment using `rowScrollLeft` (assign `list.scrollLeft`); the only remaining `scrollIntoView` is the one on the section target of a jump
- [x] 3.2 Add a source-level test: `settingsNav.tsx` contains exactly one `scrollIntoView`, and it is the jump's
- [x] 3.3 Check `useSectionNav` against the new container: measurement relative to `.settings-scroll`, end-of-scroll rule, pin after a jump, deep link on load — adjust only if a measurement depends on the old container

## 4. Verification

- [x] 4.1 `bun run check` passes
- [x] 4.2 Real-scroll check over the DevTools protocol against the demo build (wide 1500×800 and narrow 420×800): wheel over a section, over the nav and over the side margin all scroll `.settings-scroll`; the nav's top moves by the scrolled distance and leaves the viewport; the current marker and `?section=` change while scrolling; the document itself never scrolls; the save bar stays at the bottom
- [x] 4.3 Same script: while scrolling down with the nav out of view, `.settings-scroll.scrollTop` only ever increases (no pull-back), on wide and narrow
- [x] 4.4 Headless screenshots of the demo: top of page (nav level with the first panel, both themes), deep link `?section=agents` (nav out of view, section at top), narrow top and narrow scrolled
- [x] 4.5 Maintainer: click through in a real browser — scrolling feel, jump then scroll back up to the nav, keyboard Enter + Tab after a jump, back button after scrolling
- [x] 4.6 Update the Settings bullet in `README.md` if its wording implies a pinned navigation; `openspec validate settings-nav-follows-content --strict` passes

## 5. The navigation moves along on a jump (added after first use)

- [x] 5.1 Add `navOffset(sectionOffset, navHeight, layoutHeight)` to `src/ui/settingsSections.ts` (clamped to `[0, layoutHeight − navHeight]`, never negative) with unit tests: first section → 0, middle section → its offset, short last section → clamped, nav taller than the layout → 0
- [x] 5.2 `src/ui/settingsNav.tsx`: on a jump (click or deep link) place the nav before scrolling — set `--nav-offset` (wide) and `--nav-order` (narrow) on the nav element imperatively; on narrow scroll to the row instead of the section; jumping to the first section is the home position; give every section wrapper `--section-order`
- [x] 5.3 Return home when the page is scrolled back to `scrollTop = 0` (not while a jump is still settling), and re-apply the placement on window resize
- [x] 5.4 `src/ui/styles.css`: wide — `.settings-nav { position: relative; top: var(--nav-offset, 0px); }`; narrow — flatten the column (`.settings { display: contents }`, padding/gap moved to `.settings-layout`), apply `order` from the two custom properties, `top: 0`
- [x] 5.5 Update the source-level test: still exactly one `scrollIntoView` in `settingsNav.tsx`, inside the jump
- [x] 5.6 Real-click check over the DevTools protocol (wide and narrow): after clicking an entry the nav is visible and level with the target (wide) / directly above it at the top of the view with no overlap (narrow); a second jump from the moved nav works; the last section keeps the nav inside the page; wheel-scrolling afterwards moves the nav with the content; scrolling to the top brings it home; deep link places it too; no pull-back, no uncaught errors
- [x] 5.7 `bun run check`, `openspec validate settings-nav-follows-content --strict`
- [x] 5.8 Found while verifying: keep the placement correct when the layout changes after a jump (late discovery results, enabling a repository, scrollbar appearing) — `ResizeObserver` on the layout re-places the nav and, if the user has not scrolled since the jump, re-scrolls; the narrow row re-reveals its current entry on width changes; section `scroll-margin-top` matches the nav's top padding so both start level
- [x] 5.9 Found while verifying: the narrow row positioned its current entry from stale measurements — entries are now measured in the row's own coordinates (the row is their offsetParent) and re-revealed when the row's width or the entries' contents change (a count going from "…" to "3 new" shifts the entries after it)

## 6. The navigation follows manual scrolling too (added after further use)

- [x] 6.1 `src/ui/styles.css`: `.settings-nav { position: sticky; top: 0 }` (wide); narrow: sticky row with the page background, `z-index: 1`, sections' `scroll-margin-top` includes `--settings-nav-height`; drop `--nav-offset`, `--nav-order`, `--section-order` and `.settings { display: contents }`
- [x] 6.2 `src/ui/settingsNav.tsx`: remove the jump placement (`placeNav`, anchor, return-home, resize re-placement); keep the jump pin and the re-scroll when the layout grows before the user scrolls; publish the nav's height as `--settings-nav-height`
- [x] 6.3 Make the `<nav>` the narrow row's sideways scroller instead of the `<ul>` — Chrome missed clicks on the entries of a sideways-scrolled `<ul>` (also on `main`)
- [x] 6.4 Remove `navOffset` and its tests; source-level tests: one `scrollIntoView` (the jump's), and `.settings-nav` is sticky
- [x] 6.5 Real-scroll check over CDP against the demo build (1500×800, 420×800): wheel over a section, the nav and the margin scrolls `.settings-scroll`, the nav stays at the top of the view (`navTop = 0`) throughout, the marker and `?section=` follow, the document never scrolls; click-jumps (real mouse events, repeated from the stuck row) land the section level with the nav (wide) / 16px below the row (narrow); back at the top the nav is level with the first section; no uncaught errors
- [x] 6.6 Spec delta, proposal, design (D7) and README updated; `bun run check`, `openspec validate settings-nav-follows-content --strict`

## 7. The navigation scrolls away with the content (added after further use)

- [x] 7.1 `src/ui/styles.css`: `.settings-nav` loses `position: sticky; top: 0` (keeps `position: relative` for offsetParent); narrow: drop the row's background, `z-index` and the `--settings-nav-height` `scroll-margin-top`
- [x] 7.2 `src/ui/settingsNav.tsx`: remove the `--settings-nav-height` `ResizeObserver`; comments no longer describe a sticky nav
- [x] 7.3 Source-level test: no `.settings-nav` rule is sticky, fixed or has its own vertical overflow
- [x] 7.4 Real-scroll check over CDP against the demo build (1500×800, 420×800): with each wheel step the nav's top in the view moves by exactly the scrolled distance (0 → −400 → … → −2650), the marker follows, the document never scrolls; a real click-jump scrolls to the section and marks it current
- [x] 7.5 Spec delta, proposal and design (D8) updated; `bun run check`, `openspec validate settings-nav-follows-content --strict`

## 8. The navigation moves along beside the current section (added after using D8 on `main`)

- [x] 8.1 `navOffset({ sectionTop, sectionBottom, viewTop }, navHeight, layoutHeight)` in `src/ui/settingsSections.ts` with unit tests: home at the top, level with a section start in view, level with the view inside a tall section, stopped at the section's end, short section, short last section, navigation taller than the layout
- [x] 8.2 `src/ui/settingsNav.tsx`: place `--nav-offset` on scroll, on a change of the current section and on layout resize; `data-glide` for 220ms when the current section changes
- [x] 8.3 `src/ui/styles.css`: wide `.settings-nav { top: var(--nav-offset, 0px) }`, `[data-glide]` transition (none under reduced motion); narrow `top: 0`, no transition
- [x] 8.4 Source-level test: never sticky/fixed or its own vertical scroller; wide rule uses `--nav-offset`, narrow rule `top: 0`
- [x] 8.5 Real-scroll check over CDP against the demo build (1500×800, 420×800): wheel down and up through all sections — nav level with short sections' starts, 16px below the view's top through the tall Agent sessions section, pushed up with a section's end, never pulling the page back, document never scrolls; real click-jumps and `?section=agents` land the section level with the nav with focus in it; narrow row unchanged; no uncaught errors
- [x] 8.6 Spec delta, proposal and design (D9) updated; `bun run check`, `openspec validate settings-nav-follows-content --strict`
- [x] 8.7 Maintainer: scroll through Settings in a real browser and confirm the navigation now moves the way you want
- [x] 8.8 Found by the maintainer ("works on the demo, not in local dev"): every CDP check ran against the demo build, whose `demo.css` gives `#app` a height; the product never did, so `.app { height: 100% }` resolved to `auto`, the whole document scrolled and `.settings-scroll` never did — the navigation stayed at the top of the page. `src/ui/styles.css` now sets `#app { height: 100% }`; a source-level test guards the chain `html, body` → `#app` → `.app` → `.settings-scroll`; re-checked over CDP against `bun run dev` (1500×800, 420×800): the document never scrolls, `.settings-scroll` does, the navigation follows
