# Tasks

## 1. Shared types and availability

- [x] 1.1 Add `fastForward` to `SessionAction` and `SESSION_ACTIONS` (after `draft`), narrow `PromptKey` to exclude it (design D1), and fix every `Record<SessionAction, …>` the type checker reports (labels "Fast-forward", hints); `bun run typecheck` passes
- [x] 1.2 Add the two fixed bridging sentences and `fastForwardAvailable(agent)` (Draft and Implement prompts both set) in `src/shared/`; extend `availableActions` to offer `fastForward` right after `draft` when the change is not blocked; unit tests cover Backlog, Drafts, blocked Drafts, Ready and archived
- [x] 1.3 Add optional `confirmFastForward?: boolean` to `AgentSessionsConfig` and the `agentSessions` zod schema; `test/config.test.ts` proves a config without it loads unchanged and a non-boolean is rejected

## 2. Server

- [x] 2.1 Add `fastForwardPrompt(agent, change, { convention })` in `src/server/sessions/agents.ts` composing Draft + continue sentence + Implement + ship sentence + `shipPrompt` without auto-merge, and route `openingPrompt(…, "fastForward", …)` to it; tests assert the order, suffixes, `{change}` substitution, the Conventional Commits sentence and the absence of both auto-merge instructions, and `undefined` without an Implement prompt
- [x] 2.2 In `SessionManager.open` and `prompt`, accept `fastForward`: refuse a blocked change with `blockedReason` like Implement, refuse when unavailable or without both prompts, pass the repository's `prTitleConvention`, use the Draft worktree/branch and never set `autoMergeAskedAt`; `test/terminalSessions.test.ts` / `test/sessionPrompt.test.ts` start it with the fake agent and check argv, worktree `feat/<change>`, recorded action and the refusals
- [x] 2.3 Add `POST /api/agent-sessions/fast-forward-warning` `{ show }` in `src/server/api.ts` through the serialized config update, behind `crossSiteRefusal`, no scan; `test/api.test.ts` covers success, `400` for a non-boolean and `403` cross-site

## 3. UI

- [x] 3.1 Add `api.setFastForwardWarning(show)` in `src/ui/api.ts` and make `startersFor` keep `fastForward` only when `fastForwardAvailable(agent)`; a sessionState test proves FF is offered next to Draft and hidden without an Implement prompt
- [x] 3.2 Create `src/ui/fastForwardDialog.tsx` (an alertdialog like the end-session dialog): names the change, says the PR is the only review, unticked **Don't show this warning again**, **Cancel** / **Fast-forward**; on confirm with the box ticked save `false` first, update the UI's config, report a save failure but still start; cancel saves nothing
- [x] 3.3 Wire the dialog into the session provider's `start`, which cards, Console tab openings and the panel's next-step starters all use, when `confirmFastForward !== false`; render the card control as small `FF` with `aria-label`/`title` "Fast-forward: write the artifacts, implement and open a pull request (<agent>)", disabled with the other starters while the dialog is open; style it in `styles.css`; verify in `bun run dev` that FF sits after **Draft artifacts**, the board stays open after confirming, and the second FF skips the dialog after "don't show again"
- [x] 3.4 Add **Warn before fast-forwarding** to the Agent sessions section of Settings (`agentSettings.tsx`), ticked when the field is absent, saved with the page, and keep `fastForward` out of the starter prompt list; `test/agentSettingsUi.test.ts` covers both

## 4. Demo, help and release notes

- [x] 4.1 Make the demo accept `fastForward` (play the draft transcript) and the warning route (`src/ui/demo/demoApi.ts`), with its config carrying `confirmFastForward`; `test/demoApi.test.ts` covers a FF start and switching the warning off
- [x] 4.2 Describe **Fast-forward** and its warning in `src/ui/helpContent.tsx` where the other starters are described
- [x] 4.3 Run `bun run check` and `bun run build`, and start a FF session from `dist/spec-control` against a scratch repository with the fake or a real agent to confirm the composed prompt reaches it as one argument
- [x] 4.4 Add a What's new entry at the top of `src/ui/changelog.ts` for the FF starter and its warning (see "What's new" in CONTRIBUTING.md)
