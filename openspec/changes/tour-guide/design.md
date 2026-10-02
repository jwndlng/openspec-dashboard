# Design

## Context

The UI is a Preact SPA (`src/ui/`) bundled into one self-contained HTML file; `App` (`src/ui/app.tsx`) owns the hero,
the main navigation and the route switch, and already makes the page `inert` while an overlay (change detail, console,
integration) is open. Per-browser preferences (theme, auto-refresh interval, last-seen activity) live in
`localStorage` behind try/catch helpers (`theme.ts`, `autoRefresh.ts`, `activityState.ts`). Settings already has a
section list with `?section=` deep links (`settingsSections.ts`, `settingsNav.tsx`). The demo build reuses `App` on a
mock API with hash routing (`src/ui/demo/main.tsx`). Requirements: `specs/onboarding-tour/spec.md`,
`specs/help-page/spec.md`.

## Goals / Non-Goals

**Goals:**
- A tour that works in every state the first visit can be in — no repositories, a failed API, agent sessions off — by
  anchoring only to controls of the hero and navigation that are always rendered (or skipping them).
- Help text that cannot silently drift from the board's columns.
- Pure, unit-testable logic (`tourState.ts`) separated from the DOM-measuring overlay (`tour.tsx`).

**Non-Goals:**
- No tour of a populated board, cards or the detail view: they may not exist on a first visit, and a tour that
  navigates between routes is far more fragile than one that stays on the hero.
- No server-side "seen" flag, no per-version "what's new" tour, no search in Help, no translations.
- No new dependency (no tour library): the overlay is ~150 lines over `getBoundingClientRect`.

## Decisions

1. **Anchors via `data-tour="<step-id>"` attributes**, not CSS selectors or refs threaded through props. The hero's
   tabs, Console button, refresh group and theme button get the attribute; the step list in `tourState.ts` names step
   ids only. At each step the overlay runs `document.querySelector('[data-tour="id"]')`; the visible-step list is
   computed when the tour starts (`visibleSteps(steps, isPresent)`), so "n of m" is stable for the whole run.
   *Alternative:* refs from `App` — rejected, the Console button lives in `console.tsx` and would need plumbing.

2. **Spotlight drawn as one positioned box with a huge `box-shadow`** in the dimming colour around the anchor's rect
   (plus padding and the theme's radius), and the step card placed below the anchor, else above, clamped to the
   viewport with a 16px gutter; on narrow windows the card is full-width at the bottom. Re-measured on `resize`,
   `scroll` and step change via `requestAnimationFrame`. The anchor is `scrollIntoView({block: "nearest"})`-ed first,
   without smooth scrolling under `prefers-reduced-motion`. Colours come from theme tokens, so both themes work.
   *Alternative:* SVG mask cut-out — more code for no visible gain.

3. **The tour is a dialog over an inert page.** `App` adds `tourOpen` to the `overlayOpen` condition so the existing
   `inert` wrapper stops clicks and focus; the overlay itself sits outside it with `role="dialog"`, `aria-modal`,
   `aria-label="Dashboard tour"` and `aria-describedby` on the step text. Focus moves to **Next** on each step and
   returns to the previously focused element on close. Keys: Escape → skip, ←/→ → back/next, captured on `document`
   like `Modal` does. Since the highlighted control is inside the inert part it cannot be clicked during the tour —
   intended: the tour explains, it does not drive.

4. **State and start rule in `App`.** `tourOpen` is state; a `useEffect` starts it once per load when
   `autoStartTour` (a module flag, `false` in the demo entry, set by a `setTourAutoStart(false)` call like
   `setRoutingMode`) is on, `loadTourSeen()` is false, and no overlay is open — re-evaluated when the overlay closes.
   A route change while open ends it as skip (`onRouteChange` already exists). Storage key
   `openspec-dashboard.tour`, value `"seen"`; anything else counts as not seen; helpers swallow storage errors.
   *Alternative:* start the tour only when there are no repositories — rejected, an existing user on a new browser
   still benefits, and Skip costs one key press.

5. **Help content as TSX, not Markdown files.** Sections live in `src/ui/helpContent.tsx` as
   `{ id, title, body: () => VNode }[]` so the body can use in-app links (`href()` + `navigate()`, `hrefWithQuery` for
   `/settings?section=environment`) and the column glossary can be a `Record<Stage, string>` imported by the board
   section and rendered against `STAGE_COLUMN` — the `Record` type makes a missing stage a type error (`bun run check`
   fails), satisfying "a column added without an explanation fails the build's checks". `renderMarkdown` is reserved
   for untrusted repository text and is not needed here.

6. **Help layout reuses the section-query helpers**, not the full Settings navigation: `parseSection` /
   `serializeSection` from `settingsSections.ts` for `?section=`, a simple table of contents at the top (links with
   `href="?section=<id>"`), and an `IntersectionObserver`-free "current section" via the existing `currentSection()`
   on scroll. The sticky gliding nav of Settings is specified for Settings only and is overkill for a reading page.
   *Alternative:* generalise `SettingsNav` — rejected for now; it carries Settings-specific counts and behaviour.

7. **Routes:** `routes.ts` gains `{ view: "help" }` for `/help`; the demo's hash routing needs no change because it
   reuses `routeFromPath`.

## Risks / Trade-offs

- [Help text goes stale as features change] → The column glossary is type-enforced; for the rest, `CONTRIBUTING.md`
  gets one line asking a change that alters a documented behaviour to update `helpContent.tsx`, and
  `test/helpContent.test.ts` checks every section id is unique, every in-app link target is a known route, and no text
  matches the demo's real-path/host patterns.
- [The tour obscures the empty-state "Open Settings" call to action on a first visit] → The tour is short (≤10 steps),
  skippable with Escape, and its Settings step says that is where to start.
- [Hero layout changes break anchors] → A missing anchor is skipped, never an error; `tourState` tests cover
  filtering, and the step ids are constants shared by `app.tsx` and the step list.
- [Screenshots in CI catch the tour] → The demo never auto-starts it (Decision 4).

## Migration Plan

UI-only; ships with the next release. Existing users see the tour once in each browser after upgrading — intended,
it doubles as an introduction to Help. Rollback is reverting the change; the leftover `localStorage` key is harmless.
