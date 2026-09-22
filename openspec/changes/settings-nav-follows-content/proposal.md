## Why

The Settings navigation added by `add-settings-nav` is pinned: it sits beside the sections in its own non-scrolling column, and only the sections column scrolls. In use that feels detached — the page has an inner scroll area instead of scrolling as a page, the mouse wheel does nothing while the pointer is over the navigation or the side margins, and the navigation permanently takes a column of attention on a page where, once you have jumped to a section, you are working in that section. The navigation should behave like a table of contents at the top-left of the page: part of the content, moving with it.

## What Changes

- The Settings page scrolls **as one page**: the navigation and the sections share a single scroll area spanning the full width below the top bar, with the scrollbar at the window edge. The mouse wheel works wherever the pointer is — over the navigation, the sections or the side margins.
- The navigation **follows the content**: it starts at the top-left next to the first section and, as the user scrolls or jumps, stays at the top of the view beside the sections in view (sticky inside the one scroll area). It is no longer a separate, non-scrolling column. (A first version let it scroll out of view and only brought it along on a jump; in use that still felt like the navigation getting lost, so it now follows manual scrolling too.)
- Jumping works the same (section to the top, focus, reduced motion), and the next jump is always one click away.
- The **narrow-screen row** follows the same rule: it sticks to the top of the view, and a jump lands the section directly below it without covering it. The `<nav>` itself is the row's sideways scroller, which also fixes entries of a sideways-scrolled row not reacting to clicks in Chrome.
- The current-section marker and the `?section=` URL keep being updated while scrolling, so deep links and reloads still land where the user was.
- Updating the marker MUST NOT move the page: keeping the current entry visible inside the narrow row may only scroll that row sideways.
- The save bar stays pinned at the bottom, unchanged.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `settings-page`: "A section navigation is shown beside the sections" — the navigation scrolls together with the sections instead of remaining visible, and Settings scrolls as one page. "The navigation adapts to narrow screens" — the row scrolls away with the sections, and keeping the current entry in view is limited to horizontal scrolling of the row. The other four requirements (named sections, current-section marker, counts, deep links) are unchanged.

## Impact

- `src/ui/styles.css`: a full-width scroll wrapper around `.settings-layout`; `.settings` stops being a scroll container; the navigation column loses its own overflow; narrow-screen rules adjusted.
- `src/ui/settings.tsx`: the scroll-container ref moves from the sections column to the new wrapper.
- `src/ui/settingsNav.tsx`: view tracking measures against the new scroll container; the "keep current entry visible" effect scrolls the row horizontally only.
- `test/`: a pure helper for the horizontal row offset with unit tests; the existing section tests keep passing.
- `README.md`: wording of the Settings bullet ("navigation on the left" stays true).
- **Ordering:** the `settings-page` spec reaches `openspec/specs/` only when `add-settings-nav` is archived. That change is complete and must be archived (and synced) before this one, so the MODIFIED requirements have something to modify.
- No server, API, config or dependency changes. The demo gets the new behaviour for free.
