# Design

## Context

See `proposal.md` — Why. What shapes the approach:

- `SessionControls` (`src/ui/sessions.tsx`) is the card's only session component and takes a `part` prop
  (`"status" | "starters"`) so `ChangeCard` can render the badge in the card's top and the starters in its footer. The
  card is its only caller, so `part` exists for exactly one layout — the one this change replaces. Its third branch
  (`part === undefined` renders the work badge) is already dead: the detail header uses `WorkStatus`/`WorkBadge`
  directly.
- `consoleAvailable(config, sessions, worktrees, repoId, change)` answers two different questions today: whether the
  detail view offers a Console tab, and — in `changeDetail.tsx` — whether a change that is **gone from the snapshot** is
  still worth a frame rather than a "not found". The second reading must keep the "a session or a worktree exists"
  meaning, or every mistyped change name in a sessions-enabled repository would render an empty console frame.
- `ConsolePanel` already has one no-terminal state (a worktree whose session record is gone). It derives the change from
  `session`/`worktree`, so with neither it knows nothing — it cannot offer starters without being told which change it
  is for.
- `resolveSelection(artifacts, query, hasConsole)` decides the selected tab and already falls back when the URL names
  the Console tab without one.
- Both spec deltas build on requirements owned by `restructe-task-title` and `integrate-console-detail-view`, merged but
  not archived; `openspec validate` reports the `change-detail` MODIFIED as "not found" until the latter is archived.
  That is expected, not a defect (see `proposal.md` — Impact).

## Goals / Non-Goals

**Goals:**

- One place decides what a card shows about a session, so the badge and the starter can never both appear while a
  session runs.
- A console entry point that never moves: same corner, same card, whether or not an agent has ever run.
- No behaviour lost, only relocated: ending a session and sending a next step keep their code paths and their
  submit-then-Enter rules; only their entry points change.

**Non-Goals:**

- No change to the server, the API, the session records, the terminal WebSocket or any guard.
- No change to how a session is started, ended, resumed or shipped, nor to the end-session dialog itself.
- No change to `sessionBadge`'s states or wording, nor to the running badge's motion.
- No new demo data: the demo starts with agent sessions enabled, so it exercises the new layout as it stands.

## Decisions

### The card renders session state once, in its footer

`SessionControls` loses `part` and renders badge and starters together; `ChangeCard` calls it once, in the `.meta`
footer, and the `.card-status` line disappears.

*Alternatives.* Keep `part` and have `ChangeCard` pass `"starters"` twice — the card would then have to re-derive
"is a session running" to decide what to render, duplicating the rule. Or add a `part="footer"` — a third value for a
component with one caller and one layout.

The dead `part === undefined` work-badge branch goes with `part`; `WorkBadge` stays exported for the detail header and
`OpenWork`.

### The badge-or-starter rule is a pure helper, not a condition in the component

`cardSessionControls(config, sessions, card)` returns `{ shown, starters }`: the sessions to badge, and the starters —
empty while any of them runs. `SessionControls` renders what it is handed.

The rule has to be the same on a card and in the console's empty state, and it is the change's whole observable
behaviour here, so it belongs where the project's other session rules live and can be tested: `test/vnode.ts` walks
VNodes without a DOM and leaves a component that uses hooks as an opaque leaf, so a rule inside `SessionControls` could
not be asserted on at all without adding a renderer dependency — which the no-network, no-new-dependency shape of this
project does not want for one component's branch.

`sessionsForChange` stays as it is: it already returns the running sessions, else the latest one when that failed or
exited badly, so `some(s => s.state === "running")` is the whole rule and "a failed session keeps its starter" falls out
of the existing selection rather than a second query.

### The card's starters lose their "into the running session" branch

With no starter shown while a session runs, `nextStepFor` can never report a prompt target from a card: it is reached
only when nothing of the change is running. So `SessionControls` drops it and always renders an opening (`▶`), never the
`↳` "sends the prompt to the running session" form. That branch is not lost — the console pane's own next-step buttons
are where it lives, and where its result is visible (see the `change-detail` requirement).

