# Design

## Context

There are three session kinds today (`src/shared/types.ts`):

- `ChangeSession` runs in a worktree, or in place in a tracked folder without git.
- `ConsoleSession` is the main console in the console folder.
- `IntegrationSession` runs in place in an untracked git repository.

`isChangeless()` and `changeSessions()` keep the console and integrations out of Open work, cards, the activity log,
work status, Ship, pull and cleanup. The manager already has two prompt-less or in-place starters to copy from:
`openConsole()` (no prompt, one running at a time) and `openIntegration()` (in place, one per folder). It also has
matching restart preparations (`prepareConsoleRestart`, `prepareIntegrationRestart`). The UI fetches all sessions in
`SessionProvider` (`src/ui/sessions.tsx`) and splits them into `sessions`, `consoles` and `integrations`. The console
and integration overlays (`src/ui/console.tsx`, `src/ui/integrate.tsx`) are nearly identical `DetailOverlay`s, mounted
by `app.tsx` outside the inert part of the page.

The user chose that the project console runs in place in the main checkout (see proposal.md).

## Goals / Non-Goals

**Goals:**
- A fourth session kind that reuses the existing in-place and changeless paths instead of adding parallel ones.
- The setup session started by **New project** stays reachable after the project is tracked, without moving or
  rewriting its record.
- No new write by the dashboard to any repository, and no new git subcommand.

**Non-Goals:**
- No prompt, starter or quick action specific to the project console. The user writes the first instruction, as in
  the main console.
- No change to the main console. Its folder is still refused inside a tracked repository.
- No refusal of pull, dismiss or cleanup while a project console runs. See Risks.
- No project console for unmanaged or untracked folders. Those have **Integrate** / **Setting up…**.

## Decisions

### A new `ProjectConsoleSession` kind, changeless but carrying `repoId`
`{ projectConsole: true, repoId, folder, inPlace: true }` with no change, action or branch. `isProjectConsole()` is
added, and `isChangeless()` includes it. That one edit keeps it out of Open work, the activity `report()`, work status,
Ship, Resolve conflicts, next-step prompts and `listWorktrees`. All of these already filter through
`changeSessions()` or `isChangeless()`, and `notAChange()` gains a third message.
- *Alternative: reuse `ConsoleSession` with an optional `repoId`.* Rejected. `consoleToShow`, `consoleControl` and
  `prepareConsoleRestart` all assume "the one console" and a folder outside every repository, and
  `consoleFolderProblem` would refuse the folder on resume.
- *Alternative: a `ChangeSession` with a pseudo-change.* Rejected. It would leak into every change-keyed view.
- Code that looks up sessions by `s.repoId === …` must be checked for this kind. It now carries a `repoId` but no
  `change`. Example: the duplicate-open check in `openSession` matches on `repoId` and `change`, and `change` is
  undefined here, so it already does not match. The audit is a task.

### The setup session is adopted by lookup, not converted
The integration record is left unchanged. A pure helper `projectConsoleSessions(sessions, repo)` (in
`src/shared/types.ts` so server and UI share it) returns the project consoles with that `repoId`, plus the integration
sessions whose `folder` equals the repository's canonical path. The manager uses it to return a running one. The UI
uses it to pick what to show: a running one first, else the newest by `createdAt`. Resuming an integration keeps its
existing path (`prepareIntegrationRestart`, `onIntegrationEnded` re-checks the marker). This is harmless once the folder
is tracked.
- *Alternative: rewrite the integration record into a project console on confirmation.* Rejected. It would change a
  stored record's kind while it may be running and attached, and it would bypass the marker re-check on its end.

### `openProjectConsole(repoId)` in the manager, guarded like the others
The order follows `openSession`:
1. Global switch (403).
2. Unknown repo (404).
3. `repoAgentEnabled` (403).
4. Folder `stat` is a directory (409).
5. A running project console or integration from the helper is returned.
6. Any other running session whose `worktreePath` is the folder is refused (409, naming its change). In practice this
   is an in-place change session in a folder without git.
7. `agentFor(config, repo)` and `Bun.which` (503).
8. Start with `launchWithoutPrompt(agent)`, `worktreePath = repo.path`.

