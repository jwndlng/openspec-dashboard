# Tasks

## 1. Eligibility and pre-selection

- [x] 1.1 Add `newChangeTargets(repos, filterRepoIds)` to `src/ui/repoGroups.ts`, returning the eligible repositories (`ok`, snapshot order, `{ id, name }`) and the pre-selected id (the only eligible one, else the only filtered one that is eligible); verify with new cases in `test/repoGroups.test.ts` covering: failed repos excluded, several eligible with an empty filter → none pre-selected, filter of one eligible → that one, filter of one failed repo → none, single eligible → that one, none eligible → empty list

## 2. Form

- [x] 2.1 Extend `NewChangeForm` with an optional `projects` list and initial choice: render a labelled "Project" `<select>` with an empty "Choose a project" entry before the change name, hold the chosen id in state, and submit to the chosen id; without `projects` it behaves exactly as today (verify `bun run typecheck` and that the repository header still passes a fixed repository)
- [x] 2.2 Disable submit while no eligible project is chosen and show "choose a project" as text next to the dropdown; derive the choice as empty when the chosen id is no longer in `projects` (verify by reading the code path and in the running app by disabling the chosen repository in Settings with the form open)
- [x] 2.3 Attach the single `focusOnce()` ref to the `<select>` when nothing is pre-selected at open, else to the name input, decided once from initial state; verify in the running app that focus lands on the right field and that choosing a project, typing and a background poll never move it
- [x] 2.4 Keep the chosen project and show the server's message on a refused create (verify in the running app with a duplicate name, and in the demo build, where the refusal message is shown)

## 3. Combined board

- [x] 3.1 In `Kanban` (no `repoId`), add a "New change" button at the end of the filter row, shown only when `newChangeTargets` returns at least one project, and render the form between the filter row and `.board`, pre-selected from the current repository filter at open; on success close it and call `onReload`; verify on `/board` that a created change appears in the chosen repository's group of `New` without a reload
- [x] 3.2 Confirm the repository board is unchanged: header action present, no action in its filter row (verify on `/repo/<id>`)
- [x] 3.3 Adjust `src/ui/styles.css` only if the dropdown row or the button's placement needs it; check at narrow width that the filter row still wraps without horizontal scroll

## 4. Wrap-up

- [x] 4.1 Update the README's mention of creating a change, if it names the repository board as the only place (verify by grepping `README.md` for "New change")
- [x] 4.2 Run `bun run check` and `bun run build`, and open the compiled binary's `/board` to confirm the action and dropdown work there
- [x] 4.3 Run `openspec validate new-change-on-kanban --strict` and verify it passes
