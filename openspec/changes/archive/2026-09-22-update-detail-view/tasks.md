# Tasks

## 1. The card leads with Show details

- [x] 1.1 In `src/ui/kanban.tsx`, replace `ChangeCard`'s copy button with a **Show details** anchor built from `cardLink(card, from)` (same `href`/`followInApp` handling, so ⌘- and middle-click open a new tab), and render the change name as plain text instead of the stretched `.card-link` anchor — verify by extending `test/changeDetail.test.ts` so a rendered card has exactly one anchor, pointing at `/repo/r1/change/<name>?from=…`, and no `CopyButton`.
- [x] 1.2 Remove the `.card-link` rules from `src/ui/styles.css` (including the stretched `::after` and its focus outline) and style **Show details** as the card's top-row action; verify with `bun run dev` that no part of a card except that action reacts to a click and that the action shows a focus ring when tabbed to.
- [x] 1.3 Delete `applyCommand`, `startCommand`, `copyCommandFor`, `isStartColumn` and `APPLY_COLUMNS` from `src/ui/format.ts`, keeping `cdCommand` and `shellQuote`; drop their cases from `test/format.test.ts` and verify `bun run check` reports no unused export or type error.

## 2. The detail view becomes an overlay shell

- [x] 2.1 Reduce `DetailHeader` in `src/ui/changeDetail.tsx` to the repository link, the change name, a close control and the snapshot's warnings — removing the column badge, meter, age, created/archived dates, schema badge, branch badge and the three copy actions — and update `test/changeDetail.test.ts` to assert those labels are gone and that the repository link and warnings remain.
- [x] 2.2 Wrap `ChangeDetail`'s content in an overlay panel with `role="dialog"`, `aria-modal="true"` and an accessible name naming the change, on a backdrop element; verify in `test/changeDetail.test.ts` that the rendered tree carries the dialog role and the name.
- [x] 2.3 Give the overlay one `close()` that navigates to `backTarget(query.from, repoId)`, wired to the close control, to a backdrop activation and to an `Escape` `keydown` listener registered while the overlay is mounted; verify with a unit test that all three resolve to the same `{path, query}` for a `from` board, for an unknown `from` and for no `from`.
- [x] 2.4 Move the keyboard focus into the panel on mount and restore it to the previously focused element on unmount; verify by hand that opening from a card focuses the overlay and closing returns the focus to the board.
- [x] 2.5 Style the overlay in `src/ui/styles.css`: a bounded, centred panel over a dimmed backdrop, above the topbar and the session dock, with the artifact tabs, file list and content scrolling inside it and the page behind not scrolling; verify with `bun run dev` that a long spec file scrolls within the panel and the board behind stays put.

## 3. The board stays behind the overlay

- [x] 3.1 Add an optional `query?: string` prop to `Kanban` used for its initial filters in place of `currentQuery()` (read once at mount, as today); verify with a test that a `Kanban` given `?q=sync` starts with that search regardless of the current URL.
- [x] 3.2 In `src/ui/app.tsx`, render one `<Kanban>` for the `board`, `repo` and `change` views, keyed by the board's path — `back.path` from `backTarget(parseDetailQuery(currentQuery()).from, route.repoId)` on the change route, which also supplies `query={back.query}` — and render `<ChangeDetail>` as the overlay on top; verify by hand that opening a card on a filtered board leaves the board rendered behind with its filters, groups and scroll position, and that closing needs no re-scan.
- [x] 3.3 While the change route is active, mark the wrapper holding the topbar, the board and the session dock `inert` and `aria-hidden`, with `pointer-events: none` and `overflow: hidden` in CSS as the fallback; verify by hand that clicking a card or a filter behind the backdrop does nothing, that tabbing stays inside the overlay, and that a running session keeps running and is usable again after closing.
- [x] 3.4 Verify the not-found path: opening `/repo/<id>/change/<missing>` and a change of an untracked repository still shows the "not found" state inside the overlay with a way out, and neither throws nor renders a blank page.

## 4. Documentation and closing checks

- [x] 4.1 Update `README.md` where it describes the card's "Copy apply command" action (the board section, the New-change paragraph and the one-card-per-change bullet) to describe **Show details** and the overlay, and say that apply/start commands are run by hand.
- [x] 4.2 Run `openspec validate update-detail-view` and `bun run check`, and verify the change works in the compiled binary: `bun run build` then `dist/openspec-dashboard` — open a card, close the overlay with each of the three ways, and reload a detail URL directly.
