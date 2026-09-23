## Why

A tracked folder that holds an `openspec/` tree but is **not a git repository** is a legitimate way to use OpenSpec:
the specs are managed locally and there is no version control. The dashboard already scans such a folder, derives its
columns and shows its cards — `isGit` is false and the git-derived parts are simply omitted. Agent sessions are the one
feature that does not follow: every session is given a git worktree, so in a non-git folder `git worktree add` fails and
the session cannot start.

Worse, the failure is invisible. `SessionControls` calls `ui.start(...)`, whose `catch` writes the message into the
session provider's `error` field — and nothing in the UI ever reads that field. The dock pane that renders session
errors is only mounted by the `openPanel(session.id)` call on the line *after* the throw, so a start that fails never
gets a pane to report itself in. The button flips to "Starting…", flips back, and nothing else happens. That is true of
every refusal in `SessionManager.open`, not only this one: a stale stage, a missing agent prompt, a repository whose
last scan failed all fail the same silent way.

## What Changes

- **A session in a non-git repository runs in the repository folder itself.** No worktree is created, no branch is
  made, and no git command runs for it. The session's working directory is the repository path.
- Such a session is marked as running **in place**, and the UI says so where it would otherwise name a worktree and a
  branch: the folder is named, with the plain warning that the agent edits the tracked folder directly and that there
  is no branch, no commit and no undo. This is the user's own setup, not something the dashboard can isolate.
- The features that only mean something with git are **not offered** for an in-place session: work status, Ship, the
  pull offer, and removing a worktree when the session ends. Ending an in-place session ends the agent and nothing else.
- **A refused or failed start is shown to the user.** `start` resolves with the reason instead of swallowing it, and
  the card holds and renders it next to the button that was pressed, clearing it on the next attempt. Deliberately not
  the provider's `error` field: that one belongs to the three-second poll, whose next success would wipe the message
  within seconds of it appearing.
- The starters stay **enabled** for a non-git repository; they now work there. (The alternative — disabling them with
  an explanation, as for a missing agent executable — was rejected: it would make the honest case look broken.)

Out of scope: giving a non-git folder any git-derived feature (work status, Ship, pull, worktree management). Those
stay absent, as they already are elsewhere in the dashboard for a non-git repository. Also out of scope: showing the
case in the **demo site**. Every demo repository is `isGit: true`, and making one of them non-git means threading that
through the sample data, the worktree list and the scripted session places — worth its own change, and this one is a
bug fix.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: "Every session works in its own git worktree, created by the dashboard" gains the non-git case — the session runs in the
  repository folder, with no worktree and no branch. "Session starters run a fixed prompt for a validated change" gains
  the requirement that a refusal reaches the user. The worktree-removal and pull requirements gain the in-place
  exclusion.

## Impact

- `src/shared/types.ts`: `Session.branch` becomes optional; new `Session.inPlace`.
- `src/server/sessions/manager.ts`: `open` skips worktree creation for a repository whose scan reported `isGit: false`
  and runs the agent in the repository path; `prepareRestart`/`resume` do the same.
- `src/ui/sessions.tsx`: `start` resolves with the failure reason; `SessionControls` holds and renders it.
- `src/ui/sessionPanel.tsx`: an in-place session shows the folder and the warning instead of worktree and branch, and
  hides Ship, work status and the worktree actions.
- `src/ui/endSessionDialog.tsx`, `src/ui/sessionState.ts`: no worktree removal and no pull offer for an in-place session.
- `src/ui/demo/demoSessions.ts`: `branch` is now optional on a session, so the transcript values take `?? ""`.
- `openspec/specs/agent-sessions/spec.md`, `CLAUDE.md`, `README.md`: the worktree rule is stated with its exception.
- `test/`: unit tests for the in-place decision and the error rendering; a session opened in a non-git temp folder.
