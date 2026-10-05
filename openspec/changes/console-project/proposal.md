# Proposal

## Why

**New project** hands the new folder to an integration session, and its overlay is the only way to see that agent. Once
the user closes it, the session can only be reached from the overview's **Setting up…** entry. That entry disappears
as soon as the project is tracked. From then on the agent that set the project up, running or ended, is out of reach.
Separately, a tracked project has no place for general project work that is not a change, such as asking about the
codebase, tidying the config or running `openspec` commands. The main console is refused inside a tracked repository,
and change sessions belong to one change each.

## What Changes

- Every managed project gets a **project console**: one agent session per project, opened from a console icon on the
  project's overview row and tile and in its board header. It is for general project tasks and belongs to no change and
  no action.
- The project console runs the project's agent (its own choice, else the default agent) **without a prompt**, **in
  place** in the project's main checkout: no worktree, no branch, and no git command run by the dashboard. Its panel
  shows the same "edits this folder directly, no undo" warning as an integration session. This is a deliberate
  widening: until now an integration session was the only session allowed in a git repository's main checkout.
- At most one project console runs per project. Opening it while one runs attaches to it. Closing the overlay keeps the
  agent running. An ended console offers **Resume**, **New console** and **Delete record**, like the main console.
- **Continuity with setup:** the integration session that set a folder up counts as that project's console once the
  folder is tracked. The icon reopens it while it runs, and after it ended it shows it with Resume, so the session
  started by **New project** stays reachable after its overlay is closed.
- The icon shows the console's running state (working, or possibly waiting, with the silence length) the same way the
  top-bar main console control does.
- A project console never appears in Open work, on a card, in the activity log, work status, Ship, next-step prompts,
  pull or cleanup. Those requests are refused for it, as they are for the main console and integration sessions.
- New endpoint `POST /api/repos/<id>/console`, same-origin protected, returning the running console (or the running
  integration session for that folder) or a newly started one.
- In a tracked folder without git, a project console and an in-place change session share one folder, so the existing
  "no two sessions in one folder" rule applies: whichever is second is refused with the reason.

## Capabilities

### New Capabilities
- `project-console`: the per-project console. Covers where it is offered and when it is unavailable, which agent it
  runs and how, where it runs (in place in the main checkout), one per project, adopting the setup session, its overlay
  and state indicator, and what it is kept out of.

### Modified Capabilities
- `agent-sessions`: "Every session works in its own git worktree" names the project console as a third in-place case
  and a second one in a git repository's main checkout.
- `repo-integration`: "An integration session runs in place, in the main checkout" no longer calls integration the
  only such case, and states that a confirmed integration session is then shown as the project's console.
- `dashboard-api`: adds the project console endpoint. "The dashboard never writes to tracked repositories" allows
  starting the agent in a main checkout for a project console, on the user's explicit request, and adds no write by
  the dashboard itself.

## Impact

- **Server:** `src/shared/types.ts` (new `ProjectConsoleSession` kind; `isProjectConsole`; `isChangeless` and
  `changeSessions` exclude it), `src/server/sessions/manager.ts` (`openProjectConsole`, restart and resume preparation,
  folder clash checks), `src/server/api.ts` (`POST /api/repos/<id>/console`, refusals for change-only routes).
- **UI:** new `src/ui/projectConsole.tsx` (icon control and overlay), `src/ui/sessions.tsx` and `src/ui/sessionState.ts`
  (project consoles in the session context, which session to show per project, control state), `src/ui/app.tsx`
  (mount the overlay, make the page inert), `src/ui/overview.tsx` (icon on rows and tiles), `src/ui/kanban.tsx` (icon in
  the board header), `src/ui/api.ts`, `src/ui/integrate.tsx` (share the in-place warning and panel parts),
  `src/ui/helpContent.tsx`.
- **Demo:** `src/ui/demo/demoApi.ts` and `src/ui/demo/demoSessions.ts` (in-memory project console).
- **Docs:** `CLAUDE.md` invariant 1 and the agent sessions section (the in-place main checkout exception now covers the
  project console). `README.md` if it lists the session kinds.
- **Tests:** a new `test/projectConsole.test.ts` with the fake agent and temp repositories: in place, no git, one per
  project, adopting the integration session, refusals, kept out of Open work and activity, main checkout unchanged by
  the dashboard. Also API guard tests.
- No new dependency, no network, and no new write by the dashboard to any repository.
