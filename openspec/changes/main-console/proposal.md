# Proposal

## Why

Every agent session belongs to one change of one repository: it is opened from a card's starter, runs a fixed prompt in
that change's worktree, and lives in that change's detail view. There is no place to simply talk to an agent — to ask it
to draft a new change somewhere, look across several repositories, or do a chore that belongs to no change — without
leaving the dashboard for a separate terminal. The dashboard already knows how to host an agent in a terminal; it only
lacks a session that is not tied to a change.

## What Changes

- A **main console** icon button in the top bar, next to the theme control, visible on every route while agent sessions
  are enabled. It opens an overlay, in the same frame as a change's detail view, that holds one agent terminal and
  nothing change-related.
- The console runs the **default agent profile** with **no opening prompt**: the profile's command with every argument
  that carries `{prompt}` left out. The user types what they want. Default responses, Resume and End session work as
  in any session; Ship, work status, next-step prompts, worktree removal and the pull offer do not exist for it.
- The console's working directory is a **console folder**: by default `~/.openspec-dashboard/console/`, created by the
  dashboard on first use; a new setting lets the user point it at another existing folder (for example a workspace
  root above several repositories). A folder equal to or inside a tracked repository is refused, so the console never
  runs in a main checkout. No worktree, no branch and no git command are involved.
- **One console at a time.** Opening it while its agent runs attaches to the running session; closing the overlay never
  ends it. The icon shows whether the console is running, using the same two running states as every other session
  badge, in words.
- Console sessions are ordinary session records (same store, same retention, same terminal WebSocket and guards), marked
  as console sessions. They are not listed or counted in **Open work** and are not written to the activity log, both of
  which are about repositories and changes.
- A new endpoint `POST /api/console` opens the console (or returns the running one), under the same-origin guard and
  refused while agent sessions are disabled. Change-only session routes (ship, prompt, worktree) refuse a console
  session.
- The demo shows the icon and plays a short hand-written console transcript.

## Capabilities

### New Capabilities

- `main-console`: a repository-independent agent session opened from the top bar — when it is offered, which agent and
  command it runs, its console folder and the rules for that setting, one-at-a-time lifecycle, the overlay it lives in,
  what it shares with change sessions and what it deliberately lacks.

### Modified Capabilities

None as MODIFIED deltas. The API and demo additions are new requirements added to existing capabilities, so that they
do not collide with the unarchived changes that already modify those capabilities' requirements:

- `dashboard-api`: ADDED requirement "Main console endpoint" (`POST /api/console`, and change-only routes refusing a
  console session).
- `demo-site`: ADDED requirement "The main console is simulated in the demo".

## Impact

- `src/shared/types.ts` — `Session` gains `console?: true`; `repoId`, `change` and `action` become absent for a console
  session. `AgentSessionsConfig` gains `consoleDir?: string`.
- `src/server/sessions/manager.ts` — `openConsole()`; `resume`/`close` handle a console session without repository
  lookups; `ship`, `prompt` and `worktreeStatus` refuse it; console sessions are not reported to the activity log.
- `src/server/sessions/agents.ts` — a launch mode without a prompt.
- `src/server/config.ts` — `consoleDir` validation (absolute, existing directory, not inside a tracked repository).
- `src/server/api.ts` — `POST /api/console`.
- `src/server/paths.ts` — the default console folder.
- `src/ui/app.tsx`, `src/ui/icons.tsx` — the top-bar icon and the overlay mount.
- `src/ui/console.tsx` (new), `src/ui/sessionPanel.tsx` (export `TerminalView` and the shortcut row),
  `src/ui/sessions.tsx`, `src/ui/sessionState.ts` (exclude console sessions from Open work and change lookups),
  `src/ui/endSessionDialog.tsx` (no pull offer), `src/ui/agentSettings.tsx` (console folder field), `src/ui/api.ts`,
  `src/ui/styles.css`.
- `src/ui/demo/demoApi.ts`, `src/ui/demo/demoSessions.ts` — console mock and transcript.
- `test/` — console open/resume/close in a temp home with `fake-agent.ts`, config validation, API guard, UI state.
- `README.md`, `CLAUDE.md` — the console, and invariant 1's sentence on starting the agent now covering the console
  folder.
- No new dependency, no new git subcommand, no network.

**Overlapping in-flight changes:** `integrate-console-detail-view` (Open work list, console tab) and
`sessions-in-non-git-repos` are implemented on `main` but not archived; this change builds on their code and only adds
requirements, so it can be archived before or after them. `add-cleanup-capabilities` modifies the "never writes"
requirement; this change does not, because the console folder is never inside a tracked repository.
