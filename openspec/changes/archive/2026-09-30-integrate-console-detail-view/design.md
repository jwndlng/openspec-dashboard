# Design

## Context

See `proposal.md` — Why. What shapes the approach is where the two surfaces sit in the component tree today:

- `SessionProvider` (`src/ui/sessions.tsx`) wraps the top bar, `<main>`, `SessionDock` and `EndSessionDialog`, all
  inside `div.app` (`src/ui/app.tsx:150-216`).
- **`ChangeDetail` is rendered at `src/ui/app.tsx:217-220`, outside `div.app` and outside `SessionProvider`** — it has
  no access to `useSessionUi()` at all. It is outside on purpose: while the overlay is open, `div.app` is marked
  `inert` + `aria-hidden` so the board behind cannot be operated.
- The detail view's selected tab is not component state; it lives in the URL query (`DetailQuery` in
  `src/ui/routes.ts:35-57`), read and mirrored back by `ChangeDetail`.
- `TerminalView` (`src/ui/sessionPanel.tsx:64-195`) is already self-contained: xterm.js + `FitAddon` + a
  `ResizeObserver`, themed from CSS tokens read off its host element, streaming over `api.openTerminal`.
- Blue already exists in the token set as the `info` status role: `--info` / `--info-border`, defined for both themes
  (`src/ui/styles.css:27-28` dark, `:81-82` light), already used by `.badge.info`.

Invariant 1 is not touched: nothing here writes to a tracked repository. Invariant 2a is not touched: no route changes,
and the terminal WebSocket keeps `webSocketRefusal` exactly as it is.

## Goals / Non-Goals

**Goals:**

- One console surface, reachable only through a change's detail view, with the cross-repository view living solely in
  Open work.
- Reuse `TerminalView` and the pane header verbatim rather than writing a second terminal component.
- Keep every session-related guarantee that is about *sessions* rather than about the dock: attaching late replays the
  scrollback, closing never ends a session, text typed on the user's behalf still goes through the echo check, input
  reaches only the session it was typed into.

**Non-Goals:**

- No server, API or `src/shared/` change. `Session` already carries `repoId` and `change`, which is the whole link the
  console tab needs.
- No new colour token and no change to `src/ui/theme.ts`. Reusing `--info` keeps `test/repoContrast.test.ts` green
  without retuning repository hues.
- Not replacing the end-session dialog, the clean-up flow, Ship, work status or the pull-after-end flow — they move
  surface, not substance.
- No side-by-side terminals in any form. That capability is removed, not relocated.

## Decisions

### Hoist `SessionProvider` above `ChangeDetail`, keep `inert` where it is

`ChangeDetail` needs `useSessionUi()`. Two ways: move `ChangeDetail` inside `div.app`, or lift `SessionProvider` to
wrap both. Lifting the provider is chosen — moving `ChangeDetail` inside `div.app` would put the overlay inside the
element that gets `inert`, which would make the overlay itself inoperable. The provider is pure context with no DOM, so
lifting it changes nothing visually; `inert` stays on `div.app` and the overlay stays its sibling.

`PullProvider` already wraps both (`app.tsx:148, 221`), so this is the established shape.

### The tab strip gains one non-artifact entry, not a generalised tab model

`ArtifactTabs` (`src/ui/changeDetail.tsx:181-204`) maps `listing.artifacts`. Rather than inventing a tab abstraction,
it renders the artifact tabs as today and appends one Console tab when `sessionsForChange()` returns anything. The
Console tab renders no `state` pill, which is what the spec asks for and falls out of the branch naturally.

Alternative considered: model the console as a synthetic artifact in `ChangeArtifacts`. Rejected — that is server data
describing files on disk, and a session is neither.

### Tab and session selection stay in `DetailQuery`

`DetailQuery` gains `artifact: "console"` as an accepted value plus a `session?: string`. This is how the existing
"Selection is linkable" requirement is already satisfied, and it means the poll cannot reset the selection (the query
is the source of truth, not state rebuilt on each render). Stale values fall back through the same `resolveSelection`
path that already handles a stale artifact or file.

The old `?session=a,b,c` parameter is deleted rather than reinterpreted: a one-pane-per-change model has no ordering,
and silently reading a three-id list as "the first one" would be a worse surprise than landing on the board.

### The session list reuses the file-list slot

For the `specs` artifact the detail view already shows a secondary list next to the content (`FileList`,
`.detail-files`). The Console tab's session list occupies the same slot with the same interaction, so a change with an
Implement and an Archive session reads like a change with two spec files. No new layout.

Default selection is the session with the most recent `lastOutputAt`, falling back to `updatedAt` — "most recently
active", which is what a user coming from a card's badge means.

### `Escape` is decided by focus, not by the selected tab

`closeOnEscape` (`src/ui/changeDetail.tsx:106-112`) gets a guard: if the event's target is inside the terminal host, do
nothing and let xterm handle it. Not a tab-level flag — the user asked for the terminal to take Escape *when focused*,
and a focus check is both more precise and cheaper than tracking a mode. The backdrop and the close control are
untouched, so there is always a pointer route out.

