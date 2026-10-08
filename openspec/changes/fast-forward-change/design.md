# Design

## Context

Starters are `SessionAction`s (`draft | implement | validate | archive`, `src/shared/types.ts`). `availableActions`
decides which a change qualifies for, `startersFor` (`src/ui/sessionState.ts`) keeps those the agent has a prompt for,
and `SessionManager.open`/`prompt` (`src/server/sessions/manager.ts`) re-check both and refuse otherwise, with
`blockedReason` for **Implement**. The opening prompt is `openingPrompt(agent, action, change)` in
`src/server/sessions/agents.ts`, which composes `agent.prompts[action]` with its suffix; Ship has its own
`shipPrompt(agent, change, { convention, autoMerge })`. `PromptKey` is `SessionAction | "ship" | …`, and Settings lists one
starter prompt per `SESSION_ACTIONS` entry. Preset prompts are persisted from the first run; a key missing from a saved
profile reads as "removed by the user" and is never filled back in (`upgradeFormerDefaults`).

## Goals / Non-Goals

**Goals:**
- One activation from a card yields a session that drafts, implements and ships, with no new prompt to configure.
- Works for every existing profile (preset or custom) that can already draft and implement.
- The warning is a dashboard setting, visible and reversible in Settings.

**Non-Goals:**
- No automatic merge, no extra review step by the dashboard, no watching the agent's output for phase changes.
- No Fast-forward for a change that is already planned (`Ready`): that is **Implement** followed by **Ship** today.
- No per-project setting for the warning.

## Decisions

### D1 — `fastForward` is a `SessionAction` but not a `PromptKey`

It needs everything a starter has: a worktree, a branch, a recorded action, availability checks, refusal, sending into a
running session, the activity log. So it joins `SessionAction` and `SESSION_ACTIONS`. It is not a prompt a profile
carries, so `PromptKey` becomes `Exclude<SessionAction, "fastForward"> | "ship" | "integrate" | "resolveConflicts"`
(name it `StarterPromptKey` if that reads better), `AgentProfile.prompts` keeps its keys, the config schema gains no
prompt or suffix key, and Settings' `STARTER_PROMPTS` filters it out. Places keyed by `Record<SessionAction, string>`
(labels and hints in `sessions.tsx`, `sessionPanel.tsx`, `agentSettings.tsx`) gain an entry, which the type checker will
list.

*Alternative:* a separate `fastForward` endpoint and session kind. Rejected — it would duplicate the open/prompt paths
and their refusals.

### D2 — The prompt is composed from Draft + Implement + Ship, not configured

`fastForwardPrompt(agent, change, { convention })` returns
`${draft} ${FAST_FORWARD_CONTINUE_SENTENCE} ${implement} ${FAST_FORWARD_SHIP_SENTENCE} ${ship}`, where `draft` and
`implement` are `openingPrompt(agent, "draft" | "implement", change)` (suffix included, `{change}` replaced, change name
validated) and `ship` is `shipPrompt(agent, change, { convention })` — never with `autoMerge`. It returns `undefined`
when either opening prompt is missing; that is the availability check, used by `startersFor` (UI) and by the manager.
`openingPrompt(agent, "fastForward", …)` delegates to it so every existing caller keeps working; the manager passes the
repository's `prTitleConvention`, so the opening path needs the repo there (it already has it for Archive).

The two sentences are fixed, agent-neutral, single-line constants in `src/shared/types.ts`, beside
`CONVENTIONAL_COMMITS_SHIP_SENTENCE`:
- continue: "This change is fast-forwarded: once every artifact is written, do not stop for my review — the pull request
  will be its only review — and go straight on to implementing it:"
- ship: "When every task is settled, ship the work without asking me:"

*Alternative:* a new `fastForward` prompt per preset. Rejected: existing installations persist their profiles, and a
missing key means "removed by the user" (`upgradeFormerDefaults`), so nobody upgrading would see the button; and the user
would have a fourth copy of the same workflow invocation to keep consistent.

*Why the Draft prompt comes first:* for Claude Code and Antigravity the prompt must begin with the slash command to
invoke it; everything after it is that command's argument text, which the workflow reads as instructions, exactly as the
Implement prompt's `- [~]` tail already is.

### D3 — Availability: Draft offered ∧ unplanned ∧ not blocked ∧ both prompts

