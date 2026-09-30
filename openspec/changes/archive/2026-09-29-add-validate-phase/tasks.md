# Tasks

## 1. The third task state

- [x] 1.1 Add `awaiting?: number` to `TaskProgress` in `src/shared/types.ts` and a `DoneSubState = "complete" | "validate"` (design D2, D3); verify with `bun run typecheck`.
- [x] 1.2 Teach `TASK_LINE` in `src/server/tasksParser.ts` the `~` state with the same tolerant spacing as `x`, count it into `total` and into a new `awaiting`, and keep an unrecognised marker counted as open (design D1, D2); verify with tests in `test/parsers.test.ts` for `- [x]`/`- [ ]`/`- [~]` mixed, `- [ x]`, `- [ ~]`, `- [-]` as open, ordered and `*`/`+` markers, and a file with no `~` producing the byte-identical counts it produces today.
- [x] 1.3 Add a fixture change under `test/fixtures/` whose `tasks.md` has ticked, awaiting and open tasks; verify the scanner reports `done`, `awaiting` and `total` for it end to end.

## 2. Stage and sub-state

- [x] 2.1 In `src/shared/columns.ts`, make `deriveStage` settle on `done` when `done + (awaiting ?? 0) === total` and on `implementing` when that sum is `> 0`, and return `subState` (`"validate"` when `awaiting > 0`, else `"complete"`) for `done` only; leave `Stage`, `STAGE_COLUMN`, `boardColumns` and `isComplete` untouched (design D3); verify with unit tests for 12/0/12, 13/2/15, 0/9/9, 13/1/15 → `Implementing`, 0/1/12 → `Implementing`, and that a snapshot without `awaiting` derives exactly the stage it derives today.
- [x] 2.2 Carry `subState` on `ChangeSnapshot` through the scanner and the merge of copies in `src/server/mergeChanges.ts`, deriving it with the column rather than storing it; verify with a test that a change held by two checkouts reports the leading copy's sub-state, and that an older cached snapshot without `awaiting` loads and shows `complete`.

## 3. Starters

- [x] 3.1 Add `"validate"` to `SessionAction`, `SESSION_ACTIONS` and `PromptKey`, and change `availableActions` so `Done` + `validate` offers `validate` and `archive`, `Done` + `complete` offers `archive`, and `implement` is no longer offered in `Done` (design D4); verify with unit tests over each stage/sub-state pair, including that `implement` is absent from a validating change.
- [x] 3.2 Refuse a start whose action is not available for the change's stage **and sub-state** in `src/server/sessions/manager.ts` and the session route in `src/server/api.ts`; verify with API tests that `validate` on an `Implementing` change and `implement` on a validating change are both refused with a reason and start no process.
- [x] 3.3 Check `nextStepFor` and `startersFor` in `src/ui/sessionState.ts` need no change beyond the new action, and that an agent without a Validate prompt shows only **Archive**; verify with tests in `test/sessionPrompt.test.ts`.

## 4. Prompts and migration

- [x] 4.1 In `src/shared/agentDefaults.ts`, add the one-line Validate prompt and reword the Implement and Archive prompts per design D5, keeping each a single line; verify with a test asserting each is one line, contains `{change}` and says what D5 requires.
- [x] 4.2 Replace `FORMER_ARCHIVE_PROMPTS` with a per-key `FORMER_PROMPTS`, seeded with the former Archive prompts plus today's Archive and Implement texts, and generalise the upgrade in `src/server/config.ts` to run per prompt key (design D5); verify with tests in `test/config.test.ts`: a verbatim former Archive prompt upgrades, an edited Implement prompt is kept while Archive upgrades, a removed prompt stays removed, and a non-`claude` profile is never touched.
- [x] 4.3 Add the fourth prompt field to `src/ui/agentSettings.tsx`, ordered Draft, Implement, Validate, Archive; verify with a test that saving an empty Validate field removes the key.

## 5. Board and detail view

- [x] 5.1 Render the **Validate** badge (`warning` role) on cards with `tasks.awaiting > 0`, never for an archived change, in `src/ui/` card rendering plus `src/ui/styles.css`; verify with tests in `test/boardMarks.test.ts` and `test/cardProgress.test.ts`.
- [x] 5.2 Give the task progress bar its third segment and the `13 + 2 awaiting / 15 Tasks` label, tooltip and accessible name, and prove a change with `awaiting: 0` or no `awaiting` renders exactly as before (design D6); verify with tests in `test/cardProgress.test.ts` including the accessible name and the unchanged two-part case.
- [x] 5.3 Render the checklist's third state in `src/ui/changeDetail.tsx` as an indeterminate, `aria-checked="mixed"`, still-disabled checkbox, with a line saying how many tasks await validation; verify with tests in `test/changeDetail.test.ts` that the three states render distinctly, that clicking any of them sends nothing, and by opening the detail view in `bun run dev` against a scratch repository with a `- [~]` task.
- [x] 5.4 Confirm the `Done` column count, the highlighted count and every "to archive" count include validating changes; verify with tests in `test/overview.test.ts` and `test/workInProgress.test.ts`.

## 6. Demo

- [x] 6.1 Add a change in `Done` with awaiting tasks and a Validate prompt on the demo agent to `src/ui/demo/sampleData.ts`, and let the simulated starter validation use stage **and** sub-state; verify with tests in `test/demoData.test.ts` and `test/demoSessions.test.ts` that the card shows the badge, that **Validate** starts a simulated session and that **Implement** on it is refused.

## 7. Documentation

- [x] 7.1 Document the `- [~]` marker and the `Done`/Validate sub-state in `README.md` (lifecycle section) and note in `CLAUDE.md` that the dashboard still never writes `tasks.md`; verify by reading both against the proposal's non-goals.

## 8. Validation

- [x] 8.1 Run `bun run check`; verify it passes.
- [x] 8.2 Run `bun run build` and exercise `dist/openspec-dashboard` against a scratch repository holding a change with `- [~]` tasks: the card sits in `Done` with the **Validate** badge and the three-part bar, **Validate** and **Archive** are the offered starters, **Implement** is not, and the detail view's checklist shows the third state (invariant: the product build, not only `bun run dev`).
- [x] 8.3 Confirm on a repository with no `- [~]` anywhere that the board, counts and starters are unchanged from `main`.
