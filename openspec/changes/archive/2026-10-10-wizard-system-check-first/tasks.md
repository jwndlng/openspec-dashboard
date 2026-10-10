# Tasks

## 1. Setup view

- [x] 1.1 Add the setup view to `src/server/environment.ts` (no `agent:*` checks, fixed setup verdicts, overall status from those checks) and verify with `test/environment.test.ts` covering the three environment-check scenarios while the Settings view's tests stay unchanged
- [x] 1.2 Accept `view=setup` on `GET /api/environment` (`400` for another value, cached per view) and add `view` to `api.environment` in `src/ui/api.ts` and the demo API; verify with `test/environmentApi.test.ts` and `bun run typecheck`

## 2. Wizard

- [x] 2.1 Reorder `STEP` to Welcome, System check, Workspace, Agents, Console, Project settings, Done, with the step list, the Welcome diagram and the Done cards following it; verify with the order, Welcome and step-list scenarios in the wizard tests
- [x] 2.2 Make the System check step request the setup view when shown and on Re-check, list no agent checks and say what git and the GitHub CLI are used for; verify with the System check scenarios
- [x] 2.3 Add **Check again** to the Agents step, re-running the executable lookup, and remove its pointer to the System check; verify with the "Checking again after installing" scenario
- [x] 2.4 Make the Done step request a fresh setup view and mark Agents when a checked agent is not found; verify with the Done scenarios including "An agent still missing"
- [x] 2.5 Give the System check step the Done step's visual language — a headline with a badge, the count in place and Re-check, then one card per check with its tool's icon, a status pill and a status-coloured edge, instructions inside the card — in `src/ui/setupWizard.tsx` and `src/ui/styles.css`; verify with the "A visual report" scenario in the wizard tests

## 3. Verification

- [x] 3.1 Run `bun run check` and `bun run build`, then step through the wizard in `dist/spec-control` with `SPEC_CONTROL_HOME` set to a scratch folder and confirm the System check is step 2 with no agent rows
