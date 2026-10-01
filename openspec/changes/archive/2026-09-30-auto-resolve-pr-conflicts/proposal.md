# Proposal

## Why

Once an agent session has pushed its branch and opened a pull request, the branch quietly rots: every other change that
lands on the default branch can make it unmergeable, and the dashboard — which already reads a work status for every
worktree — says nothing about it. The user finds out on GitHub, long after the session that knows the change has been
closed. The dashboard already knows the branch, the base and the agent that produced the work; it can tell the user the
branch no longer merges and hand that agent the job of fixing it, the same way Ship hands it the job of pushing.

## What Changes

- **Work status gains a conflict signal.** For a worktree whose branch has commits the base lacks, the dashboard also
  reports whether merging the branch into the locally known default branch would conflict, and which files conflict.
  It is computed with a read-only `git merge-tree --write-tree`, never by touching the working tree, the index or any
  ref, and the merge objects git writes are redirected into a scratch object directory under `~/.openspec-dashboard/`
  so nothing is created inside the tracked repository.
- **Nothing is fetched.** Exactly like `merged`, the conflict signal is only as fresh as the user's last fetch, and the
  UI says so and points at **Pull**. No new network behaviour and no new network exception.
- **A `Resolve conflicts` action**, next to Ship on the session panel and the change detail's work status, offered only
  while a conflict is detected. It hands the agent a prompt — the agent profile's `resolveConflicts` prompt, or an
  agent-neutral default asking it to bring the branch up to date with the base, resolve the conflicts, keep the
  branch's intent, run the project's checks and push — under the existing rules for text sent on the user's behalf
  (typed, echo-checked, a separate Enter, and the panel says so when it was only typed). A session that has ended is
  started again in its worktree with the prompt, under the same checks as Ship.
- **The dashboard never resolves a conflict itself**: it does not merge, rebase, checkout, commit, push or write a
  file in the repository for this. It reports the conflict and asks the agent, which works under its own permission
  prompts.
- **Refused where it makes no sense**: an in-place session (a tracked folder without git) has no branch, so no conflict
  signal and no action; `missing`, `clean` and `merged` worktrees offer nothing; a request for any of those is refused
  with the reason.
- **Activity** records a `session-conflicts-resolve` event when the prompt is handed over, with whether it was
  submitted — history only, never an input to anything.
- **Demo**: one synthetic worktree shows a conflicted branch and the action, with no git and no network.

### Non-goals

- Reading the pull request itself. This change stays local: it answers "would this branch merge into the base you last
  fetched", not "what does GitHub say about PR #42". The in-flight `list-recently-opened-prs` change introduces `gh`
  querying; a later change may let a `gh`-sourced `mergeable` supersede the local signal.
- Fetching, polling or watching on a timer. The signal is recomputed where work status already is.
- The dashboard performing the merge, rebase or conflict edit itself.
- Auto-submitting the prompt without the user activating it.

## Capabilities

### New Capabilities
<!-- None: this extends existing session behaviour rather than introducing a capability. -->

### Modified Capabilities
- `agent-sessions`: the work-status requirement gains the conflict signal and its freshness caveat; a new requirement
  for the Resolve conflicts action, its prompt, when it is offered and when it is refused.
- `dashboard-api`: the "never writes" requirement's read-only git subcommand list gains `merge-tree`, with the
  condition that its object writes are redirected out of the repository; a new `POST /api/sessions/<id>/resolve-conflicts`
  route under the same-origin guard.
- `activity-feed`: the new `session-conflicts-resolve` event kind in the sessions group.
- `demo-site`: a conflicted branch is simulated in the demo.

## Impact

- **Server**: `src/server/sessions/workStatus.ts` (conflict detection, scratch object directory, caching with the
  existing status); `src/server/sessions/manager.ts` (`resolveConflicts`, mirroring `ship`);
  `src/server/sessions/agents.ts` (`resolveConflictsPrompt`); `src/server/api.ts` (one route);
  `src/server/paths.ts` (scratch object directory under `~/.openspec-dashboard/`); `src/server/activity/` (new kind).
- **Shared**: `src/shared/types.ts` — `WorkStatus.conflicts`, `CONFLICTABLE_WORK`, `DEFAULT_RESOLVE_CONFLICTS_PROMPT`,
  the `resolveConflicts` prompt key, the new `ActivityEvent` kind and its group.
- **UI**: `src/ui/sessionPanel.tsx` (badge and control), `src/ui/sessions.tsx` (`WorkStatus` view),
  `src/ui/sessionState.ts` (when the control is offered, wording), `src/ui/api.ts` (one call),
  `src/ui/activityState.ts` (event wording), `src/ui/agentSettings.tsx` (the new prompt in agent settings),
  `src/ui/styles.css`, `src/ui/demo/` (synthetic conflicted worktree).
- **Tests**: `test/workStatus.test.ts`, `test/workStatusUi.test.ts`, `test/terminalSessions.test.ts`,
  `test/api.test.ts`, `test/agents.test.ts`, `test/activityEvents.test.ts`, `test/demoSessions.test.ts`, plus a new
  `test/conflicts.test.ts` for the detection in real temporary git repositories.
- **Dependencies**: `git merge-tree --write-tree` requires git 2.38 or newer; where it is unavailable the signal is
  simply absent and no control is offered.
- **Overlap**: touches `workStatus.ts`, `manager.ts` and `sessionPanel.tsx`, which in-flight session changes also own;
  the conflict signal is added alongside the existing work states rather than changing any of them. The new prompt key
  also lands in the prompt and additional-instruction schemas of `src/server/config.ts` and the editor in
  `src/ui/agentSettings.tsx`, which `modify-change-actions` introduced: that change's "Additional instructions extend an
  action's prompt" requirement names Ship as the only prompt with a default that a suffix can extend, and this change
  makes resolve-conflicts a second one. Whichever archives second should fold that into the requirement; this change
  states the behaviour in its own added requirement instead, because that requirement is not in `openspec/specs/` yet.
