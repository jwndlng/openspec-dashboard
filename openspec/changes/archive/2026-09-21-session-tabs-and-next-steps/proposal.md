# Proposal

## Why

Agent sessions in the dashboard's console work well for one session at a time, but three things get in the way once several run:

1. The panel shows one session. To look at another, the user has to hide the panel and find the other card.
2. A card with a running session shows only the session badge. When a Draft session finishes and the change moves to `Ready`, the **Implement** button never appears, although the agent sits idle in a terminal that could take the next prompt.
3. A session can only be ended from inside the panel, and ending it says nothing about whether its work was shipped.

## What Changes

- **Session tabs.** The session panel gets a tab strip with every running session (repository, change, live badge) plus the session currently shown if it has ended. Selecting a tab switches the terminal; nothing is ended, and ✕ still only hides the panel.
- **Next step in a running session.** A card keeps offering the starters that fit the change's *current* stage while a session for it runs. With a running session in the change's own worktree, Draft and Implement do not open a second session: the starter's prompt is typed into that session's terminal and the panel opens with the terminal focused. It is typed **without pressing Enter** — the user presses Enter — because a terminal cannot tell the dashboard whether the agent shows a text prompt or a selection menu, and in a menu Enter would confirm whatever is highlighted (same finding and same rule as the console's default responses). The same buttons appear in the panel header.
- **Archive keeps its own worktree.** Archive still opens its own session on `chore/archive-<change>`, also while the change's other session runs. "One running session" therefore becomes one per *worktree* instead of one per repository and change.
- **End from the card.** The running badge gets a small ✕. It opens the same end-session dialog the panel uses, now graded by the worktree's work status, read fresh: plain confirmation when there is nothing unshipped, a notice for `pushed` work, and a strong warning naming the counts for `uncommitted` or `unpushed` work, with **Ship instead** offered next to **End anyway**. The worktree is kept in every case unless removal is safe and chosen.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: one running session per worktree; new requirement for sending a starter's prompt to a running session.
- `dashboard-api`: `POST /api/sessions/<id>/prompt`; `GET /api/sessions/<id>/worktree` also returns the work status.
- `kanban-board`: cards keep stage starters next to a running badge and get the ✕; the panel gets tabs and next-step buttons; the end-session dialog is graded by work status.

## Impact

- Server: `src/server/sessions/manager.ts`, `src/server/api.ts`.
- UI: `src/ui/sessions.tsx`, `src/ui/sessionPanel.tsx`, `src/ui/sessionState.ts`, new `src/ui/endSessionDialog.tsx`, `src/ui/api.ts`, `src/ui/demo/demoApi.ts`, `src/ui/styles.css`.
- Tests for the manager, the API and the UI helpers; `README.md`, `CLAUDE.md`; `src/ui/app.tsx` (mounts the dialog, passes the snapshot to the session provider).
- `src/ui/sessionPanel.tsx` and `styles.css` are also touched by the open change `agent-console-quick-replies` (button row below the terminal). This change only touches the panel's header; it should be rebased onto that one once it is merged.
