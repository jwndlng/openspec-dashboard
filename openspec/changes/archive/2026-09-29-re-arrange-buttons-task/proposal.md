# Proposal

## Why

While an agent works, a card carries three session controls at once: a status badge with a small `✕` beside the change
name, and — in the footer — the very starter that would type another prompt into that same session. The one thing the
user wants at that moment, opening the terminal, is the least prominent of the three, and the `✕` is a single click from
ending an agent's work in a card that is otherwise all read-only. The console quick link, meanwhile, appears and
disappears with the session, so the way into a terminal is never in the same place twice.

## What Changes

- **The starter's place becomes the status while a session runs.** A card whose change has a running session shows the
  session badge (`● working`, `◆ may need you 45s`) where the starter sat, and no starter; activating it opens the
  change's Console tab, as the badge already does. One rule for every running state, so no button appears and vanishes
  as the terminal falls silent. A card whose latest session failed or ended badly still shows that badge **and** the
  starter, so the next attempt is one click away.
- **The `✕` on a running badge is removed** from cards. Ending a session stays where the session is: **End session** in
  the Console tab's header, through the same graded end-session dialog. **REMOVED** requirement: "Running sessions can
  be ended from the card".
- **Next-step prompts are no longer offered on the card.** While a session runs the card shows only its badge; sending
  a Draft or Implement prompt into that running session stays available in the Console tab's header, unchanged.
- **The console quick link becomes a fixed slot in the card's top right**, shown on every card whose repository has
  agent sessions enabled — not only on changes that already have a session or a worktree. The change name keeps its own
  line and wraps within the width the slot leaves.
- **The Console tab becomes always available** when agent sessions apply to the change's repository. With neither a
  session nor a worktree it shows an empty state that says no agent has worked on this change yet and offers the
  change's starters, so the always-present quick link always leads somewhere useful.
- The card's separate status line under the age goes away: both of its occupants moved (the badge to the footer, the
  quick link to the top right), so the name and age sit directly above the progress bar.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: what a card shows and where — the session badge takes the starter's place while a session runs, the
  badge's close control and the card's next-step buttons go, and the console quick link becomes a permanent top-right
  slot. Requirements "Cards offer session starters and show session state", "Cards keep offering the next step while a
  session runs", "Cards show only what an overview needs", "Cards offer Show details"; "Running sessions can be ended
  from the card" is removed.
- `change-detail`: the Console tab exists whenever agent sessions apply to the repository, with an empty state offering
  the starters for a change no agent has worked on yet. Requirement "The console is a tab of the detail view".

## Impact

- `src/ui/kanban.tsx` — `ChangeCard`: the console link moves into the card top's right slot, the session controls move
  into the footer, the `card-status` line goes; `ConsoleLink`'s gate becomes `sessionsEnabledFor`.
- `src/ui/sessions.tsx` — `SessionControls` loses its `part` prop (the card is its only caller) and the `badge-x`
  control; badge and starters render together, with starters suppressed while any session for the change runs.
- `src/ui/sessionState.ts` — a new predicate for "the Console tab exists" (repository-level). `consoleAvailable` keeps
  its current meaning of "this change has a session or a worktree": the detail view still needs it for the change that
  is gone from the snapshot but whose worktree remains, which must not become a frame for every missing change.
- `src/ui/changeDetail.tsx` — Console tab availability from the new predicate; the change's identity passed to the
  console pane so its empty state can offer starters.
- `src/ui/sessionPanel.tsx` — `ConsolePanel` gains the "no session, no worktree" empty state with the starters.
- `src/ui/styles.css` — `.card-top` becomes a row with a reserved console slot, `.card-status` and `.badge-x` /
  `.session-chip` rules go, the footer gains badge spacing. No new colour token, so `test/repoContrast.test.ts` is
  unaffected.
- `test/changeDetail.test.ts` (card top order, the two anchors when sessions are on, tab availability),
  `test/workStatusUi.test.ts` (the new predicate beside `consoleAvailable`). `test/consoleLayout.test.ts` keeps
  asserting the flex chain; the empty state must not break it.
- The demo gets the new behaviour for free: no `src/ui/demo/` or server, API, config or dependency change, and no new
  git subcommand or write — invariants 1–7 are untouched.
- **Overlap with in-flight changes.** `restructe-task-title` (merged, not archived) owns the current text of "Cards show
  only what an overview needs" and "Cards offer Show details"; `integrate-console-detail-view` (merged, not archived)
  owns "Cards offer session starters and show session state", "Cards keep offering the next step while a session runs"
  and "The console is a tab of the detail view". The deltas here are written on top of those versions, so both changes
  must be archived first. No other in-flight change touches `sessions.tsx`, `sessionState.ts` or `sessionPanel.tsx`.
