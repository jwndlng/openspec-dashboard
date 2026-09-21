# Design

## Context

`SessionManager.open()` returns the running session for a repository and change instead of opening another; `SessionControls` renders *either* the badge *or* the starters. `ship()` already shows the pattern of writing a prompt into a live terminal. The panel renders one `TerminalView`, keyed by session id; the server replays scrollback to any viewer that attaches, so switching views is cheap. The open change `agent-console-quick-replies` adds a row below the terminal and verified with the preconfigured agent that in a selection menu typed text is ignored and Enter confirms the highlighted option.

## Goals / Non-Goals

**Goals:** steer several sessions from one panel; keep the workflow moving inside one session; make ending a session safe.
**Non-Goals:** several terminals visible at once; detecting what state the agent is in; changing Ship; configurable tabs or layouts.

## Decisions

### D1 — Tabs are a UI concern
`sessionTabs(sessions, panelId)` (pure, in `sessionState.ts`): running sessions oldest first, plus the shown one if ended. The panel renders `role="tablist"` buttons; selecting calls the existing `openPanel(id)`, which already updates `?session=`. `TerminalView` stays keyed by id, so a switch disposes one xterm and the server replays the other's scrollback. *Alternative:* keep every terminal mounted and hide the inactive ones — instant switching, but N sockets and xterm instances for something the replay already solves.

### D2 — Next step = prompt into the live terminal, without Enter
`manager.prompt(id, action)`: same validation as `open()` for the stage and the agent's prompt, session must be running, `archive` refused; then `proc.write(prompt)` and `session.action = action`. No `\r`: a quiet terminal can just as well be a permission menu whose highlighted entry is "Yes", and the dashboard must never be the one who confirms it. The UI opens the panel and focuses the terminal, so sending is one keystroke. *Considered:* pressing Enter when the session is quiet — quiet does not distinguish a prompt from a menu, so it buys nothing. Ship currently does press Enter in a running session; aligning it is a follow-up question for the user, not part of this change.

The UI decides between `openSession` and `promptSession` with `nextStepFor(sessions, card, action)`: a running session whose `action` is not `archive` exists → prompt it, unless the action is `archive`.

### D3 — One running session per worktree
The duplicate check in `open()` and the conflict check in `prepareRestart()` compare `worktreePath` instead of repository + change. Archive (own worktree) can then run next to the feature session; everything else behaves as before. `sessionForChange` in the UI returns a list of sessions to show (running ones, else the latest failed one) so a card can carry two badges.

### D4 — One end-session dialog
`endSessionDialog.tsx` replaces the panel's `CloseDialog` and is opened from the provider (`ui.requestEnd(id)`), rendered as an overlay so it works from a card. It calls `GET /api/sessions/:id/worktree`, which now returns `{ removable, reason, work }` with `work` read directly (the list's 15 s cache is too stale for a warning). Grade: `endSeverity(work)` → `plain | notice | danger` (pure, tested). `danger` adds **Ship instead** (`api.shipSession`, then opens the panel) and labels the confirm **End anyway**.

## Risks / Trade-offs

- Typed prompt lands in whatever the agent shows → it is visible, not sent, and the panel is open; the user decides.
- A prompt typed into a busy agent is queued by that agent → same as typing it by hand.
- Two badges on a card during archive → rare and accurate.
- Merge order with `agent-console-quick-replies`: both edit `sessionPanel.tsx`; this change stays in the header and is rebased after that one merges.
