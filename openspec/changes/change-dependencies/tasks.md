# Tasks

## 1. Types and derivation

- [ ] 1.1 Add `DependencyState` (`met` | `waiting` | `missing` | `cycle`), `ChangeSnapshot.dependsOn?: { name; state }[]`, `requiredBy?: string[]` and `blocked?: boolean` to `src/shared/types.ts`, with doc comments; verify with `bun run check` (typecheck).
- [ ] 1.2 Create `src/shared/dependencies.ts` with a pure `resolveDependencies(changes)` that sets each dependency's state (precedence `met` → `cycle` → `missing` → `waiting`, per design decisions 3–4), `blocked`, sorted `requiredBy`, and the `missing`/`cycle` warnings, and leaves changes without dependencies or dependents untouched; verify with a new `test/dependencies.test.ts` covering archived-in-main, Done-in-main (leader and `otherCheckouts`), Done/archived only on a branch, non-git (no `checkout`), missing, self-reference, three-node cycle, a met change breaking a cycle, duplicates, archived dependents never blocked, and a repository without the convention producing unchanged objects.
- [ ] 1.3 Make `availableActions` leave out `implement` when `blocked` is true (Draft, Validate and Archive unchanged); verify with cases added to the existing `availableActions` tests.

## 2. Scanner

- [ ] 2.1 Generate a fixture repository under `test/fixtures/` (see `test/fixtures/README.md`) with a chain `add-billing-schema` (archived) → `add-billing-api` (Ready) → `add-billing-ui` (Ready), a change naming a missing dependency, a two-change cycle, a malformed `depends-on.yaml` and one listing an invalid name; made-up names only.
- [ ] 2.2 In `scanChange` read `depends-on.yaml` like `prompt.md` (bounded, failure-isolated), parse it with `yaml`, keep only `CHANGE_NAME`-valid, de-duplicated names (warning for each rejected entry), and on an unreadable or ill-shaped file set `blocked` with a warning naming the file; skip archived changes; verify with `test/scanner.test.ts` cases against the fixture.
- [ ] 2.3 Call `resolveDependencies` on `[...active, ...archived]` in `scanRepo` for git and non-git repositories; verify scanner tests for the chain, the leading-copy rule (worktree copy declares, main does not), unblocking once the dependency's archive is in the main checkout, and that a scan of the fixture leaves every file byte-for-byte unchanged.

## 3. Sessions

- [ ] 3.1 In `SessionManager.start` and `prompt` (`src/server/sessions/manager.ts`), refuse `implement` for a blocked change with a 400 whose message names each unmet dependency and its state (or the unreadable file) before the generic "not available" refusal; verify with a session test that the refusal creates no worktree and starts no process, and that Draft on a blocked change still starts.

## 4. Create change

- [ ] 4.1 Validate `dependsOn` in `postCreateChange` (`src/server/api.ts`) and `createChange` (`src/server/createChange.ts`) before `mkdir`: an array of at most 32 distinct `CHANGE_NAME` strings, none equal to `name`; otherwise 400 with nothing written; verify with `test/createChangeApi.test.ts` cases (path-like name, duplicate, self, non-array) asserting the repository and its index are unchanged.
- [ ] 4.2 Write `depends-on.yaml` (one-line comment, then `depends_on:` in the given order) inside the existing try/rollback after `.openspec.yaml` and `prompt.md`, only when `dependsOn` is non-empty; verify with `test/createChange.test.ts` that the file is written, staged by the single `git add`, absent without dependencies, and parsed back by the scanner.
- [ ] 4.3 Pass `dependsOn` through `src/ui/api.ts` (`createChange`) and the demo API's implementation; verify with `bun run check` and the demo API tests.
- [ ] 4.4 Add the **Depends on** multi-select to `src/ui/newChangeForm.tsx`: the target repository's active changes sorted by name with their column, empty on open, cleared when the project changes, omitted for label targeting, "nothing to depend on" when empty, sent in selection order; verify with UI tests alongside `test/newChangeByLabel.test.ts` and the existing new-change form tests.

## 5. Board and detail view

- [ ] 5.1 Show the "waits for" note in the card footer for a blocked change in `Ready`/`Implementing` with no running session, also when agent sessions are disabled: first unmet name `+N`, tooltip and accessible name listing each with its state, not a control (`src/ui/kanban.tsx`, `styles.css`); verify with card rendering tests for blocked Ready, sessions disabled, blocked Drafts (no note, Draft offered) and running session (badge, no note).
- [ ] 5.2 Add the *Depends on* (with blocked heading and states in words) and *Required by* lists to the detail header in `src/ui/changeDetail.tsx`, linking names that are in the snapshot to their detail route and rendering `missing` names as text; verify with `test/changeDetail.test.ts` cases for both lists, a missing name and no lists.
- [ ] 5.3 Add a small dependency chain (one blocked change in `Ready`, its dependency in `Implementing`) to `src/ui/demo/sampleData.ts`; verify with `test/demoData.test.ts`.

## 6. Documentation and verification

- [ ] 6.1 Update `CLAUDE.md` invariant 1 (the create-change action may also write `depends-on.yaml`) and `README.md` (the `depends-on.yaml` convention, what `met` means, that only Implement is held back); verify by reading the diff against the dashboard-api delta.
- [ ] 6.2 Run `bun run check` and `bun run build`, and confirm `dist/openspec-dashboard` scans the fixture with dependencies resolved (no module-relative file reads were added).
- [ ] 6.3 In `bun run dev` against a scratch repository: create a change with two dependencies from the form, see the "waits for" note on its card and both lists in the detail views, then archive the dependency into the main checkout and see **Implement** return on the next scan.
- [ ] 6.4 Add a What's new entry at the top of `src/ui/changelog.ts` for change dependencies (see "What's new" in CONTRIBUTING.md); verify with `test/whatsNew.test.ts`.
