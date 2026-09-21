## Context

`src/ui/settings.tsx` renders Settings as `div.settings` — a centred, 1100px-max grid that is also the scroll container — followed by a sticky `div.savebar`. Inside are six panels, each a `<section class="panel">` with an `<h2>`: four inline in `settings.tsx` (Workspace roots, Tracked repositories, Discovered, Scanning) and two in their own components (`AgentSettings`, which edits the same draft, and `SharedConfigPanel`, which has its own save and only renders once the config has loaded). Both of those have nested `<h2>` sub-headings. One draft and one save bar cover everything except the shared-config panel.

All URL access goes through `src/ui/url.ts` (`currentQuery()`, `replaceQuery()`), which works in path mode (the real dashboard) and hash mode (the demo, where the fragment is the route). The UI has no dependencies beyond Preact, styles use tokens only, and there is one narrow-screen breakpoint at 720px.

## Goals / Non-Goals

**Goals:**

- Reach any settings section in one click, and always see which one is in view.
- Keep the one-page, one-draft model and the existing save behaviour untouched.
- Make it structurally impossible to add a panel without a navigation entry.
- Behave identically in the dashboard and the demo; keyboard and screen-reader friendly.
- Deep links must work when Settings is the first page loaded — which exposed an existing bug (see Risks).

**Non-Goals:**

- Tabs / one-section-at-a-time views, or per-section saving.
- Navigation entries for sub-headings inside a panel (Agents, Repositories, Session worktrees, …).
- Collapsible sections, search within settings, or reordering sections.
- Changing what any panel does, the config format or the API.

## Decisions

### D1. Jump links on one page, not tabs

The nav scrolls; every section stays mounted. With tabs, "unsaved changes" would refer to edits on a tab the user can no longer see, the draft would have to outlive unmounted panels or be lifted further, and browser find-in-page would stop covering all settings. Jump links need none of that and keep Settings a page you can also simply scroll.

*Alternative — tabs with a per-tab dirty marker*: cleaner on small screens, but more state and more ways to lose track of an unsaved edit, for a page whose problem is only "too long".

### D2. One `sections` array renders both the nav and the panels

`Settings` builds `sections: { id, label, count?, attention?, content }[]` and maps over it twice: once for the nav, once for the panels. Conditional sections (shared config before the config has loaded) are simply absent from the array, so the nav can never list a section that is not on the page, and a developer adding a panel has exactly one place to add it. Each entry's content is wrapped by `Settings` in `<div id="settings-<id>" class="settings-section" tabIndex={-1} aria-label={label}>`, so the panel components keep owning their own `<section>`/`<h2>` markup and need no new props.

*Alternative — sections register themselves through context on mount*: no central list, but order then depends on mount order (wrong for late-mounting sections unless sorted by DOM position) and the nav flickers in as effects run. *Alternative — derive the nav from `h2` elements in the DOM*: zero wiring, but picks up the nested sub-headings and cannot carry counts.

Section ids are stable, URL-safe and part of the deep-link contract: `roots`, `tracked`, `discovered`, `scanning`, `agents`, `shared-config`.

### D3. Layout: the nav sits outside the scroll container

```
.main
└─ .settings-layout           grid: 200px | minmax(0, 1fr), centred, max-width ≈ 1320px
   ├─ nav.settings-nav        not scrolling → always visible, no position: sticky needed
   └─ .settings               the existing scroll container and panel grid, unchanged
.savebar                      unchanged, below both
```

Because only the right column scrolls, the nav stays put without sticky positioning or offset bookkeeping, and the save bar keeps spanning the full width. Below 720px the grid becomes one column and the nav a horizontally scrollable row (`overflow-x: auto`, no wrapping) above the sections; the active entry is scrolled into view within the row.

### D4. Current section from the scroll position, pinned after a jump

A passive `scroll` listener on `.settings`, throttled to one measurement per animation frame, reads the top of each section wrapper relative to the container and hands it to a pure function: the current section is the last one whose start is within 96px of the top of the view — and the last section when the container is scrolled to its end (otherwise short trailing sections could never become current). The rule is unit-tested without a DOM.

