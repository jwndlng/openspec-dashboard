# Proposal

## Why

Activating a starter on a card — **Draft artifacts**, **Implement**, **Validate**, **Archive** — starts the agent and
then immediately navigates away from the board into the change's detail view on its Console tab. Most starts need no
attention: the user kicks off a draft for one change, then another, and lets them run. Each start currently throws the
user out of the board, so starting three drafts means three round trips back. The card already shows the running
session's badge, and activating that badge opens the terminal, so the jump buys nothing a click cannot.

## What Changes

- **Starting from a card stays on the board.** A card's starter starts the session and leaves the user where they are.
  The card then shows the session's badge in place of its starters — exactly as it does today for a running session —
  and activating that badge, or **Show details**, opens the Console tab as before. This applies to every card starter,
  not only **Draft artifacts**: the rule is "a card never navigates on its own", which is simpler to learn than a
  per-action exception.
- **A start that fails still says so on the card**, as it does today. A session that is created but fails to launch
  shows its failure badge on the card, which keeps its starters.
- **Unchanged where the user already looks at the console.** The Console tab's starters for a change no agent has
  worked on, and the next-step starters that send a prompt to a running session, keep showing that session's terminal
  in the same tab — the user is already there, so nothing is "opened".
- No server, API or session-lifecycle change. Starting a session is the same request; only what the UI does
  afterwards differs.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `kanban-board`: a new requirement, "Starting a session from a card stays on the board". It is added rather than
  written as a modification of "Cards offer session starters and show session state", because that requirement never
  said a start navigates: the jump was implementation, not specified behaviour. `change-detail`'s "Starting from the
  empty console" scenario already says the same Console tab shows the terminal and stays as it is.

## Impact

- `src/ui/sessions.tsx` — `start` takes whether to show the new session's console afterwards; `SessionControls` passes
  "stay" when rendered on a card and "show" when rendered in the Console tab. The next-step starters in
  `src/ui/sessionPanel.tsx` keep showing the console.
- `src/ui/kanban.tsx`, `src/ui/sessionPanel.tsx` — tell `SessionControls` where it is rendered.
- `src/ui/sessionState.ts` — a small pure rule for whether a start from a given place shows the console, so it can be
  tested without a renderer.
- `test/` — a test of that rule (card: stays; Console tab and next step: shows).
- `README.md` — only if it describes starters opening the console.
- No dependency, invariant, server or API change.

## Non-goals

- A setting to choose between staying and jumping. If the jump is wanted, the badge is one activation away.
- A toast or notification announcing that the session started; the card's badge is that signal.
- Changing what the Open work list or the session badge do when activated — both still open the Console tab.
