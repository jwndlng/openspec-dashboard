# Tasks

## 1. Configuration

- [x] 1.1 Add `PrTitleConvention` and `RepoConfig.prTitleConvention?` to `src/shared/types.ts`, plus the
  `CONVENTIONAL_COMMITS_SHIP_SENTENCE` constant (one line, no `{…}`); verify with `bun run check` (typecheck).
- [x] 1.2 Accept `prTitleConvention: z.literal("conventional-commits").optional()` in `repoSchema`
  (`src/server/config.ts`); verify in `test/config.test.ts` that a config without the field loads unchanged and that
  `angular` is rejected naming the field with the stored config unchanged.

## 2. Ship prompt

- [x] 2.1 Reword `DEFAULT_SHIP_PROMPT` to ask for commit messages that follow the repository's own conventions; update
  every test that asserts on the old wording and verify none mention Conventional Commits for an unset repository.
- [x] 2.2 Give `shipPrompt` a convention argument that appends the sentence between the base prompt and the additional
  instructions; verify in `test/agents.test.ts`: default + sentence, own prompt + sentence + suffix in that order, one
  line, `{change}` substituted, and unchanged output without a convention.
- [x] 2.3 Pass `repo.prTitleConvention` from `SessionManager.ship()` (`src/server/sessions/manager.ts`); verify with a
  Ship test (fake agent) for a running and an ended/resumed session of a repository with the convention, and that
  Implement/Resolve conflicts prompts are unchanged.

## 3. API

- [x] 3.1 Add `POST /api/repos/<id>/pr-title-convention` to the per-repository dispatcher in `src/server/api.ts`
  (`conventional-commits` sets, `null` deletes the key, anything else or a missing field → `400`, unknown id → `404`);
  verify in the per-repository endpoint tests that other repo fields are untouched, no scan is triggered, and a
  cross-site request gets `403`.

## 4. UI

- [x] 4.1 Add `setRepoPrTitleConvention` to `src/ui/api.ts` and the demo API (`src/ui/demo/demoApi.ts`); verify in
  `test/demoApi.test.ts` that the demo updates its config.
- [x] 4.2 Add the **PR titles** picker to `src/ui/projectSettings.tsx` (row and tile, only when `isGit`, shown even with
  agent sessions off, saving/failure/revert like the agent picker, accessible name with the project name, tooltip
  quoting the sentence), styles in `src/ui/styles.css`; verify in `test/projectSettingsUi.test.ts` (choose, clear,
  refused request reverts, absent for a non-git folder, does not open the board).
- [x] 4.3 Run `bun run dev`, set the convention on a project, and confirm in a Ship that the agent receives the
  sentence; check both themes and a narrow viewport.

## 5. Wrap-up

- [x] 5.1 Run `bun run check` and `bun run build` and confirm both pass.
- [x] 5.2 Add a What's new entry at the top of `src/ui/changelog.ts` (see "What's new" in CONTRIBUTING.md): the new
  per-project PR titles setting, and that the default Ship prompt no longer prescribes Conventional Commits.
