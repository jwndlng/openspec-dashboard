# Tasks

## 1. Discovery

- [ ] 1.1 Add `IntegratableRepo` (`path`, `name`) and `DiscoverResult.integratable` to `src/shared/types.ts`; verify with `bun run typecheck`.
- [ ] 1.2 In `src/server/discover.ts`, collect directories with their own `.git` that are neither linked worktrees nor OpenSpec repositories while keeping the walk's descent, ignore paths, skipped names, depth bound and canonicalisation exactly as they are, then drop any collected directory that is a prefix of a reported OpenSpec repository (design D1); verify with tests in `test/discover.test.ts`: a plain git repo is integratable, a monorepo holding an OpenSpec package offers only the package, a linked worktree is not offered, a non-git folder is in neither list, an ignore path removes it, and the existing candidate assertions are unchanged.
- [ ] 1.3 Prove the lists are disjoint and that today's candidate results are byte-identical: a test runs discovery over a fixture tree and compares the candidate list against the one recorded before this change.

## 2. Session kind

- [ ] 2.1 Add `IntegrationSession` (`integration: true`, `folder`, `inPlace: true`, no `repoId`, `change`, `action` or `branch`) to the `Session` union in `src/shared/types.ts`, with an `isIntegration` guard, and confirm `changeSessions()` filters it out (design D2); verify with tests that Open work, work status, Ship, pull and worktree cleanup ignore it.
- [ ] 2.2 Persist and load the new record shape in `src/server/sessions/store.ts`, including records written by earlier versions; verify with a store round-trip test and a test that an unknown session kind in the store does not break loading.

## 3. Starting an integration

- [ ] 3.1 Create `src/server/integration.ts` with `integratableProblem(path, config, discovery)` — under a scan root, not ignored, own `.git`, not a linked worktree, no `openspec/config.yaml`, not in the config — recomputed from the file system on every call (design D1); verify with tests in a new `test/integration.test.ts` covering each refusal and a canonical-path mismatch.
- [ ] 3.2 Start the session through `src/server/sessions/manager.ts` with the repository's checkout as the working directory, no worktree, no branch and no git command, refusing when sessions are off, the agent has no `integrate` prompt, or one is already running for that directory (design D3); verify with tests using `test/fixtures/fake-agent.ts` in a temp git repository that the agent's cwd is the checkout, that `git status`, `HEAD` and the branch are unchanged afterwards, and that each refusal starts no process.
- [ ] 3.3 Prove the dashboard writes nothing in the repository: a test snapshots the working tree, `.git/index` and `.git/refs` before and after a session that the fake agent leaves untouched, and asserts they are byte-identical.

## 4. Confirming the integration

- [ ] 4.1 Implement the marker re-check in `integration.ts`, run when an integration session ends and on every discovery run: on finding `openspec/config.yaml`, add the repository with `enabled: true` and the existing default-name and disambiguation rules, write the config atomically and trigger a scan; never read agent output (design D4); verify with tests: marker present → added, enabled and scanned; marker absent → config byte-identical; a second check after success adds nothing; a failed start changes nothing.
- [ ] 4.2 Confirm an integrated repository is then neither a candidate nor integratable, and that a repository the user later forgets becomes a candidate (not integratable) because it now has the marker; verify with `test/discover.test.ts` and `test/config.test.ts`.

## 5. Prompt and configuration

- [ ] 5.1 Add `integrate` to `PromptKey`, the preconfigured one-line Integrate prompt to `src/shared/agentDefaults.ts`, and validation in `src/server/config.ts` that rejects any placeholder in it while keeping the `{change}` rule for starters and the optional rule for `ship` (design D5); verify with tests in `test/config.test.ts` for `{change}` rejected, an unknown placeholder rejected, the bypass-flag check still applying, and a config without the key loading unchanged.
- [ ] 5.2 Add the Integrate field to the agent editor in `src/ui/agentSettings.tsx` and show the preconfigured default; verify with a test that clearing it removes the key and that **Integrate** is then disabled for that agent.

## 6. API

- [ ] 6.1 Carry `integratable` in the discovery response and add `POST /api/integrations` to `src/server/api.ts` with the same-origin guard, `400` for a malformed or non-canonical path, `409` for each refusal and the session on success; verify with API tests for every status code and a cross-site refusal that touches no disk.

## 7. Settings UI

- [ ] 7.1 Render the integratable section below the candidates in the settings view, with the wording that distinguishes it from candidates, the existing same-name hint, **Integrate** and **Ignore**, hiding the section when empty; verify with tests in `test/settingsSections.test.ts`.
- [ ] 7.2 Show **Integrate** disabled with its reason when sessions are off, the agent has no prompt, or a session is running, and show a refusal on the row it was activated from; verify with UI tests for all three reasons and a refused start.

## 8. Demo

- [ ] 8.1 Add an integratable repository and a simulated integration to `src/ui/demo/`, moving it into the tracked list on completion; verify with demo tests that it is listed, that integrating it enables it and shows it on the board, and that nothing is started with sessions off.

## 9. Documentation

- [ ] 9.1 Document integration in `README.md` and add the second in-place case to the agent sessions section of `CLAUDE.md`, stating that an integration session runs in the repository's own checkout; verify by reading both against the proposal's non-goals.

## 10. Validation

- [ ] 10.1 Run `bun run check`; verify it passes.
- [ ] 10.2 Run `bun run build` and exercise `dist/openspec-dashboard` against a scratch git repository with no `openspec/`: it is listed as integratable, **Integrate** starts the agent in that checkout, and after `openspec init` runs there the repository is tracked, enabled and on the board (invariant: the product build, not only `bun run dev`).
- [ ] 10.3 Confirm on a workspace of OpenSpec repositories only that the candidate list, the config and the board are unchanged from `main`.
