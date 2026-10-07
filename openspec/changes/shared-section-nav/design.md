# Design

## Context

`src/ui/settingsNav.tsx` has two parts:

- `useSectionNav(scroller, ids, page)` follows scrolling and works out the **current** section: `currentSection(rects,
  atEnd)` in `src/ui/settingsSections.ts`, where `atEnd` (within 2px of the bottom) makes the last section current. It
  also handles jumps (which pin their target until the user scrolls again), deep links and `?section=` in the URL. It is
  already generic: Help calls it with `{ prefix: "help", layout: ".help-layout" }`.
- `SettingsNav` renders the entries and, on wide screens, places itself with `--nav-offset` from `navOffset()`, using
  the *current* section. When `current` changes it sets `data-glide`, which turns on `transition: top 220ms`, and
  keeps re-setting `--nav-offset` on every scroll frame. It hard-codes `settings-` ids, `.settings-scroll`,
  `.settings-section`, the aria-label and the `/settings` link path. `SettingsSections` hard-codes the `settings-` id
  prefix.

The glitch has two causes (see proposal.md, Why). First, at the end of the page `current` becomes the short last
section, so the navigation is placed level with that section's start, far below the top of the view. Second, while a
glide is running every scroll frame sets a new `top`, and each new value restarts the 220ms transition from wherever
the navigation is at that moment. So the navigation trails behind until scrolling stops.

## Goals / Non-Goals

**Goals:**
- The highlight and the placement can differ: the highlight keeps the "last section at the end" rule, and the
  placement does not use it.
- A glide that is not disturbed by scrolling, with the navigation following scroll positions exactly.
- One navigation component and one section-list component for Settings and Help.

**Non-Goals:**
- Changing the meaning of `currentSection`, `navOffset`, `rowScrollLeft`, `serializeSection` or the deep-link/pin
  logic beyond what the placement section needs.
- Restyling Help's sections or changing Help text.
- A sticky navigation, which the spec rules out.

## Decisions

### 1. The hook reports a separate placement section (`anchor`)

`useSectionNav` returns `{ current, anchor, jump }`. In `measure()` it computes the rects once and sets
`current = currentSection(rects, atEnd)` and `anchor = currentSection(rects, false)`. While a jump's pin holds,
`anchor` is the pinned id, the same as `current`. So a jump or deep link still places the navigation beside its target,
and a smooth scroll does not glide through every section it passes. The navigation places itself by `anchor` and
marks `current`.

*Alternative:* placing by the view top only at the end (clamping `navOffset` when `atEnd`). That would still make
`current` change the placement in other edge cases and would keep two concepts mixed in one value. *Alternative:*
removing the `atEnd` rule. That is rejected because a short last section could then never be highlighted, which the
spec requires.

*Trade-off:* after a jump to the short last section, the navigation sits level with that section. The user's first
scroll releases the pin, and the navigation glides once to the section at the top. This is expected, since the user
asked for that section, and it is a single glide, not a flip-flop.

### 2. Glide with a transform animation, not a `top` transition

`--nav-offset` (→ `top`) is always set without a transition, every frame, so the navigation keeps exact pace with
the content. When `anchor` changes, the component measures the old and new offsets and runs
`el.animate([{ transform: translateY(old − new) }, { transform: "none" }], { duration: GLIDE_MS, easing: "ease" })`.
Because the animation only covers the difference and is independent of `top`, later per-frame updates of `top` do not
restart it. If the anchor changes again mid-glide, the running animation is cancelled and a new one starts from the
navigation's current visual position (its current transform plus the new difference). This is skipped under
`prefers-reduced-motion` and on narrow screens (where `--nav-offset` does not apply, detected with the same 720px media
query used in the CSS). The `data-glide` attribute and its CSS transition are removed.

*Alternative:* freezing `top` during the glide. The navigation would then lag the content for 220ms, which breaks
"keeps pace without lagging". *Alternative:* a JS spring per frame. That is more code and adds nothing.

### 3. Shared components in `src/ui/sectionNav.tsx`

Rename `settingsNav.tsx` → `sectionNav.tsx` with:

- `SectionPage` extended to `{ prefix, known, layout, scroller, label, path, keepQuery }`. `scroller` and `layout`
  are selectors, `label` is the nav's aria-label, `path` is `/settings` or `/help`, and `keepQuery` says whether entry
  links keep the current query's other parameters (Help: yes; Settings: no, as today).
- `useSectionNav(scroller, ids, page)` with `page` now required, and `SettingsNav` → `SectionNav({ page, sections,
  current, anchor, onJump })`. The first section is found by id (`<prefix>-<ids[0]>`) instead of `.settings-section`.
- `SettingsSections` → `SectionList({ page, sections, sectionClass })`. Settings passes `settings-section`, and Help
  passes `help-section` with content that includes its `<h2>`. Help's sections switch from `aria-labelledby` to the
  shared `aria-label` with the same text.
- `SettingsSection` → `NavSection` (id, label, count, attention, countNote, countTitle, content). Help builds these
  from `HELP_SECTIONS`.
- `SETTINGS_PAGE` lives in `settings.tsx` and `HELP_PAGE` in `help.tsx`. Pure helpers stay in `settingsSections.ts`,
  which keeps `SECTION_IDS` for Settings. Renaming that file too would only add churn to its tests.

### 4. Shared CSS, Help gets the two-column grid

`.settings-nav`, `.settings-nav ul/li/.label/.count` and `.settings-link` become `.section-nav`/`.section-link`, in
both the wide rules and the ≤720px row variant, so Settings and Help cannot drift apart. The grid stays per page:
`.settings-layout` keeps its columns, and `.help-layout` becomes `grid-template-columns: minmax(168px, 200px)
minmax(0, 1fr)` with a wider max-width (about 1060px, so the text column stays near its current 820px). `.help-intro`
spans both columns (`grid-column: 1 / -1`) so that the navigation's home is level with the first section. A
`.help-sections` column holds the sections with the existing gap. At ≤720px the help layout collapses to one column,
like Settings. All `.help-toc` rules are removed.

### 5. Tests

- `test/settingsSections.test.ts`: point the "never scrolls the page" source check at `sectionNav.tsx`; switch the
  CSS rule checks to `.section-nav`; assert that no `transition: top` remains (the glide must not animate `top`).
- A pure test for the anchor rule: at the end, `currentSection(rects, true)` is the last id while
  `currentSection(rects, false)` is the section at the top. This is already covered by the function and only needs a
  scenario-named case.
- `test/helpContent.test.ts` (or a new UI test): Help renders a `nav.section-nav` with one entry per `HELP_SECTIONS`
  item, each linking to `/help?section=<id>`, and no `.help-toc`.

## Risks / Trade-offs

- [The animation's start offset is measured from layout, and the layout can shift during a resize] → measure both
  offsets in the same `place()` pass that sets `top`, and on every `ResizeObserver` call just set `top` (no new glide).
- [`el.animate` is missing in the test DOM] → it is only used in the browser path behind a feature check. The pure
  helpers carry the testable logic.
- [`refactor-settings-ui` also edits `styles.css` and `settings.tsx`] → it touches headline rules and panel markup,
  not the nav rules. Rebase on whichever lands first. Conflicts would be limited to imports in `settings.tsx`.
- [The rename breaks imports elsewhere] → only `settings.tsx`, `help.tsx` and one test import `settingsNav.tsx`.
  `bun run check` catches the rest.
