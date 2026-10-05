# Tasks

## 1. Shared pieces

- [x] 1.1 Add `AUTO_MERGE_DOCS_ARCHIVE_INSTRUCTION` to `src/shared/types.ts` (one line, agent-neutral, conditional on the agent opening a pull request, telling it not to open one just for this — design D2); add `AutoMergePromptResult = PromptResult & { autoMerge: boolean }` with `ShipResult` as its alias, add `StartResult = Session & { autoMerge: boolean }`; verify with `bun run check` (typecheck)
- [x] 1.2 Give `shipsOnlyOpenSpec` an `{ allowEmpty }` option (design D1) and add cases to `test/shipAutoMerge.test.ts`: an empty worktree is `true` only with `allowEmpty`, an untracked copied change under `openspec/changes/` is `true`, a commit to `src/` is `false` either way; verify `bun test test/shipAutoMerge.test.ts` passes
- [x] 1.3 Give `openingPrompt` an `{ autoMerge }` option that appends the archive instruction after the suffix for `archive` only (design D3); add cases to `test/agents.test.ts` for order after additional Archive instructions, `{change}` not substituted inside it, and Implement/Draft/Validate ignoring the flag; verify `bun test test/agents.test.ts` passes

## 2. Server

- [x] 2.1 In `SessionManager.open()` compose the Archive prompt after the worktree exists, running the check with `allowEmpty: true` only for a git repository with `autoMergeDocs` on, and return `autoMerge` (always `false` for a returned existing session) — design D4; verify with archive-start cases in `test/shipAutoMerge.test.ts` (fresh worktree with setting on → instruction and `autoMerge: true`; setting off; leftover `archive-<change>` branch with a `src/` commit; Implement with setting on; already-open session) using the fake agent and temp git repositories
- [x] 2.2 In `SessionManager.prompt()` run the same check in the session's worktree for Archive only and return `autoMerge` (design D5); verify with send-action cases: Archive into a session whose branch changes `src/` → no instruction, Archive into one with only `openspec/` changes → instruction, Validate sent → no instruction
- [x] 2.3 Check that an in-place (no git) Archive start runs no git and carries no instruction even with `autoMergeDocs` set in the config; verify with a test on a non-git temp folder
- [x] 2.4 Confirm `POST /api/sessions` and `POST /api/sessions/<id>/prompt` pass `autoMerge` through unchanged and update the demo (`src/ui/demo/demoSessions.ts`) to return `autoMerge: false` from `open` and `prompt`; verify `bun run check`

## 3. UI

- [x] 3.1 Replace `autoMergeId` with `autoMerge?: { id, action }` in `src/ui/sessions.tsx` and turn `AUTO_MERGE_NOTICE` into `autoMergeNotice(action)` in `src/ui/sessionState.ts` (design D6); `reportShip` reports `ship`, `start` reports `archive` from `openSession` and `promptSession` results; `src/ui/sessionPanel.tsx` shows the action's notice; verify with a unit test of `autoMergeNotice` and of the start report, and `bun run check`
- [x] 3.2 Update `AUTO_MERGE_HINT` in `src/ui/projectSettings.tsx` to say Ship and Archive ask the agent, and adjust `test/projectSettingsUi.test.ts` if it asserts the text; verify the test passes
- [~] 3.3 Run the dashboard (`bun run dev`) with a project that has Docs auto-merge on, start Archive on a `Done` change and confirm the panel shows the archive notice and the prompt ends with the instruction — leave as `- [~]` if it needs the user's eyes

## 4. Docs and release notes

- [x] 4.1 Update the Docs auto-merge paragraph in `README.md` (Archive as well as Ship, the instruction is conditional on a pull request, required checks note kept) and the Ship sentence under *Work status* in `CLAUDE.md` to mention Archive; verify by reading both diffs
- [x] 4.2 Add a What's new entry at the top of `src/ui/changelog.ts` saying Docs auto-merge now also reaches Archive sessions that open a pull request; verify `bun run check` passes in full
