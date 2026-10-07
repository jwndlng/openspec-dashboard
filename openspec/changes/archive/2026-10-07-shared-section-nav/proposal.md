# Proposal

## Why

The side navigation on Settings jumps to the bottom of the page when the user scrolls to the end, and lags while it
glides, which reads as an animation glitch. Help has the same kind of page — sections with `?section=` deep links,
tracked by the same scroll logic — but shows its sections as a wrapped row of chips that scrolls away, so the two pages
navigate differently for no reason.

## What Changes

- Reaching the end of Settings no longer moves the navigation. The last entry still becomes current there (a short
  last section must stay reachable), but the navigation is placed beside the section that is actually at the top of the
  view, not beside the highlighted one. Scrolling a few pixels back up no longer flips it back.
- The glide between sections is no longer restarted on every scroll frame: the navigation keeps exact pace with the
  content while a glide toward its new place finishes in its own time.
- The Settings navigation and section list become a shared section navigation, parameterised by page (section id
  prefix, scroll area, layout, accessible name, link path and whether other query parameters are kept).
- Help uses it: a left-hand section navigation beside the sections on wide screens and the same horizontally
  scrollable row above them on narrow screens, replacing the chip list at its start. Help links keep the other query
  parameters; `?section=` deep links keep working on both pages.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `settings-page`: "A section navigation is shown beside the sections" — the navigation is placed by the section at
  the top of the view and glides only when that changes; reaching the end of the page, where the short last section
  becomes current, does not move it; a glide is not restarted or slowed by continued scrolling.
- `help-page`: "Help covers the dashboard's main topics in sections" — the list of sections at its start is replaced
  by a section navigation that behaves like the one on Settings, beside the sections on wide screens and as a row above
  them on narrow screens.

## Impact

- `src/ui/settingsNav.tsx` → `src/ui/sectionNav.tsx` — generic `useSectionNav`, `SectionNav`, `SectionList`; the hook
  also reports the section the navigation is placed by; the glide no longer animates `top`.
- `src/ui/settingsSections.ts` — `currentSection`/`navOffset` unchanged in meaning; a helper for the placement section
  if needed.
- `src/ui/settings.tsx`, `src/ui/help.tsx` — use the shared components with their page definitions.
- `src/ui/styles.css` — `.settings-nav`/`.settings-link` become shared `.section-nav`/`.section-link` rules (wide and
  narrow); Help gets the two-column layout; the `.help-toc` rules are removed.
- `test/settingsSections.test.ts`, `test/helpContent.test.ts` — renamed file and selectors, placement-at-the-end and
  Help navigation checks.
- `src/ui/changelog.ts` — a What's new entry.
- No server, API, config or demo data changes. The in-flight `refactor-settings-ui` adds a different `settings-page`
  requirement and edits other rules in `styles.css` (section headlines); if it lands first, rebase on it.
