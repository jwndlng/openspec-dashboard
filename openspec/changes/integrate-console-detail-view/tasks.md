# Tasks

Order matters: the console tab is built and proven first (groups 1–4), the dock is removed only once it is redundant
(group 5), so the app always has a working terminal on every commit.

## 1. Wiring

- [~] 1.1 Lift `SessionProvider` in `src/ui/app.tsx` so it wraps both `div.app` and `ChangeDetail`, leaving `inert` and
  `aria-hidden` on `div.app` — verify with `bun run dev` that the overlay stays operable while the board behind it does
  not react to clicks or Tab.
  Written and checked statically: `SessionProvider` now wraps both `div.app` and `ChangeDetail` (`src/ui/app.tsx:208`
  to `:346`), `ChangeDetail` stays a sibling of `div.app`, and `inert` + `aria-hidden` sit on `div.app` alone
  (`src/ui/app.tsx:211`). `EndSessionDialog` moved out with it so the dialog the Console tab opens is not inert.
  Awaiting your browser pass: that the overlay is operable while the board behind it takes no click and no Tab.
- [x] 1.2 Extend `DetailQuery` in `src/ui/routes.ts` to accept `artifact=console` and a `session=<id>` value, with
  parse/serialize round-tripping — verify with unit tests in `test/changeDetail.test.ts` covering both routing modes
- [x] 1.3 Add a helper that resolves a change's sessions to the one to show (most recent `lastOutputAt`, falling back to
  `updatedAt`, then the `session` query value when it names one of them) in `src/ui/sessionState.ts` — verify with unit
  tests in `test/workStatusUi.test.ts` for zero, one and two sessions and for a stale id

## 2. The console tab

- [x] 2.1 Append a Console tab to `ArtifactTabs` in `src/ui/changeDetail.tsx` when the change has a session or session
  worktree, after the artifact tabs, with no state pill and always selectable — verify with a test asserting the strip
  is `Proposal, Design, Specs, Tasks, Console` and that Console is selectable while every artifact tab is disabled
- [~] 2.2 Render the console panel: `TerminalView` from `src/ui/sessionPanel.tsx` plus the pane header (change,
  repository, agent, worktree path, branch, state badge) and the default responses — verify by opening a running
  session's detail view and seeing its earlier output followed by live output.
  Written: `ConsolePanel` (`src/ui/sessionPanel.tsx:243`) renders the `session-head` row — agent, repository,
  branch, state badge, work badge, in-place and adopted badges, `Copy cd` for the worktree path — above
  `TerminalView`, which carries the default responses unchanged. Awaiting your browser pass: a running session's
  replayed scrollback followed by live output.
- [x] 2.3 Render the session list in the `.detail-files` slot when the change has more than one session, showing action,
  branch and live state, omitted for a single session — verify with a test for a change with an Implement and an Archive
  session
- [~] 2.4 Carry the session's actions in the panel — End session, Clean up, Resume when available, Delete record, Copy
  cd — reusing the existing handlers and the end-session dialog unchanged — verify each opens the same dialog or
  performs the same call it did from the dock.
  Written: End session / Clean up goes through `ui.requestEnd` into the unchanged `EndSessionDialog`, Resume calls
  `api.resumeSession`, Delete record calls `api.deleteSession`, Ship calls `api.shipSession` with the unsent report,
  and `Copy cd` reuses `cdCommand` (`src/ui/sessionPanel.tsx:311-354`). Awaiting your browser pass: each one opening
  the same dialog or making the same call it did from the dock.
- [x] 2.5 Fall back to the first artifact with content when the URL names `artifact=console` for a change with no
  session — verify with a test that no error is reported

## 3. Behaviour in the overlay

- [x] 3.1 Guard `closeOnEscape` in `src/ui/changeDetail.tsx` so `Escape` with focus inside the terminal host reaches the
  agent instead of closing — verify with a test that the overlay stays open for a terminal-focused Escape and closes for
  one on the tab strip
- [x] 3.2 Keep the backdrop and the close control closing the overlay, and assert closing does not end the session —
  verify with a test that the session stays running and its card keeps the badge after a close
- [x] 3.3 Give the console panel a `min-height: 0` / `flex: 1` box in `src/ui/styles.css` so `FitAddon` measures a
  bounded host — verify the terminal fills the overlay without pushing the tab strip out, at desktop and at 400px width.
  The outer box was already bounded; what was missing is that `.console-pane` must itself be a column flex container,
  or the `flex: 1` on `.session-terminal` resolves against nothing. Measured in headless Chrome against the real
  stylesheet: the terminal was 0px and is now 658px in a 700px panel, at 1400px and at 400px width alike.
  `test/consoleLayout.test.ts` asserts the chain so it cannot silently break again.
- [x] 3.4 Ensure the poll does not remount or reset the terminal — verify with a test that a snapshot refresh keeps the
  selected tab, the selected session and the terminal's connection

## 4. Entry points and orphans