### Blue is `--info`, applied to the tab and the panel frame

`.detail-tab.on` uses `border-bottom-color: var(--brand)` (teal). The Console tab overrides that to `var(--info)` and
the console panel takes `--info-border` on its frame and header. No literal colour, both themes covered for free, and
no new hue for `test/repoContrast.test.ts` to police — though that test's status-hue list should gain `--info` if it
does not already include it, since the spec now says no repository may wear the console colour.

### `openPanel` becomes navigation

Everything that called `ui.openPanel(sessionId)` — the card badge, the work badge, Open work, a starter sent into a
running session — now navigates to `changePath(repoId, change)` with `artifact=console&session=<id>`. Keeping the name
`openPanel` and changing only its body means the call sites barely move, and there is one place that decides what
"open a session" means.

Consequence: `panes`, `focusedId`, `focusTick` and the pane helpers in `src/ui/sessionState.ts` go. `focusTick` has one
surviving job — focusing the terminal after a next-step prompt — so it is kept as a plain counter on the context and
the pane bookkeeping around it is dropped.

### Orphan sessions render a detail view without artifacts

A session's `repoId` and `change` are enough to build the route. `ChangeDetail` currently renders `ChangeNotFound` when
the snapshot has no such change; it will first check whether any session or worktree matches, and if so render the
normal frame with the artifact area explaining there is nothing to read. This keeps exactly one console surface, which
was the point of the change, and it is the only way an interrupted archive session stays reachable once its change is
gone from the board.

### The terminal needs a bounded box in the overlay

`.detail` is a flex column with `overflow: hidden` (`src/ui/styles.css:661-666`). xterm's `FitAddon` measures its host,
so the console panel must give it `min-height: 0` and `flex: 1` the way `.session-terminal` does today
(`styles.css:525-528`), or the terminal will grow unbounded and push the tab strip out. The existing `ResizeObserver`
then handles the overlay's responsive widths without further work.

### The Open work list is keyed by session, not by worktree

Two changes landed on `main` while this one was being written, and both bear on this list.

`review-open-work-menu` replaced the worktree-keyed `openWork` with a session-keyed `openSessions` and dropped
worktrees from the list entirely. `sessions-in-non-git-repos` then added sessions that run **in place**, which have no
worktree at all.

The merge keeps the session keying — an in-place session exists only as a session, so a worktree-keyed list cannot show
it — and appends the worktrees that have no running session. So `openWork` returns `OpenWorkItem`s rather than
`SessionWorktree`s: a row is a running session (with its worktree when it has one) or a leftover worktree, and each
worktree appears at most once. The count partitions the same way, so it always equals the rows that are not merged.

Alternative considered: keep both helpers and render two lists. Rejected — one control with one count is the thing a
dockless UI needs, and two lists reintroduce the "where is it?" problem this change exists to remove.

## Risks / Trade-offs

- **Watching two changes at once is no longer possible in one window** → Accepted; it is the crowding the change
  removes. Several viewers may attach to one session, so two browser windows on two detail views give the old
  behaviour to anyone who wants it. Called out in the REMOVED requirement's Migration.
- **The terminal is inside a dismissable modal; a stray backdrop click hides an agent mid-run** → The agent keeps
  running and the card keeps its badge, which the spec now states explicitly and a test asserts. Reopening replays the
  scrollback. Escape, the likelier accident for a terminal user, is already handled by the focus guard.
- **`unmount` of `TerminalView` on every close means reattaching on every open** → Already the supported path
  (`agent-sessions`: "a viewer that attaches later SHALL first receive what the terminal has shown so far (bounded),
  then follow live"), and it is what closing the dock did too. No new server behaviour.
- **A change with two sessions hides one behind a list** → The list shows both with action, branch and live badge, and
  the Open work list shows every running session across the whole dashboard, so neither is invisible.
- **Deleting the dock is a large diff across `sessionPanel.tsx`, `sessionState.ts` and `styles.css`** → Mitigated by
  doing the removal in its own task after the console tab works, so the two halves can be reviewed separately and the
  console is never absent from the app.
- **`test/dockGeometry.test.ts` asserts a CSS rule that will not exist** → It is removed with the dock; its intent (the
  reserved space equals the strip height) has no successor because nothing is reserved any more.
- **Reversing `review-open-work-menu`'s exclusion of worktrees** → Only the exclusion is reversed, not its session
  rows, and the requirement says why. Its delta has to archive first; noted in the proposal's Impact.
- **`demo-site` mentions "the session panel opens with a terminal"** → Placement-neutral wording that the Console tab
  satisfies, so that spec needs no delta. Worth re-reading when the demo's scripted flow is updated.

## Migration Plan

No data migration: session records, worktrees and the activity log are untouched, and nothing on disk encodes the dock.
Browser-local state does: the `osd.dockHeight` key in `localStorage` becomes dead and is simply left (the dashboard
already tolerates unknown keys; removing it would need code that exists only to delete it). Links carrying
`?session=a,b,c` land on the board with the parameter ignored.

Rollback is a revert of the branch — nothing outside the browser changes state.