`availableActions` adds `fastForward` right after `draft` when `draft` is added, the stage is `unknown`, `backlog` or
`drafts` (a `Ready` change with an optional design missing still offers Draft, but not Fast-forward) and
`!change.blocked`. `blockedReason` takes the starter's name, so the refusal says "Fast-forward is held back". The prompt
condition (D2) is applied where the other starters' is: `startersFor` filters with `fastForwardPrompt(...) !== undefined`
— the UI needs a prompt-free variant, so put `fastForwardAvailable(agent)` (both `prompts.draft` and `prompts.implement`
set) in `src/shared/` and use it on both sides. In the manager, `open` and `prompt` extend the existing
`action === "implement" ? blockedReason(change)` check to `fastForward`, so a blocked change is refused with the same
named reason before the generic "not available" refusal.

### D4 — Same worktree as Draft, no auto-merge, recorded as `fastForward`

`worktreeName("fastForward", change)` is `change`, as for every non-archive action, so the branch is `feat/<change>` and a
later **Implement** or **Ship** continues in the same worktree. `archiveAutoMerge` already returns `false` for anything but
`archive`; Fast-forward simply never passes `autoMerge` to `shipPrompt`, so `autoMergeAskedAt` is never set.
`changeOfWorktree` (a worktree without its record) keeps reporting `implement`; nothing depends on the distinction.

### D5 — Warning: `agentSessions.confirmFastForward`, one route, one dialog

- Config: optional boolean in the zod schema of `agentSessions` (absent = `true`), so old files load unchanged and
  `PUT /api/config` validates it like any field.
- Route: `POST /api/agent-sessions/fast-forward-warning` `{ show: boolean }` in `src/server/api.ts`, behind
  `crossSiteRefusal`, writing through the same serialized config-update helper the label-colour and per-repo routes use
  (so it never races a concurrent save), no scan. `api.setFastForwardWarning(show)` in `src/ui/api.ts`.
- Dialog: `src/ui/fastForwardDialog.tsx`, an `alertdialog` like the end-session dialog (a warning to confirm, not a
  form, so not `modal.tsx`): title "Fast-forward `<change>`?", the text from the spec, an unticked **Don't show this
  warning again** checkbox, **Cancel** (focused, so Enter on an unread warning starts nothing) and a primary
  **Fast-forward**; Escape and the backdrop cancel.
- Wiring: in one place, the session provider's `start` (`src/ui/sessions.tsx`), which every starter goes through —
  cards, the Console tab's openings and the panel's next steps. For `fastForward` with `confirmFastForward !== false` it
  shows the dialog and awaits the answer; a cancel resolves with nothing. When the box was ticked it first saves through
  `api.setFastForwardWarning(false)` and hands the saved config to the app (`onConfig`), and a failed save is returned
  as the starter's message while the session still starts. The caller's `starting` state stays set while the dialog is
  open, so a card's starters are disabled.
- Settings: a **Warn before fast-forwarding** checkbox in the Agent sessions section (`agentSettings.tsx`), part of the
  draft config saved with the page.

*Alternative:* `localStorage` (`spec-control.fastForwardWarning`). Rejected: the setting would differ per browser, could
not be shown or reset in Settings from the config, and would have to be added to the kanban-board list of browser keys.

### D6 — The card control

Visible text `FF` (plus a small `⏩`-like double-chevron glyph `aria-hidden`, matching the `▶` of the other starters),
`aria-label`/`title` `Fast-forward: write the artifacts, implement and open a pull request (<agent>)`, class
`btn sm session-start session-ff`. Placed right after **Draft artifacts** by the order of `SESSION_ACTIONS`
(`draft, fastForward, implement, validate, archive`).

### D7 — Demo

`demoApi.ts` accepts `fastForward` like `draft` and plays the `draft` transcript; the demo's in-memory config carries
`confirmFastForward` and the warning route updates it, so the dialog and "don't show again" behave as in the binary.

## Risks / Trade-offs

- [The agent may still stop after drafting and ask] → The bridging sentence says plainly not to; the session's badge
  shows "waiting" and the user can answer from the console. Nothing breaks — it degrades to today's flow.
- [A slash-command workflow may treat the long argument text oddly] → The change name comes first, as in the Implement
  prompt that already carries a tail; the preset prompts are the user's to edit.
- [No human review before code is written] → That is the feature; the dialog states it, and auto-merge is excluded so
  the pull request always waits for a person.
- [An older binary reading a session record with action `fastForward` after a downgrade] → `store.ts` does not
  validate the action, so the record loads; its label lookups yield nothing and the panel shows no step name — cosmetic.

## Migration Plan

None. The config field is optional and the starter needs no configuration. Rollback removes the button; the
`agentSessions` schema is not strict, so an older binary drops an unknown `confirmFastForward` on load and on its next
save.
