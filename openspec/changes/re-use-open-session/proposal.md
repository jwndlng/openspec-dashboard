# Proposal

## Why

A change is one piece of work with one agent, but the dashboard still lets two agents run for it at once: every action
reuses the change's running session except **Archive**, which opens a second session in a worktree of its own. The
result is two consoles for one change — two tabs in its Console list, two rows in Open work, two terminals to
watch — and, in a tracked folder that is not a git repository, two agents editing the same folder at the same time,
because an in-place session has no worktree for the "one running session per worktree" rule to protect.

The exception does not even buy the user anything: while a session runs, the card offers no starters and the Console
tab offers only the actions that go into that session, from which Archive is filtered out. So Archive is reachable
exactly when no session runs — and the one way to archive a change whose agent is still up is to end its session
first. One rule serves the user better in both directions: a change has one active console, and every action the
change's stage allows goes into it.

## What Changes

- **One open session per change.** Opening a session for a change that already has one running SHALL return that
  session and start nothing, whatever action was asked for. Archive loses its exception, so it can no longer start a
  second agent beside a running one — nor, in a folder without git, a second agent in that same folder.
  **BREAKING** for anything that relied on `POST /api/sessions` with `action: "archive"` opening a session of its own
  while another session of the change is running; it now gets the running session back.
- **Every action can be sent into the running session.** `POST /api/sessions/<id>/prompt` accepts `archive` and
  accepts any action for a session whose own action is `archive`; the refusals that matter stay — the action must be
  available in the change's current stage, the agent must have a prompt for it, and the session must be running. The
  prompt still goes in under the rules for text sent on the user's behalf, so a selection menu is never confirmed and
  a prompt that was only typed is reported as such.
- **The Console tab's next steps therefore include Archive** for the change's running session, which is what makes
  archiving reachable without ending the agent first. No control moves and no new control appears: the next-step list
  is derived from what may be sent into the session shown.
- **Archive keeps its own worktree when it opens a session.** With no session running, **Archive** still creates
  `archive-<change>` on `chore/archive-<change>` as before — archiving a merged branch does not belong on that branch.
  Only the concurrent second session goes away.
- **The demo recording follows.** Its `open` already reuses any running session of a change; its `prompt` drops the
  archive refusal so the demo and the dashboard answer the same way.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: at most one session per **change** may be open, not one per worktree, and a starter's prompt may
  be sent into it for any action the stage allows. Requirement "Session lifecycle and control" is modified;
  "A starter's prompt can be sent to a running session" is removed and replaced by "Any available action can be sent
  to the change's running session", because its Draft-and-Implement-only rule was the whole of what changes.
- `dashboard-api`: what `POST /api/sessions` returns for a change that already has an open session, and the refusals
  of `POST /api/sessions/<id>/prompt`. Requirements "Session endpoints" and "Prompt endpoint and fresh work status".

Not modified, deliberately: `kanban-board` (a card offers no starter while a session runs — owned by the in-flight
`re-arrange-buttons-task`, and unchanged by this proposal) and `change-detail`, whose Console-tab next-step
requirement lives in that same in-flight change rather than in `openspec/specs/`. Which actions may be sent into a
running session is an `agent-sessions` question, and the buttons follow it.

## Impact

- `src/server/sessions/manager.ts` — `open()` reuses the change's open session regardless of action; `prompt()` drops
  the two archive refusals. No change to worktree creation, branches, work status, Ship, cleanup or pull.
- `src/ui/sessionState.ts` — `nextStepFor` returns the change's running session for every action; its `blocked` result
  for Archive is no longer needed.
- `src/ui/sessionPanel.tsx` — comments only: the next-step list and the session list already derive from the above.
- `src/ui/demo/demoSessions.ts` — `prompt` accepts `archive` and an archive session.
- Tests: `test/sessionPrompt.test.ts`, `test/terminalSessions.test.ts`, `test/workStatusUi.test.ts`,
  `test/demoSessions.test.ts` assert the old exception and are rewritten for the new rule.
- No change to the dashboard's writes: no new git command, no new path written, no remote contacted.
