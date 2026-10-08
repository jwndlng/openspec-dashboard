# Proposal

## Why

For a small change, stepping through **Draft artifacts**, then **Implement**, then **Ship** costs the user three visits to
the board for decisions that are not really theirs to make: the artifacts and the code will be reviewed in the pull
request anyway. Users want to hand such a change to the agent once and get a pull request back, with that pull request
as the only human review — and to be warned, once, that this is what they are doing.

## What Changes

- **A Fast-forward starter.** A card (and a change's Console tab) offers a small **FF** starter next to **Draft
  artifacts**. It starts one agent session, in the change's usual worktree on `feat/<change>`, whose opening prompt asks
  the agent to write every missing artifact, then — without stopping for the user's review — implement every task, then
  ship: commit, push and open a pull request against the default branch, not merging it.
- **No new prompt to configure.** The Fast-forward prompt is built from the profile's own **Draft artifacts**,
  **Implement** and **Ship** prompts (each with its additional instructions, and Ship with the project's pull request
  title convention), joined by two fixed, agent-neutral bridging sentences. So every existing profile, preset or
  custom, gets it without a configuration change, and the `- [~]` meaning carried by the Implement prompt still holds.
  **FF** is offered exactly when **Draft artifacts** is offered, the change is not blocked by its dependencies (it will
  implement) and the agent has both a Draft and an Implement prompt; a request otherwise is refused like any unavailable
  starter.
- **Never auto-merge.** Because the pull request is the only review, the Fast-forward prompt never carries the docs-only
  auto-merge instruction, whatever the project's setting, and its session never records an auto-merge request.
- **A warning first, which can be switched off.** Activating **FF** opens a confirmation dialog — "Fast-forward
  `<change>`?" — saying that the agent will write the artifacts, implement the change and open a pull request without
  stopping for review, and that the pull request will be the only review. It has a **Don't show this warning again**
  checkbox. Confirming starts the session; cancelling starts nothing and saves nothing.
- **The setting is the dashboard's own.** The configuration gains an optional `agentSessions.confirmFastForward`
  (absent means `true`). Confirming with the checkbox ticked saves `false` at once through a new same-origin route
  `POST /api/agent-sessions/fast-forward-warning`. Settings → Agent sessions shows a **Warn before fast-forwarding**
  checkbox so the warning can be turned back on.
- **A session shows what it was started as.** The session's action is `fastForward`, labelled **Fast-forward** in the
  session panel, Open work and the activity log. It may also be sent into a running session of the change as a next
  step, under the same availability and the same warning.
- The demo offers **FF** with the same dialog; help and What's new describe it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: a new **Fast-forward** starter — when it is offered and refused, how its prompt is composed from
  the Draft, Implement and Ship prompts, that it never carries an auto-merge instruction, the confirmation and the
  `confirmFastForward` setting in the Agent sessions section of Settings.
- `kanban-board`: a card offers the **FF** starter beside the other starters, behind the confirmation dialog, and still
  leaves the user on the board.
- `dashboard-api`: the new route `POST /api/agent-sessions/fast-forward-warning`, which writes only the dashboard's own
  configuration under `~/.spec-control/`.

## Impact

- `src/shared/types.ts` — `SessionAction` gains `fastForward` (not a `PromptKey`), `availableActions` offers it,
  `AgentSessionsConfig.confirmFastForward`, the two bridging sentences.
- `src/server/sessions/agents.ts` — `fastForwardPrompt`; `openingPrompt` for `fastForward`.
- `src/shared/dependencies.ts` — `blockedReason` names the starter it holds back.
- `src/server/sessions/manager.ts` — availability and refusal, worktree/branch as for Draft, no auto-merge.
- `src/server/config.ts`, `src/server/api.ts` — config field, the new route behind `crossSiteRefusal`.
- `src/ui/sessions.tsx`, `src/ui/sessionState.ts`, `src/ui/sessionPanel.tsx`, `src/ui/agentSettings.tsx`, a new
  `src/ui/fastForwardDialog.tsx`, `src/ui/api.ts`, `src/ui/styles.css`, `src/ui/helpContent.tsx`,
  `src/ui/changelog.ts`, the demo (`src/ui/demo/`).
- Tests: `test/terminalSessions.test.ts`, `test/agentSettingsUi.test.ts`, config and API tests.
- No new network use, no new write to a tracked repository, no new git command: invariants 1–4 are unchanged.