- [~] 4.1 Change `openPanel` in `src/ui/sessions.tsx` to navigate to the change's detail route with
  `artifact=console&session=<id>` — verify the card's running badge, the work-status badge and a next-step prompt all
  land on the Console tab with the terminal focused.
  Written: `openPanel` resolves the id and delegates to `openConsole`, which navigates to `changePath(repoId,
  change)` with `artifact=console&session=<id>` and carries `from` so the board to return to survives
  (`src/ui/sessions.tsx:114-128`); `start` calls `openConsole` by id and place for a session too new for its closure.
  Awaiting your browser pass: the card badge, the work-status badge and a next-step prompt all landing on the
  Console tab with the terminal focused.
- [x] 4.2 Widen `OpenWork` in `src/ui/sessions.tsx` to count and list running sessions alongside open worktrees, running
  first with their live badge, then stale, then the rest, hidden only when there is nothing at all — verify with unit
  tests for the count and the ordering
- [x] 4.3 Render the detail view rather than `ChangeNotFound` when the snapshot lacks the change but a session or
  worktree matches, with the artifact area explaining there is nothing to read — verify with a test for the archive
  worktree of an already-archived change
- [x] 4.4 Carry the repository accent on Open work entries with the repository name as text — verify with a test that an
  entry of an untracked repository renders without a tint and stays readable

## 5. Removing the dock

- [x] 5.1 Delete `SessionDock`, `SessionTabs` and the dock height/maximise/collapse logic from
  `src/ui/sessionPanel.tsx`, and its mount from `src/ui/app.tsx`, keeping `TerminalView` and the pane header — verify
  `bun run check` passes and the board has no reserved space at its foot
- [x] 5.2 Delete the pane and dock helpers from `src/ui/sessionState.ts` (`shownFromSearch`, `searchWithShown`,
  `showSession`, `hideSession`, `sessionTabs`, `MAX_SHOWN`, `clampDockHeight`, the `DOCK_*` constants) and the `panes`
  state from `src/ui/sessions.tsx`, keeping the focus counter used after a next-step prompt — verify no unused export
  remains and `bun run check` passes
- [x] 5.3 Delete the `.session-dock`, `.dock-*` and `.session-tabs` blocks from `src/ui/styles.css` and the `--dock-h`
  variable it sets on the document element — verify no rule references them and the board's bottom padding is gone
- [x] 5.4 Remove `test/dockGeometry.test.ts` and the dock-specific cases in `test/workStatusUi.test.ts` (`sessionTabs`
  ordering, three-pane rules, pane close, `?session=` round-trip), keeping the badge, stale and Open work cases — verify
  `bun test` passes with no skipped case

## 6. Colour and finish

- [x] 6.1 Style the Console tab and its panel frame and header with `--info` / `--info-border` in `src/ui/styles.css`,
  overriding the `--brand` bottom border of `.detail-tab.on` — verify both themes render the accent and the tab keeps
  its `Console` label
- [x] 6.2 Extend `test/repoContrast.test.ts` so `--info` is among the hues every assignable repository hue must keep 12°
  away from, and confirm the existing 19-repository assignment still passes — verify `bun test test/repoContrast.test.ts`
- [x] 6.3 Update `README.md` where it describes the dock, and re-take the screenshots that show it — verify the README's
  session section describes the Console tab and Open work

## 7. Verification

> Open boxes below and in groups 1–4 are the browser pass: the code is written, typechecks and
> passes `bun run check`, but their stated verification needs a real agent running in a real browser.

- [x] 7.1 Run `bun run check` clean (lint, typecheck, tests)
- [~] 7.2 Build and exercise `dist/openspec-dashboard` per invariant: open a change's Console tab, type into the agent,
  press `Escape` in the terminal, close and reopen the overlay, and confirm the session survives all of it.
  Done here: `bun run check` is clean (715 tests, 0 fail) and `bun run build` produces `dist/openspec-dashboard`,
  whose embedded `dist/ui/index.html` contains the console pane and no `session-dock`, `session-tabs`, `--dock-h` or
  `dockHeight` remnant. Awaiting your browser pass against the binary: typing into the agent, `Escape` in the
  terminal, and closing and reopening the overlay with the session surviving all of it.
- [x] 7.3 Walk the demo build (`src/ui/demo/`) and confirm its scripted session flow still reaches a terminal through
  the Console tab, with no dock left in the demo's screenshots or copy
- [x] 7.4 Run `openspec validate integrate-console-detail-view --strict` and confirm the implementation matches the
  delta specs, including that nothing was written to any tracked repository.
  It passed when first run and then broke, because two changes this one overlaps were archived in the meantime and
  moved the ground under the `kanban-board` delta. Both are fixed and `--strict` is clean again:
  `review-open-work-menu` left an `Open work list` whose `Stale worktrees stay out` this change reverses outright, and
  a `MODIFIED` block replaces a requirement whole, so it is now `REMOVED` with a `Reason` naming the four retired
  scenarios and `ADDED` as `Open work lists running sessions and unshipped work` (the `refactor-design` pattern);
  `refactor-design` itself had already removed `Cards show the work status of their change's worktree` from
  `kanban-board` and put the badge in the detail header with the Console-tab wording this change wanted, so that
  `MODIFIED` block had nothing left to modify and is dropped. The reasoning for both is in `proposal.md` under
  **Changes this one overlaps**. Nothing under `src/server/` changed in this change at all, so no new write to a
  tracked repository is possible; `test/pull.test.ts` and the worktree tests still pass.
