# Tasks

## 1. Routing and navigation

- [x] 1.1 Add `{ view: "help" }` for `/help` to `src/ui/routes.ts` and verify with a routes test that `/help` and `/help/` map to it and other paths are unchanged
- [x] 1.2 Add a help icon to `src/ui/icons.tsx` and a last **Help** tab to the main navigation in `src/ui/app.tsx`, rendering a placeholder Help view; verify in `bun run dev` that the tab is marked current on `/help` and the view survives a reload, and in the demo build on `#/help`

## 2. Tour logic (pure)

- [x] 2.1 Create `src/ui/tourState.ts` with the ordered step list (welcome, projects, board, activity, pull-requests, settings, console, refresh, theme, help) as exported step-id constants with title and ≤2-sentence text, `visibleSteps(steps, isPresent)` (keeps centred steps, drops steps whose anchor is absent) and `stepLabel(i, n)` ("n of m"); verify with `test/tourState.test.ts` (console step dropped, count excludes it, labels)
- [x] 2.2 Add `loadTourSeen()` / `saveTourSeen()` under key `openspec-dashboard.tour` (value `"seen"`, anything else = not seen, storage errors swallowed) and the `setTourAutoStart` / `tourAutoStarts` flag; verify in `test/tourState.test.ts` with a stub storage for seen, corrupt value and throwing storage
- [x] 2.3 Add a pure `cardPlacement(anchorRect, cardSize, viewport)` (below, else above, clamped with a 16px gutter, bottom full-width under 480px) and verify with tests for top, bottom-edge and 400px-wide cases

## 3. Tour overlay

- [x] 3.1 Add `data-tour="<step-id>"` attributes (using the constants from 2.1) to the five nav tabs and Help tab in `app.tsx`, the refresh group and theme button, and the Console button in `src/ui/console.tsx`; verify each anchor is present in the rendered page with `bun run dev`
- [x] 3.2 Create `src/ui/tour.tsx`: spotlight box and step card from theme tokens, scroll-into-view (no smooth scroll under reduced motion), re-measure on resize/scroll, `role="dialog"` named "Dashboard tour" with the step text as description, Next/Done, Back (not on step 1), Skip tour, Escape/←/→ keys, focus to Next on each step and back to the previously focused element on close; verify manually in both themes and at 400px width
- [x] 3.3 Wire the tour into `App`: `tourOpen` state included in `overlayOpen` (page inert), auto-start once per load when `tourAutoStarts()`, not seen and no overlay open (re-checked when the overlay closes), end as skip on route change, save seen on skip and finish; verify on a fresh browser profile that it starts, does not start after reload, and waits when opened on a change link
- [x] 3.4 Call `setTourAutoStart(false)` in `src/ui/demo/main.tsx`; verify `bun run build:demo` shows no tour on first load and `bun run screenshots` images show no tour

## 4. Help page

- [x] 4.1 Create `src/ui/helpContent.tsx` with the sections (getting-started, board, detail, agent-sessions, keeping-current, pull-requests, what-it-writes, troubleshooting) as `{ id, title, body }`, in-app links via `href`/`navigate`/`hrefWithQuery`, and the column glossary as `Record<Stage, string>` rendered against `STAGE_COLUMN`; verify `bun run check` typechecks and that removing a stage key fails it
- [x] 4.2 Create `src/ui/help.tsx`: hero-continuing header with **Take the tour**, table of contents linking to `?section=<id>`, the sections, `?section=` read on load and written on scroll with `replaceState` via `parseSection`/`serializeSection`; replace the placeholder from 1.2; verify `/help?section=board` opens at the board section and `?section=nope` opens at the top, in dev and demo
- [x] 4.3 Add `test/helpContent.test.ts`: section ids unique, every in-app link target resolves to a known route (and Settings section ids are real), every `STAGE_COLUMN` value appears in the board section, and no text matches a real home directory, e-mail or foreign host (reuse the demo-data patterns); verify it passes
- [x] 4.4 Add help styles to `src/ui/styles.css` (readable line length, headings, code, glossary list) and verify both themes and a 400px window have no horizontal scrolling

## 5. Docs and checks

- [x] 5.1 Add one line to `CONTRIBUTING.md` asking changes that alter documented behaviour to update `src/ui/helpContent.tsx`, and mention the Help tab and tour in `README.md`; verify the text renders on GitHub preview
- [x] 5.2 Run `bun run check` and `bun run build`, open `dist/openspec-dashboard` on a fresh browser profile, take the tour end to end with the keyboard only, open Help offline (server stopped after load) and confirm every requirement scenario in `specs/onboarding-tour` and `specs/help-page`
