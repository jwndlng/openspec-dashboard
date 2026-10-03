# Tasks

## 1. Label target selection

- [x] 1.1 Add `labelChoices(repos, config)` to `src/ui/repoGroups.ts`: every label displayed on at least one repository (via `displayedLabels`), de-duplicated with `labelKey`, sorted by name; verify with tests in `test/repoGroups.test.ts` covering a hidden detected label and a custom label shadowing a detected one
- [x] 1.2 Add `labelTargets(repos, config, labels)` to `src/ui/repoGroups.ts`: repositories displaying all `labels` (ignoring case) in snapshot order, each with `eligible` and a skip `reason` when the last scan failed; verify with tests for one label, AND of two labels, an ineligible match and an empty label list returning no repositories

## 2. Sequential creation runner

- [x] 2.1 Add `createInRepos(repos, name, prompt, onProgress)` in `src/ui/newChangeForm.tsx`: calls `api.createChange` once per repository in order, one at a time, catches each `ApiError` into a refused result with its message, records `staged` for created ones, and afterwards calls `api.scan()` once when at least one create succeeded; verify with a test (new `test/newChangeByLabel.test.ts`) against a stubbed api asserting request order and bodies, that a refusal in the middle does not stop later requests, and the final scan call

## 3. Dialog: By label mode

- [x] 3.1 Extend `NewChangeTarget`'s projects variant with the inputs `labelTargets` needs plus optional `mode` and `initialLabels`, and render a **One project / By label** switch defaulting to One project; verify `bun run check` passes and the repository header's single-project form is unchanged
- [x] 3.2 Render the label picker (choices from `labelChoices`, multi-select, removable) and the repository list with checkboxes (eligible checked by default via an unchecked-id set, ineligible disabled with the reason text); verify in the running dashboard with the fixtures that selecting `terraform` lists the matching repositories
- [x] 3.3 Gate submission (no label selected / no repository checked, each said as text) and label the submit action `Create in <n> project(s)`; keep name/prompt validation and the `focusOnce` rule (label picker first when opened with no labels, else the name field); verify by hand and with `test/focus.test.ts` still passing
- [x] 3.4 On submit run `createInRepos`, show the repository in progress, keep the dialog uncloseable while busy, then show one result line per repository (created + staged/not staged, or refused + reason), call `onCreated` once, and turn the submit action into **Done**; verify in the running dashboard that a name already present in one repository yields one refused and one created result
- [x] 3.5 Add styles for the mode switch, label picker, repository checklist and result list in `src/ui/styles.css`, matching the existing dialog and chip styles in light and dark themes; verify visually in both themes

## 4. Overview entry point

- [x] 4.1 In `src/ui/overview.tsx` show **New change in these projects** next to the label filter when `state.labels` is non-empty and `labelTargets` finds an eligible repository, opening `NewChangeDialog` in By label mode with the filter's labels; hide it when the filter is empty; verify in the running dashboard at `/?label=terraform` and that activating it writes nothing until submit

## 5. Wiring and verification

- [x] 5.1 Pass the snapshot repositories and config from the combined board (`src/ui/kanban.tsx`) into the dialog so By label is offered there; verify the combined board's dialog shows the switch and a single repository board does not
- [x] 5.2 Run `bun run check` and `bun run build`, and verify the built `dist/openspec-dashboard` creates a change by label in two fixture-like temp repositories with both appearing on the board without reload
- [x] 5.3 Confirm no server file, route or git invocation changed (`git diff --stat origin/main -- src/server` is empty) so invariant 1 holds unchanged
