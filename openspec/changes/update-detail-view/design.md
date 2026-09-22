# Design

## Context

See `proposal.md` — Why. What shapes the approach:

- `/repo/<id>/change/<name>` is a real client-side route (`routes.ts`), rendered by `App` as an alternative to the
  board. `changePath`/`serializeDetailQuery` put the selected artifact, file, raw toggle and the originating board
  (`from`) in the URL; `backTarget(from, repoId)` already validates `from` and answers "which board does this view
  belong to". Both routing modes (path and hash) go through `url.ts`.
- `Kanban` reads its filters from `currentQuery()` **once, at mount**, and writes them back with `replaceQuery` when
  they change. It also owns board-local state that is not in the URL: minimized groups and the scroll position of the
  board.
- `ChangeCard` renders the change name as an `<a class="card-link">` whose `::after` is stretched over the whole card,
  with the copy button and the session starters as siblings so they can never navigate.
- `App` renders `topbar`, `main` and `SessionDock` as siblings; the dock holds live terminals.
- Everything is one embedded HTML file, no network, no new dependency (invariant 4). The change is UI-only: no server,
  API or scanner code is touched, and nothing about the dashboard's read-only stance changes.

## Goals / Non-Goals

**Goals:**

- The detail view reads as an overlay *on the board it belongs to*, and closing it lands back on exactly that board,
  in the state it was left in.
- The route keeps working as it does today: linkable, reloadable, new-tab-able, both routing modes.
- One place decides which board an open detail view belongs to.

**Non-Goals:**

- No change to what the artifact endpoints return, how artifacts are listed, or how Markdown is rendered.
- No general modal/dialog abstraction for the dashboard; the session panel, the end-session dialog and the new-change
  form keep their current shapes.
- No new keyboard navigation beyond `Escape`; artifact tabs keep the behaviour they have.

## Decisions

### The overlay stays a route, not component state

The board could own a "detail open for card X" state and skip the URL entirely. Rejected: the `change-detail` spec
requires the view to be linkable, to survive a reload and to open in a new tab from a card, and `?artifact=&file=`
links are the way the project shares a spec file. Keeping the route also means hash routing needs no special case.

So: `route.view === "change"` continues to be the trigger; only what `App` renders for it changes.

### `App` renders the board and the overlay together, with the board's identity from `backTarget`

For `route.view === "change"`, `App` computes `back = backTarget(parseDetailQuery(currentQuery()).from, route.repoId)`
and renders the board that `back.path` names (combined or repository) plus the overlay. `backTarget` already rejects a
`from` that is not one of this app's boards, so a crafted URL cannot make the dashboard render something else, and the
same function answers both "what is behind the overlay" and "where does closing go" — they cannot drift apart.

Alternative rejected: render the detail view full-page and only *style* it like an overlay (dimmed page, centred
panel, no board behind). Cheaper, and it would satisfy "looks like an overlay", but closing would still be a
navigation into a freshly mounted board, and the point of the change — glance at a change, drop back to the board — is
exactly what the board staying put delivers.

### The board component is shared between the board route and the change route

`App` renders **one** `<Kanban>` for the views `board`, `repo` and `change`, keyed by the board's path (`/board` or
`/repo/<id>`; for the change route, `back.path`). Because the key and the position are unchanged when the user opens a
card, Preact reuses the instance: the board is not remounted, so its filters, minimized groups and scroll position are
simply still there when the overlay closes. No state has to be lifted, serialised or restored.

Two consequences to handle:

- **Filters on a direct URL open.** On a fresh mount at the change route, `currentQuery()` is the *detail* query, not
  the board's. `Kanban` therefore takes an optional `query?: string` prop for its initial filters, defaulting to
  `currentQuery()`; the change route passes `back.query`. It is read once at mount, exactly like today.
- **No URL writes from behind the overlay.** While the overlay is open the board is inert (below), so `setFilters` —
  the only writer of `replaceQuery` in `Kanban` — cannot be reached, and the detail query in the URL is safe.

### The board behind is made inert; the overlay is a modal dialog

While the overlay is open, `App` marks the wrapper around the topbar, the board and the session dock with `inert`
(plus `aria-hidden` and `pointer-events: none`/`overflow: hidden` in CSS as the visual and older-browser fallback).
`inert` gives, in one attribute, everything the spec's "the board behind it MUST NOT be operable" needs: no pointer
events, nothing focusable, nothing read by a screen reader — which also means the browser's natural tab order never
leaves the overlay, so no hand-written focus trap is needed.

The overlay itself is `role="dialog" aria-modal="true"` with an accessible name from the change. On mount it moves the
focus into the panel and remembers the previously focused element; on unmount it restores it.

Alternative rejected: a focus-trap loop over the overlay's focusable children — more code, and it still would not stop
a click on a card behind the backdrop.

### Closing is a navigation to `back`, not `history.back()`

`history.back()` is wrong whenever the view was opened by a pasted URL or in a new tab: there is no board entry to go
back to. Closing therefore navigates to `back.path + back.query`, which is also what the existing back link does — one
code path for the close button, `Escape` and the backdrop.

`Escape` is handled by a `keydown` listener registered while the overlay is mounted.

### The card: one explicit link, nothing stretched

`ChangeCard` drops the stretched `.card-link` anchor and the copy button and gains a **Show details** anchor in the
row where the copy button sat, built from the existing `cardLink(card, from)` (so `from` still carries the board and
its filters, and ⌘/middle-click still opens a new tab). The change name becomes plain text.

This removes the only reason the card had `position: relative` with an `::after` overlay, and with it the rule that
every interactive element on a card must be a sibling of the anchor rather than inside it.

### The apply and start commands leave the code, not just the UI

With both call sites gone, `applyCommand`, `startCommand`, `copyCommandFor`, `isStartColumn` and `APPLY_COLUMNS` in
`format.ts` have no callers. They are deleted rather than kept "just in case": the commands are documented in the
removed requirements' **Migration** notes and in the README. `cdCommand` and `shellQuote` stay — the repository board
header and the session panel still use them.

## Risks / Trade-offs

- **`inert` support.** → Chromium, WebKit and Firefox have shipped it; the dashboard is opened in a local desktop
  browser. The CSS fallback (`pointer-events: none`, `overflow: hidden`) and `aria-hidden` keep the board unusable and
  unannounced even where the attribute is ignored; only "nothing focusable" would degrade.
- **The board renders behind the overlay, so a very large board pays its layout cost while the user reads.** → It is
  the same board that was already on screen a moment earlier, and reusing the instance means no re-render on open.
- **The session dock becomes inert while the overlay is open**, so a running terminal cannot be typed into until the
  overlay is closed. → That is what a modal means, and closing is one `Escape`; no session is ended, paused or hidden.
- **The status labels are gone from the detail view**, so a change opened by a pasted URL shows no column, progress or
  branch until the user closes the overlay. → Deliberate (see the proposal); the board behind is one `Escape` away,
  and warnings — the only labels that signal something broken — stay.
- **Losing the copy-apply action is a real removal for anyone who used it.** → Documented in both deltas' **Migration**
  notes and in the README; agent sessions, the intended path, are unaffected.
- **A stale bookmark of a detail URL whose `from` names a board that no longer exists** (e.g. a removed repository) →
  `backTarget` already falls back to the change's repository board, and `Kanban` already renders "Repository not
  found"; the overlay itself still renders its own not-found state.
