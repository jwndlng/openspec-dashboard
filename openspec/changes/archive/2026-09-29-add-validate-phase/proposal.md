# Proposal

## Why

Work that an agent finished but a human still has to confirm has nowhere to sit. Tasks like "verify in `bun run dev`
against a scratch repository" or "exercise `dist/openspec-dashboard` and check the card appears" cannot honestly be
ticked by the agent that wrote the code, so they stay `- [ ]`. The dashboard reads that as unfinished implementation:
the change stays in `Implementing`, its card offers **Implement**, and **Archive** is refused — `availableActions`
only offers it in `Done`. The only ways out are both wrong. Running **Implement** again sends an agent back into code
that is already written. Ticking the boxes by hand claims a verification nobody did, and does it outside the dashboard.

This repository has the problem right now: `dismiss-task` sits at 13/15 with both leftovers being "verify in
`bun run dev`" and "exercise `dist/openspec-dashboard`", and `integrate-console-detail-view` at 22/27 with the same
kind of leftover. Both are code-complete and stuck in `Implementing`.

What is missing is a way for a change to say *"the work is done; a person still has to look at it"* — and for that
state to be visible on the board and actionable, rather than indistinguishable from half-finished work.

## What Changes

- **A third checkbox state in `tasks.md`.** `- [~]` means: the agent finished this task, a human still has to confirm
  it. The scanner counts it in `tasks.total` and reports it as a new `tasks.awaiting` count; it is **not** counted in
  `tasks.done`, because nobody has verified it yet. `- [x]` and `- [ ]` keep their meaning exactly.
- **`Done` gains a `Validate` sub-state.** A change whose tasks are all either ticked or awaiting
  (`done + awaiting == total`, `total > 0`) is in the `Done` column. When `awaiting > 0` it carries the sub-state
  `validate`; otherwise `complete`, which is today's `Done`. No new column: `Backlog`, `Drafts`, `Ready`,
  `Implementing`, `Done`, `Archived` stay as they are, and column order, filters and counts are untouched.
- **The card says so.** A card in `Done` with `awaiting > 0` shows a `Validate` badge, and its progress bar reports
  the three counts (`13 + 2 awaiting / 15 Tasks`) with the awaiting part drawn as a distinct, unfinished segment.
  The `Done` column's highlighted count and every "to archive" count keep counting the whole column, validate or not.
- **A `Validate` starter.** A change in `Done` with `awaiting > 0` offers **Validate** instead of **Implement**: a
  session whose prompt asks the agent to walk the user through each `- [~]` task, one at a time, and to tick off only
  the ones the user confirms — leaving the rest `- [~]`. **Archive** is offered for the whole `Done` column, so a
  change awaiting validation can also be archived straight away.
- **Three preconfigured prompts change.** Implement tells the agent to write `- [~]` rather than `- [x]` for a task
  only a human can verify. Archive gains "tick off the tasks that were left for me to validate once I have confirmed
  them". Validate is new. Each is an ordinary editable template, and a saved config still carrying a former
  preconfigured prompt verbatim is read as carrying the current one — the mechanism `FORMER_ARCHIVE_PROMPTS` already
  uses; a prompt the user edited is left alone.
- **The detail view's checklist gains the third state**, drawn as neither ticked nor empty, still not operable.
- The demo shows one change in `Done` awaiting validation.
- No new write to any tracked repository: the dashboard still never touches `tasks.md`. Only the agent, in its own
  session under its own permission prompts, writes `- [~]` or ticks it off.

## Capabilities

### Modified Capabilities
- `change-scanner`: "Task progress is derived from tasks.md" recognises `- [~]` and reports `awaiting`.
- `kanban-board`: "Board columns follow the lifecycle phases" gains the `Done` sub-states; "Cards show only what an
  overview needs" gains the `Validate` badge and the three-part progress bar.
- `agent-sessions`: "Session starters run a fixed prompt for a validated change" gains the **Validate** starter, the
  `Done`-with-awaiting rule for **Implement**, and the preconfigured Implement/Archive/Validate prompt texts.
- `change-detail`: "Tasks are shown as a read-only checklist" renders the awaiting state.
- `demo-site`: a change awaiting validation is in the demo data.

## Impact

- `src/server/tasksParser.ts` — `~` in `TASK_LINE`, `awaiting` in the result.
- `src/shared/types.ts` — `TaskProgress.awaiting`; `DoneSubState`; `ChangeSnapshot.subState`; `"validate"` in
  `SessionAction`/`SESSION_ACTIONS`/`PromptKey`; `availableActions`.
- `src/shared/columns.ts` — `deriveStage` treats awaiting tasks as complete-for-the-column and returns the sub-state;
  `isComplete` unchanged.
- `src/shared/agentDefaults.ts` — the Validate prompt, the reworded Implement and Archive prompts, and their
  `FORMER_*_PROMPTS` lists. `src/server/config.ts` — the same migration, generalised past Archive.
- `src/ui/` — card badge and progress bar, the tasks checklist, `sessionState.ts`, `agentSettings.tsx` (a fourth
  prompt field), `styles.css`.
- `src/ui/demo/sampleData.ts` — a change awaiting validation.
- `test/` — `parsers.test.ts`, `columns`/`boardMarks`, `cardProgress.test.ts`, `sessionPrompt.test.ts`,
  `agents.test.ts`, `config.test.ts`, `changeDetail.test.ts`, `demoData.test.ts`, and a fixture with a `- [~]` task.
- `README.md` — the lifecycle description and the `- [~]` convention.
- `repo-discovery`'s "Agent session settings are part of the configuration" enumerates the prompt keys (`draft`,
  `implement`, `archive`) and so would need the new one — but `integrate-repos-without-openspec` replaces that
  enumeration with a rule that covers any starter, so this change deliberately carries no `repo-discovery` delta and
  the two do not contend for that block. Land that change first, or add the enumeration here instead.
- Baselines: the requirements modified here start from the deltas of `simplify-kanban-board` (board columns, card
  content) and `restructe-task-title` (card content), both merged but not archived; those must be archived first.
- No new dependency, no network, no new invariant. Invariant 1 is untouched: nothing here writes to a repository.

## Non-goals

- The dashboard ticking a checkbox itself. The checklist stays read-only (`change-detail`), and `tasks.md` stays out
  of invariant 1's enumerated writes. Validation is confirmed by the user to an agent, which edits the file.
- Teaching OpenSpec that `- [~]` means anything. Its archive workflow states that `- [~]` is an incomplete marker and
  that an unfamiliar marker is never complete, so `openspec archive` will still count those tasks as incomplete and
  ask the user to confirm — which is the right prompt at exactly the right moment, and is why the Archive prompt now
  tells the agent to tick them off once the user confirms.
- A `Validate` board column, per-task ownership, or recording who validated what.
