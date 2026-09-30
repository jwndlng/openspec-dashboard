# Design

## Context

See proposal.md — Why. The mechanics behind it, in three places:

- `SessionManager.open()` (`src/server/sessions/manager.ts`) reuses an existing session only when its archive-ness
  matches the requested action: `(s.action === "archive") === archiving`. So an Archive request beside a running Draft
  or Implement session falls through to creating a session, a worktree (`archive-<change>` on
  `chore/archive-<change>`) and a process. For a repository without git the worktree step is skipped and
  `worktreePath` is the repository folder itself, so the second agent lands in the folder the first one is already
  editing — the "one running session per worktree" guard exists only in `resume`/`shipAgain`, not in `open`.
- `SessionManager.prompt()` refuses `action === "archive"` and refuses any action for a session whose own action is
  `archive` ("archiving runs in its own session").
- `nextStepFor()` (`src/ui/sessionState.ts`) mirrors both: Archive never targets a session, and an archive session is
  never a target. The card offers no starters at all while a session runs (owned by the in-flight
  `re-arrange-buttons-task`), so the Console tab's next-step buttons — built from `startersFor` filtered by
  `nextStepFor(...).promptSessionId === session.id` — are the only place an action can be clicked for a change whose
  agent is up, and Archive is filtered out of them.

The demo recording (`src/ui/demo/demoSessions.ts`) already reuses any running session of a change in `open`; only its
`prompt` carries the same archive refusal as the server.

## Goals / Non-Goals

**Goals:**

- One open session per change, enforced where sessions are created, so no UI state can produce a second console.
- Every action the change's stage allows reaches that session, Archive included.
- No change to worktrees, branches, work status, Ship, cleanup, pull, or anything the dashboard writes.

**Non-Goals:**

- Moving or adding controls. Where actions are offered stays as it is; only which of them are sendable changes.
- Changing what Archive does when it *opens* a session: it still gets `archive-<change>` on `chore/archive-<change>`.
- Migrating sessions that are already running in an existing dashboard process.

## Decisions

### D1. The rule lives in `open()`, keyed on the change, not on the worktree

`open()` drops the `archiving` comparison and returns the first open session for the repository and change it finds.
`list()` is sorted newest first, so when an installation is already running two sessions for one change — the state
this change makes unreachable — the newest is the one returned, which is the one the user last started.

Alternative considered: keeping the per-worktree key and adding a separate "no second agent in an in-place folder"
guard. That fixes the folder case but leaves two consoles for git repositories, which is the thing the user asked to
end. Keying on the change covers both with one condition, and `worktreePath` collisions stay guarded where they
already are (`resume`, `shipAgain`, `removeWorktreeByName`).

### D2. A reused `open()` returns the session and sends nothing

`POST /api/sessions` stays idempotent: it returns the running session and does not type a prompt, even when the action
differs from the session's. Typing on the user's behalf belongs to the prompt route, which reports whether the text was
submitted; `open()` has no way to say that in its response type, and a double-clicked starter must not type a prompt
twice. The dashboard never relies on the difference, because the UI routes an action for a change with a running
session through `promptSession` (D4); `open()` is the safety net that makes a second process impossible for any client.

### D3. `prompt()` loses both archive refusals, keeps every other one

The action must still be in `availableActions(change)` for the change's current stage, the agent must still have a
prompt for it, the session must still be running, and a changeless session (console, integration) is still refused.
Archive therefore reaches a running session only for a change that is genuinely in `Done` — the same gate the starter
has. What the agent then does in the session's worktree is the agent's business under its own permission prompts, as
for every other prompt the dashboard hands over.

The consequence worth naming: the archive prompt runs where that session runs — the change's own worktree on
`feat/<change>`, or the folder itself for a repository without git — not on a `chore/archive-<change>` branch. That is
what "re-use the open session" means, and it is the user's click that chooses it. Archive started with no session
running is unchanged, so the separate archive worktree remains the default path for a change whose work is merged.

### D4. `nextStepFor` becomes one line

With no action excluded and no session excluded, the helper reduces to "the change's running session, if any":

```ts
export function nextStepFor(sessions: ChangeSession[], repoId: string, change: string): { promptSessionId?: string } {
  return { promptSessionId: sessions.find((s) => s.repoId === repoId && s.change === change && s.state === "running")?.id };
}
```

The `action` parameter and the `blocked` result both go, since neither has a caller left once Archive is no longer
special. `sessions` is newest-first from `sessionsForChange`'s ordering only by accident, so the lookup keeps using the
provider's list order; with one running session per change there is nothing to choose. The panel's filter
(`promptSessionId === session.id`) is what keeps the next-step buttons on the session that will receive them, so the
panel of an *ended* session still offers none — unchanged behaviour, and the reason the filter stays rather than being
replaced by a plain `startersFor`.

### D5. The demo mirrors the server, and only in `prompt`

`demoSessions.prompt` drops the same refusal. Its `open` already reuses any running session of a change, so the demo
needs no change there — a small confirmation that the reuse rule is the one that was intended.

### D6. No `kanban-board` or `change-detail` delta

A card still offers no starter while a session runs, and the Console tab is still where the next step is offered; both
are specified by in-flight changes (`re-arrange-buttons-task`, `integrate-console-detail-view`) whose delta files this
change does not touch. Which actions may be sent into a running session is an `agent-sessions` question, and the
buttons are derived from it, so the UI follows without a second delta. `src/ui/sessionPanel.tsx` changes only where a
comment or a tooltip states the old exception.

## Risks / Trade-offs

- **Archiving now happens on the feature branch when the user archives from a running session.** → It happens only on
  an explicit click, in the worktree whose terminal the user is looking at, and the alternative (a second agent in a
  second worktree for the same change) is what this change removes. Archive with no session running still uses the
  archive worktree, so the merged-then-archive path is untouched.
- **An agent asked to implement or validate inside a session that was started as Archive would work in the archive
  worktree.** → The stage gate makes this rare (the change must be in `Done`), it takes a deliberate click, and the
  branch is visible in the panel header the click is made from. One rule with no exceptions beats a second exception
  that would reintroduce the second console.
- **A process already running two sessions for one change keeps them.** → Nothing ends a running agent for this: the
  new rule applies from the next `open`, and both sessions stay listed and usable until they end. `open()` returning
  the newest keeps that state predictable.
- **An API client that counted on `action: "archive"` opening its own session gets the running one instead.** → Stated
  as **BREAKING** in the proposal and in the `dashboard-api` delta; the dashboard's own UI never depended on it.

## Migration Plan

None. No stored session record, worktree, branch or configuration key changes shape or meaning, and no data is
rewritten. Rolling back is reverting the commit: the old exception reappears and any archive worktree created under it
is still a plain session worktree that cleanup handles as before.
