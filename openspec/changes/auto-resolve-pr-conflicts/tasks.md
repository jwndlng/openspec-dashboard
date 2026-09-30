# Tasks

## 1. Shared groundwork

- [x] 1.1 Add to `src/shared/types.ts`: `WorkConflicts { base: string; files: string[]; truncated?: boolean }`, the optional `conflicts` field on `WorkStatus`, `CONFLICTABLE_WORK` (`uncommitted`, `unpushed`, `pushed`), `"resolveConflicts"` in `PromptKey`, and `DEFAULT_RESOLVE_CONFLICTS_PROMPT` asking the agent to bring the branch up to date with the base, resolve the conflicts keeping the branch's intent, run the project's checks and push (design D3); verify with `bun run typecheck`.
- [x] 1.2 Add a `mergeScratchDir()` path under `~/.openspec-dashboard/` (honouring `OPENSPEC_DASHBOARD_HOME`) to `src/server/paths.ts`, with the `info/` and `pack/` layout created on demand and pruned on start-up; verify with a case in `test/paths.test.ts` that it resolves under the test home and never inside a repository.
- [x] 1.3 Add `resolveConflictsPrompt(agent, change)` to `src/server/sessions/agents.ts`, mirroring `shipPrompt` (profile prompt, else the default, `{change}` substituted, invalid change name rejected); verify with cases in `test/agents.test.ts` including the rejection.

## 2. Conflict detection

- [x] 2.1 Implement `readConflicts(worktreePath, base)` in `src/server/sessions/workStatus.ts`: `git rev-parse --path-format=absolute --git-common-dir` for the alternate, then `git merge-tree --write-tree --name-only <base> HEAD` with `GIT_OBJECT_DIRECTORY` at the scratch dir, `GIT_ALTERNATE_OBJECT_DIRECTORIES` at the repository's objects and `GIT_OPTIONAL_LOCKS=0`; exit 0 → no conflict, exit 1 → the paths between the tree OID line and the first blank line, capped with `truncated`, any other failure → `undefined` (design D1); verify with a new `test/conflicts.test.ts` against temporary repositories: overlapping edits report the conflicting files, a base that moved on other files reports none, a cap is reported as truncated, and an unreadable base yields `undefined` without throwing.
- [x] 2.2 Call it from `readWorkStatus` only for `uncommitted`, `unpushed` and `pushed`, against the branch's last commit, attaching `conflicts` to the returned status and leaving all existing states and counts unchanged; verify `test/workStatus.test.ts` passes unchanged and new cases show `merged`, `clean` and `missing` carry no `conflicts`.
- [x] 2.3 Prove the check writes nothing: a test snapshots the repository's and the worktree's working tree, `.git/index`, `.git/objects`, refs and `HEAD` before and after a status read that finds a conflict, and asserts they are byte-identical while the scratch directory did receive objects (specs: `dashboard-api` — the conflict check writes nothing into the repository).
- [x] 2.4 Verify degradation: a test that makes `merge-tree` unavailable (a stub `git` on `PATH`, or an argument the installed git rejects) shows every work status still returned, none with `conflicts`, and no error surfaced.

## 3. Resolve conflicts action

- [x] 3.1 Add `resolveConflicts(id)` to `src/server/sessions/manager.ts` next to `ship()` (design D3): refuse `isChangeless` and `inPlace` sessions, re-read the work status, refuse with `409` when it carries no `conflicts`, build the prompt, submit into a running session or restart with the resume command, `forgetWorktrees()`, and report the activity event with `submitted`; verify with tests in `test/terminalSessions.test.ts` using the fake agent: running session gets the prompt submitted, ended session is restarted with it, and no git command that writes runs.
- [x] 3.2 Add `POST /api/sessions/<id>/resolve-conflicts` to `src/server/api.ts` beside the `ship` route, returning the session and `submitted`; verify with cases in `test/api.test.ts` for `403` sessions disabled, `404` unknown session, `400` in-place, `409` no conflict, `503` agent missing, and `403` for a foreign `Origin`.
- [x] 3.3 Add the `session-conflicts-resolve` event to `src/shared/types.ts` (`ActivityEvent`, `ACTIVITY_KINDS`, the `sessions` group) and record it from `resolveConflicts`; verify with cases in `test/activityEvents.test.ts` that submitted and not-submitted are distinguished and that the kind is filterable in the sessions group.

## 4. UI

- [x] 4.1 Add `resolveConflicts(id)` to the `Api` interface and HTTP implementation in `src/ui/api.ts`, and event wording for `session-conflicts-resolve` in `src/ui/activityState.ts`; verify with `bun run typecheck` and a case in `test/activityState.test.ts`.
- [x] 4.2 Add a `conflictBadge` and a `resolvable` predicate to `src/ui/sessionState.ts` (design D5), naming the base, the file count and that it is as of the last fetch, and pointing at Pull; verify with cases in `test/workStatusUi.test.ts` for the wording, the truncated case, and that `merged`/`clean`/`missing`/in-place yield no badge and no control.
- [~] 4.3 Render the badge and the `Resolve conflicts` control in `src/ui/sessionPanel.tsx` next to the work badge and Ship, showing the typed-but-not-sent message when `submitted` is false, and the badge only (no control) in `sessions.tsx`'s `WorkStatus` view used by `changeDetail.tsx`; add the warning-badge styles to `src/ui/styles.css`; verify with a vnode test and by driving a conflicting scratch worktree in `bun run dev`.

## 5. Demo

- [x] 5.1 Give one sample session worktree a conflicting work status with two named files in `src/ui/demo/sampleData.ts`, implement `resolveConflicts` in memory in `src/ui/demo/demoApi.ts` and extend the scripted transcript so the prompt appears in the terminal; verify with cases in `test/demoApi.test.ts` and `test/demoSessions.test.ts` that the badge and control show on first load, the action reports `submitted`, a reload restores the sample, and no network request is made; `bun run build:demo` succeeds.

## 7. Rebase onto main

- [x] 7.1 After rebasing onto `main`, add `resolveConflicts` to the `prompts` and `promptSuffixes` schemas in `src/server/config.ts` (Ship's schema: `{change}` optional) and to the prompt editor in `src/ui/agentSettings.tsx`, and make `resolveConflictsPrompt` go through `compose` so the key's additional instructions are appended — all introduced by `modify-change-actions` while this change was open; verify with cases in `test/config.test.ts` (round trip, bypass and placeholder refusals), `test/agents.test.ts` (suffix appended to a configured prompt and to the default, no borrowing across keys) and the updated `test/agentSettingsUi.test.ts` field order.

## 6. Docs and invariants

- [x] 6.1 Update `CLAUDE.md` — invariant 1's read-only subcommand list gains `merge-tree` with the note that its objects are redirected out of the repository, and the agent-sessions section gains Resolve conflicts next to Ship as a second prompt-only action — and `README.md`'s feature list; verify by reading both against the `dashboard-api` and `agent-sessions` deltas.
- [~] 6.2 Run `bun run check` and `bun run build`, then verify in the compiled binary `dist/openspec-dashboard` that a conflicting worktree shows the badge and the control (invariant 3: nothing here may depend on module-relative paths).
