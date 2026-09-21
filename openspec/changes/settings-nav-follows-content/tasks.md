## 0. Prerequisite

- [ ] 0.1 (Open: on 2026-09-21 `add-settings-nav` was still active on `main`. Needed before this change is archived, not before it is merged.) `add-settings-nav` is archived and `openspec/specs/settings-page/spec.md` exists on `main` (this change only modifies that spec); rebase this branch on it

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
- [ ] 4.5 Maintainer: click through in a real browser — scrolling feel, jump then scroll back up to the nav, keyboard Enter + Tab after a jump, back button after scrolling
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