### Two predicates instead of one

`consoleAvailable` keeps its signature and meaning — this change has a session or a session worktree — and keeps its
one job: deciding that a change missing from the snapshot still deserves the console frame. A new
`consoleTabAvailable(config, repoId)` (a thin, tested alias of `sessionsEnabledFor`) answers "does this change get a
Console tab" and "does this card get a console quick link", which are now the same question, asked per repository.

*Alternative.* Widening `consoleAvailable` to `sessionsEnabledFor` and giving the gone-from-snapshot branch its own
inline check: the same two predicates, but with the sharp-edged one unnamed and untested. A named pair keeps the
distinction visible at both call sites.

### The console quick link is a layout slot, not a floating icon

`.card-top` goes back to a row: the existing `.card-title` column (name over age) with `min-width: 0` so the name wraps
instead of overflowing, and the link as a fixed-size sibling aligned to the top. No absolute positioning — the name's
wrapping must account for the icon, which is exactly what a flex sibling gives and an overlay does not. Because the slot
is drawn whenever agent sessions apply to the repository, there is no "sometimes present" case to reserve space for; a
board with the feature off has no slot at all and the name keeps the full width, as before.

### The empty console offers starters by reusing `SessionControls`

`ConsolePanel` takes an `of` prop — the `repoId` and change name it stands for — because with neither session nor
worktree it has nothing else to go on, and it resolves the change from the snapshot itself (as it already did for the
next steps). With no session `SessionControls` renders exactly the starters and no badge, so the component already used
on cards serves the empty state — one implementation of "which starters does this change's stage allow, and is the agent
available", including the disabled-with-a-reason case.

Its existing next-step buttons (offered only where the prompt would reach the shown session) are untouched: the
`change-detail` "The console tab offers the change's next step" requirement writes down what the pane already does, plus
the empty state's starters.

### `ChangeDetail` keeps its two branches

The tab strip's `hasConsole` becomes `consoleTabAvailable`; the gone-from-snapshot branch keeps `consoleAvailable`, so a
change that is neither in the snapshot nor backed by a session or worktree still reports "not found". `resolveSelection`
needs no change beyond being handed the new flag.

## Risks / Trade-offs

- **The card loses the fastest way to end a runaway agent** → deliberate (see the removed requirement's Reason); the
  console quick link is now always in the same corner, so **End session** is two activations away from any card instead
  of one, and an accidental end is no longer one mis-click away from a badge that repaints every three seconds.
- **The card loses the fastest way to send the next step into a running session** → the Console tab keeps that button,
  beside the terminal it types into, which is where its result (typed, or typed and submitted) is visible at all. Users
  who relied on the card's button gain one navigation; the quick link makes it a single activation.
- **Always showing the console link adds an icon to every card, including repositories whose agent is not installed** →
  the link leads to the Console tab, whose empty state offers the starters and explains a missing agent, so the icon is
  never a dead end. Cards in repositories excluded from agent sessions, and every card with the feature off, show no
  icon.
- **A running badge in the footer may wrap onto its own line** where the starter fitted, because
  `may need you 45s` is wider than `▶ Implement` → the footer already wraps (`.meta` is `flex-wrap`), so the worst case
  is a two-line footer, not a clipped badge; the narrowest column width is covered when the layout is checked in the
  running app.
- **`test/consoleLayout.test.ts` asserts the flex chain the terminal's height depends on** → the empty state is a
  sibling of the terminal inside the same pane, exactly like the existing worktree-only empty state, so the chain is
  unchanged; the test stays as the guard that it is.
- **Archive order** → both deltas build on requirements from two merged-but-unarchived changes, and `openspec validate`
  reports the `change-detail` one as not found until `integrate-console-detail-view` is archived. Archiving out of order
  would silently lose requirement text, so the order is recorded in `proposal.md` — Impact.
