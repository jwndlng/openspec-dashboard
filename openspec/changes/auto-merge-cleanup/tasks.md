# Tasks

## 1. Record

- [x] 1.1 Add `autoMergeAskedAt?: string` and `autoEnded?: { pr: number; at: string; removed: boolean; reason?: string }` to the change session type in `src/shared/types.ts` and persist them in `src/server/sessions/store.ts` (design D1, D4); verify `bun run check` and that an old session record without them still loads (store test)
- [x] 1.2 Set `autoMergeAskedAt` in `SessionManager.open()`, `prompt()` and `ship()` whenever the result's `autoMerge` is true, never for a returned already-open session; verify with cases in `test/shipAutoMerge.test.ts` (Archive start, Archive sent, Ship → set; setting off, Implement → unset)

## 2. Trigger

- [x] 2.1 Add `SessionManager.endMergedAutoMerge(repoId, list)`: match per design D3 (branch, `mergedAt` after `autoMergeAskedAt`, `autoMergeDocs` on, not in place, not adopted, no `autoEnded`), then `close(id, { removeWorktree: true })` and store `autoEnded` (D4); verify in a new `test/autoMergeCleanup.test.ts` with temp git repositories and the fake agent: merged after ask → agent ended, worktree removed, branch kept; no ask; setting off; merged before ask; uncommitted file → ended, kept, reason; already ended by the user → only removal; second call → no change
- [x] 2.2 Call it from the pull-request refresh route in `src/server/api.ts` for each freshly queried repository after `refresh()` resolves, without delaying the response and never for the demo (design D2); verify with a test using `test/fixtures/fake-gh.ts` that a refresh showing the merged pull request ends the session, and that the only `gh` processes started are `pr list` and `api user`
- [x] 2.3 Add the `session-auto-ended` activity kind in `src/server/activity/events.ts` and `log.ts`, and suppress the exit handler's `session-ended` for a session being auto-ended (design D5); verify with an activity test that exactly one event is recorded

## 3. UI

- [x] 3.1 Show `autoEnded` in `src/ui/sessionPanel.tsx` and on the card's session line, worded as in design D6, plus the activity feed's sentence for `session-auto-ended`; verify with unit tests of the wording helpers in `src/ui/sessionState.ts` and `bun run check`
- [x] 3.2 Extend `AUTO_MERGE_HINT` in `src/ui/projectSettings.tsx` and adjust `test/projectSettingsUi.test.ts`; verify the test passes
- [~] 3.3 Run the dashboard (`bun run dev`) against a test repository with a fake `gh` scenario that turns a pull request merged, and confirm that the panel and card show the automatic end. Leave as `- [~]` if it needs the user's eyes

## 4. Docs and release notes

- [x] 4.1 Update invariant 1 and *Work status* in `CLAUDE.md` (automatic removal on a merged auto-merge pull request, no new git or `gh` subcommand) and the Docs auto-merge paragraph in `README.md`; verify by reading both diffs
- [x] 4.2 Add a What's new entry at the top of `src/ui/changelog.ts`; verify `bun run check` passes in full
