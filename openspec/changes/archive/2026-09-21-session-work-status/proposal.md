# Proposal

## Why

An agent session leaves its work in a git worktree under `~/.openspec-dashboard/worktrees/`. Once the session has ended the dashboard says nothing more about that work: whether it was committed, pushed or merged is invisible, and a worktree whose session record was deleted cannot be reached from the UI at all. Work can be left behind unnoticed, which defeats the point of a dashboard that answers "what is open?".

## What Changes

- Every session worktree gets a **work status** derived from local, read-only git: `uncommitted` (with the file count), `not pushed` (with the commit count), `pushed`, `merged`, or nothing to ship. No network: "merged" means merged into the default branch *as this machine last fetched it*.
- The status is computed per worktree **directory**, not per session record, so worktrees whose record was pruned or deleted are still found.
- Cards show the work status of their change's worktree, also after the session has ended. Open work that has been sitting for a while is highlighted.
- A new **Open work** list in the top bar shows every worktree with unshipped or merged-but-not-removed work across all repositories, including worktrees of changes that are no longer on the board.
- A new **Ship** action in the session panel gives the agent a prompt to commit, push and open a pull request. It is typed into the running terminal, or the agent is started again in the worktree with it. The prompt is configurable per agent and has an agent-neutral default. The dashboard itself still never commits, pushes or contacts a remote.
- Worktree removal is additionally offered when the work is merged, and is possible for a worktree without a session record.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: new requirements for work status, the Ship action and worktrees without a record; the clean-up requirement also accepts merged work.
- `dashboard-api`: `GET /api/sessions` carries the worktrees; new `POST /api/sessions/<id>/ship` and `POST /api/worktrees/remove`; the read-only git list gains `diff`.
- `kanban-board`: cards show work status; the Open work list; Ship in the session panel.
- `repo-discovery`: an agent profile may carry a Ship prompt.

## Impact

- New `src/server/sessions/workStatus.ts`; changes to `manager.ts`, `worktree.ts`, `agents.ts`, `api.ts`, `config.ts`, `src/shared/types.ts`, `src/shared/agentDefaults.ts`.
- UI: `sessions.tsx`, `sessionPanel.tsx`, `sessionState.ts`, `agentSettings.tsx`, `app.tsx`, `api.ts`, `demo/demoApi.ts`, `styles.css`.
- More `git` processes while the dashboard is open and agent sessions are enabled (cached, a handful per worktree every 15 s). None when the feature is off.
- Docs: `CLAUDE.md` invariant 1 (read-only git list), `README.md` agent sessions section.