There is no scan-result check: the console is a reasonable place to repair a repository whose scan fails. Tracked but
disabled (`enabled: false`) repos are not managed projects, so the UI never offers the control. The server refuses
them with the same 409 that `openSession` uses ("the repository is not tracked").
`openSession` gains the converse check for in-place change sessions: a running session whose `worktreePath` is
`repo.path` refuses with 409. For a git repository this can never fire, because change sessions use worktrees.

### Restart path
`resume` dispatches on kind. A project console gets `prepareProjectConsoleRestart`: agent still configured, the
repository still configured, the folder still a directory, and no other running session in that folder. Like the
integration path, it does no git and creates no worktree. `restart()` already skips worktree re-creation for changeless
and in-place sessions. The type change makes sure that branch covers the new kind.

### API: `POST /api/repos/<id>/console`
It sits next to the other `/api/repos/<id>/…` mutating routes, behind `crossSiteRefusal`. It returns
`{ session, created }` in the same shape as `/api/console`. The change-only routes are already refused through
`isChangeless()` and `notAChange()`, and `close` ignores `removeWorktree` for changeless sessions.

### UI: one shared in-place overlay, three entry points
`src/ui/projectConsole.tsx` holds:
- `ProjectConsoleButton({ repo })`: icon, state dot, name and title from a new `projectConsoleControl()` in
  `sessionState.ts`, modelled on `consoleControl()`. It is inactive with a reason when `!repoAgentEnabled(repo)` or the
  agent is unavailable (from `ui.agents`). Its click calls `stopPropagation` so a row does not open the board.
- `ProjectConsoleOverlay`, mounted in `app.tsx` next to the other two and included in `otherOverlayOpen`.

`SessionProvider` gains `projectConsoles` and `projectConsoleRepoId` with `showProjectConsole(repoId | undefined)`. The
overlay picks a session with the helper, which can be an integration session, and uses `IN_PLACE_WARNING`. Resume, New
console, End session and Delete record behave as in `console.tsx`, and it auto-starts when the helper finds nothing.
The header, terminal and controls duplicated between `console.tsx` and `integrate.tsx` are a third copy here.
Extracting a small shared `InPlaceSessionPane` is allowed if it stays within those three files. It is not required.

Placement:
- `overview.tsx`: the table row's settings cluster and the tile.
- `kanban.tsx`: the board header actions, next to Copy cd. The single-repo board only; the combined board has no
  single project.

### Demo site
`demoSessions.openProjectConsole(repoId)` returns an in-memory session with a canned transcript, so the demo's API
matches the real one. Without it, the demo's `api.ts` interface would not type-check.

## Risks / Trade-offs

- [An agent and the user, or the pull action, edit the same main checkout] → This is the trade-off the user chose. The
  panel warns, as for integration. The pull action already refuses a fast-forward over overlapping local edits and
  never resets. The dashboard itself writes nothing new.
- [Dismissing a change while the project console's agent edits it] → Dismiss re-checks content against what the
  confirmation showed, so a concurrent edit makes it refuse rather than delete newer work.
- [Cleanup] → `runningWorktreePaths()` will now include main checkouts. Cleanup never removes the main checkout, so
  this only adds a no-op entry. A test asserts cleanup still lists the repository's worktrees normally.
- [A `repoId`-bearing changeless session slips into a change view] → `isChangeless` is the single gate. Tests assert
  absence from Open work, activity, `worktrees()` and card session lookups.
- [CLAUDE.md invariant text says integration is the only in-place main-checkout case] → Updated in the same change, as
  are the help page and the README's description of sessions, if it has one.

## Migration Plan

This change is additive. Old session records have no `projectConsole` field and load as before. `store.ts` reads
`meta.json` without validating it. After a downgrade, an older binary would therefore see a project console record as a
change session with no `change`. The record would appear in Open work as a nameless entry until it is deleted or pruned.
This is accepted, because downgrades are rare and the record is harmless: it has no worktree, and nothing in it is a
command. The record keeps `repoId` because the spec requires the session to carry the repository id. A field with a
different name would only move this risk somewhere else.
