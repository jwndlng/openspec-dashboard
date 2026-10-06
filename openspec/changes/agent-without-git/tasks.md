# Tasks

## 1. Scan: nothing to branch from

- [x] 1.1 Add a read-only helper in `src/server/git.ts` that reports whether `HEAD` names a commit or `refs/remotes/origin/HEAD` exists (only `rev-parse --verify --quiet` and `symbolic-ref --quiet`, `GIT_OPTIONAL_LOCKS=0`), plus the matching method on `RepoSource`/`LocalRepoSource` in `src/server/source.ts`; any other `RepoSource` implementation in `src/` and `test/` compiles — verify with `bun run typecheck` (or `bun run check`)
- [x] 1.2 Add optional `noCommit?: true` to `RepoSnapshot` in `src/shared/types.ts` with a doc comment, set it in `scanRepo` for git repositories only, omit it when false or unknown, and carry the previous value on a failed scan like `isGit` — verify with new cases in `test/scanner.test.ts`: a temp `git init` repo with an `openspec/` tree and no commit reports `isGit: true, noCommit: true`; after a commit the field is absent; a folder without git has no `noCommit`

## 2. Sessions run in place

- [x] 2.1 In `SessionManager.start` (`src/server/sessions/manager.ts`) decide `inPlace` from `!scanned.isGit || scanned.noCommit === true` and update the comment — verify with a test in `test/terminalSessions.test.ts` (fake agent, temp repo with no commit): Draft artifacts starts, the agent's cwd is the repository folder, the session has `inPlace: true` and no branch, `git worktree list` shows only the main checkout and no `feat/<change>` branch exists
- [x] 2.2 Replace the `!isGit`-only project-console check with `refuseOtherAgentInFolder(repo.path)` for every in-place start, keeping the "the project's console is running in this folder; end it first" reason for the console case — verify with tests: in a repo with no commit, a running project console refuses a change session with that reason; a running in-place change session refuses a second change's session with a reason naming the first change and refuses `openProjectConsole` with a reason naming it (extend `test/projectConsole.test.ts`)
- [x] 2.3 Keep `NoCommitError` in `src/server/sessions/worktree.ts` as the out-of-date-scan fallback, reword its message (no commit yet, refresh and start again — no project-console advice) and its doc comments — verify the existing no-commit test in `test/terminalSessions.test.ts` is rewritten to drive `ensureWorktree` with an unborn `HEAD` directly (or a stale snapshot without `noCommit`) and still asserts 409, no worktree, no branch, no agent
- [x] 2.4 Verify that a session started in place stays in place after the first commit: commit in the temp repo, rescan, restart/resume the ended session and assert its cwd is still the repository folder and no worktree is created, while a new session for another change now gets `feat/<change>` in a worktree

## 3. UI wording

- [x] 3.1 In `src/ui/sessionPanel.tsx` and `src/ui/endSessionDialog.tsx` (via the new `src/ui/inPlaceText.ts`; `sessions.tsx` shows no in-place text, only hides the branch), choose the in-place explanation from the repository snapshot: for `isGit` (no commit) say the agent works in the checkout because there is no commit to branch from yet, with no branch of its own and no undo; keep today's text for a folder without git — verify with a UI/state test (extend an existing session UI test, e.g. `test/projectConsoleUi.test.ts` or a new small test) that the git case never says "is not a git repository"
- [~] 3.2 Add the no-commit case to the in-place sentence in `src/ui/helpContent.tsx` — verify the help page test (if any) still passes and the text reads correctly in `bun run dev`

## 4. Docs and checks

- [x] 4.1 Update `CLAUDE.md`: the in-place bullet under **Agent sessions** and "A change session never runs in a main checkout" now name the one exception, a git repository with no commit yet — verify by reading the diff
- [x] 4.2 Run `bun run check` (lint, typecheck, tests) and `openspec validate agent-without-git --strict`; both pass
- [~] 4.3 Build with `bun run build`, then with `dist/openspec-dashboard` track a fresh `git init` folder with an `openspec/` tree and start **Draft artifacts** for a change: the agent starts in the folder, the panel shows the no-commit wording, and the main checkout gets no worktree or branch
