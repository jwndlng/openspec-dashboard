# Tasks

## 1. Shared section navigation

- [x] 1.1 Rename `src/ui/settingsNav.tsx` to `src/ui/sectionNav.tsx`. Extend `SectionPage` with `scroller`, `label`, `path` and `keepQuery`, make `page` a required argument of `useSectionNav`, and update the imports in `settings.tsx`, `help.tsx` and the tests. Verify with `bun run check`, which must typecheck.
- [x] 1.2 Generalise `SettingsNav` → `SectionNav` and `SettingsSections` → `SectionList` (and `SettingsSection` → `NavSection`). Use the id prefix from `page.prefix`, find the first section by id, take the scroller selector, aria-label, link path and query handling from `page`, and the section class from a prop. Define `SETTINGS_PAGE` in `settings.tsx`. Verify that Settings still renders the same entries, ids and links (`bun test test/settingsSections.test.ts test/environmentUi.test.ts`).

## 2. Fix the end-of-page jump and the glide

- [x] 2.1 In `useSectionNav`, compute and return `anchor` alongside `current`. `anchor` is `currentSection(rects, false)`, or the pinned id while a jump's pin holds. Add a test case in `test/settingsSections.test.ts` named after the "Reaching the end does not move the navigation" scenario (last section current at the end, a different section at the top) and verify that it passes.
- [x] 2.2 Place `SectionNav` by `anchor` instead of `current`. Set `--nav-offset` every frame without a transition, and glide on an `anchor` change with a `translateY(old − new) → none` animation via `el.animate` (cancelled and restarted from the current visual position if the anchor changes mid-glide). Skip the glide under reduced motion and at ≤720px. Remove `data-glide` and the `transition: top` rules from `styles.css`. Add a CSS/source test that no `transition: top` remains, and verify by hand in `bun run dev`: scrolling to the end of Settings leaves the navigation in place, and a glide does not lag.

## 3. Help uses the shared navigation

- [x] 3.1 Replace the `.help-toc` chip list in `src/ui/help.tsx` with `SectionNav` + `SectionList`. Define `HELP_PAGE` with `path: "/help"` and `keepQuery: true`, and keep the intro with **Take the tour** above both. Verify that `?section=board` still opens at the board section in `bun run dev`, and that links keep other query parameters.
- [x] 3.2 In `styles.css`, turn the `.settings-nav`/`.settings-link` rules (wide and ≤720px) into shared `.section-nav`/`.section-link` rules. Give `.help-layout` the two-column grid with the intro spanning both columns and a ≤720px single-column variant, and delete the `.help-toc` rules. Update the CSS assertions in `test/settingsSections.test.ts`, and check Settings and Help at 1280px and 400px in `bun run dev` (and in the demo build at `#/help`).
- [x] 3.3 Add a test (in `test/helpContent.test.ts` or a new Help UI test) that Help renders a section navigation with one real link per `HELP_SECTIONS` entry to `/help?section=<id>` and no `.help-toc`. Verify that it passes.

## 4. Wrap-up

- [x] 4.1 Run `bun run check` and `bun run build`, then open Settings and Help in `dist/spec-control` and confirm that the navigation, deep links and narrow row work there.
- [x] 4.2 Add a What's new entry at the top of `src/ui/changelog.ts` (Help now has the same side navigation as Settings, and the Settings navigation no longer jumps at the end of the page). Verify with `bun test test/whatsNew.test.ts`.