A jump makes its target current immediately and *pins* it: measurements are ignored until the programmatic scroll has settled (`scrollend`, with a 700ms fallback) **and** the user scrolls again. That removes flicker through the sections passing by, and keeps the clicked entry current when its section is too short to reach the top. Scrolling uses `scrollIntoView({ block: "start" })`, smooth unless `prefers-reduced-motion: reduce`. A jump made by the user then focuses the section wrapper with `preventScroll`, so the next Tab lands in its first control; a deep link on load scrolls without animation and does not move focus.

*Changed during implementation.* The first draft used an `IntersectionObserver` with a "top 30% of the view" band. With a short first section (Workspace roots) the second section already starts inside that band at scroll position 0, so it — not the first — would be current on opening the page; and the observer does not fire on reaching the end of the scroll range, so a second mechanism would have been needed anyway. Six `getBoundingClientRect` calls per frame while scrolling are negligible.

### D5. The section lives in the query string

`?section=<id>`, read with `currentQuery()` on mount (scroll there without animation once the target exists — the shared-config section appears after the config loads, so the initial jump waits for the id to be present) and written with `replaceQuery()` when the current section changes, preserving other parameters. Using the query rather than a fragment is what makes it work in hash mode, where the fragment is already `#/settings`. `replaceState` rather than `pushState`: scrolling through settings must not fill the back-button history. Unknown ids are ignored. A pure `parseSection` / `serializeSection` pair sits next to the existing filter/overview URL state helpers.

Nav entries are real links (`href` built through `href("/settings")` plus the query) so they can be opened in a new tab; plain clicks are intercepted.

### D6. Counts and attention

`tracked` shows `enabled/total`, `discovered` shows the number of untracked candidates and carries `attention` when it is non-zero (rendered with the existing `brand` badge style plus the number — never colour alone). While discovery is running the discovered count shows `…`. Other sections have no count. Counts come from the same values the panel headings already compute, so nav and headings cannot disagree.

### D7. Semantics

`<nav aria-label="Settings sections">` containing a list of links; the current one has `aria-current="true"`. Section wrappers are labelled regions via `aria-label`. The nav is before the sections in DOM order, so keyboard users meet it first; focus moves into the section on activation (D4), which is also what makes the jump perceivable to screen-reader users.

## Risks / Trade-offs

- [The 1100px content column plus a 200px nav needs ~1320px; on laptops between 720px and ~1100px the panels get narrower than today] → the panel grid already handles narrow widths (`minmax(0, 1fr)`, ellipsised paths); the nav column can shrink to 168px; below 720px it moves on top.
- [Highlight jitter near section boundaries, or the last short sections never becoming current] → the bottom-of-scroll rule and the click lock in D4; both covered by the pure-function tests.
- [Writing `?section=` on every section change while typing in a field could be noisy] → it is `replaceState` only, and only fires when the current section actually changes.
- [Focus moving to the section wrapper shows a focus ring around a whole panel] → style `:focus-visible` on the wrapper as a subtle outline using `--border-strong`; programmatic focus after a mouse click does not match `:focus-visible` in current browsers.
- [In-flight changes that add settings panels merge with the old structure] → the conflict is confined to the JSX list in `settings.tsx`; the fix is adding one array entry. Noted in `CONTRIBUTING.md`.

- [Found while implementing: opening Settings directly (or reloading it) threw `Cannot access 'runDiscovery' before initialization`] → the discovery effect also runs for the render that returns early while the config is loading, where a `const` declared after that return is uninitialised; the uncaught error aborted every later effect, so discovery never ran on a direct load and the navigation hook never started. Arriving from the board hid it (config already loaded). Fixed by declaring `runDiscovery` and the navigation hook before the early return, with a test that keeps them there.

## Open Questions

- Should the header's failing-repository badges or other views be able to deep-link into a settings section (e.g. "N discovered" on the overview → `?section=discovered`)? Cheap once D5 exists; out of scope here.
