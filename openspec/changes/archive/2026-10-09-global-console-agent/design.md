# Design

## Context

The main console resolves its agent with `defaultAgentOf(config)` in `SessionManager.openConsole`
(`src/server/sessions/manager.ts`). Resume and restart look up the profile by the session's own `agentId`
(`prepareAgainAnywhere`), so they already ignore the current choice. Projects choose an agent through
`repos[].agent.agentId` and fall back to the default (`agentFor` in `agents.ts`, `agentForRepo` in `sessionState.ts`).
The config schema refuses an unknown `agentId` (`config.ts`). When Settings removes a profile, `withLatestRepos`
(`settings.tsx`) strips the dangling `agentId`s before saving. The console folder (`agentSessions.consoleDir`) is
already a console-only setting in the same `AgentSessionsConfig` object, edited in the Console group of
`agentSettings.tsx`.

## Goals / Non-Goals

**Goals:**
- One optional key, resolved the same way as a project's agent: the chosen profile, else the default.
- No behaviour change for any existing configuration.

**Non-Goals:**
- Choosing the agent from the console overlay or the top bar. The choice is a setting, like the console folder.
- A per-start choice, or several consoles with different agents. The console stays one session at a time.
- Changing which agent **Integrate** or **New project** runs. Both stay on the default agent.

## Decisions

**D1 — `agentSessions.consoleAgent?: string`, absent = default.** It sits next to `consoleDir` because both are
console-only and saved with Settings. An absent key, rather than one copied from `defaultAgent`, keeps the console
following the default when the default changes, which is how a project with no agent of its own behaves.
*Alternative:* a top-level `console: { dir, agent }` object. Rejected because it would move `consoleDir` and need a
migration for no benefit.

**D2 — Validated like `repos[].agent.agentId`.** `agentSessionsSchema.superRefine` adds an issue at
`["consoleAgent"]` when the id names no profile. `PUT /api/config` then reports
`agentSessions.consoleAgent` with `400`, as it does for an unknown repository agent. *Alternative:* silently falling
back at runtime. Rejected because it hides a hand-edited typo. The UI cannot produce a dangling id (D4), so only a
hand edit can.

**D3 — `consoleAgentOf(config)` in `agents.ts` replaces `defaultAgentOf` in `openConsole`.** It returns the chosen
profile, else the default one, mirroring `agentFor`. `defaultAgentOf` stays for Integrate and New project. The `503`
message already interpolates `agent.name` and `agent.command[0]`, so it names the console agent without further change.

**D4 — Removal is handled in the draft, not in `withLatestRepos`.** `consoleAgent` is part of the Settings draft itself,
unlike repositories, which are saved on the projects overview. So `removeAgent` in `agentSettings.tsx` clears
`consoleAgent` in the same `set(...)` that drops the profile and fixes `defaultAgent`.

**D5 — Picker UI.** A `<select>` in the Console group, labelled "Console agent", with options "default agent" (value
`""`, which is stored as absent) and one per profile, shown only when `agents.length >= 2`. This matches `AgentPicker` in
`projectSettings.tsx`. The decision about showing it lives in a small pure helper, so `agentSettingsUi.test.ts` can test
it without the DOM. The Console hint changes from "opens your default agent" to "opens the agent chosen here (your
default agent unless you pick another)". The overlay hint in `console.tsx` says "Your console agent".

**D6 — Environment check.** `checkAgents` adds `consoleAgent ?? defaultAgent` to the `used` set, so a missing console
agent is `problem`. The default agent is already in the set.

## Risks / Trade-offs

- [Risk] A config with `consoleAgent` naming a deleted profile, edited by hand, fails to load, exactly as an unknown
  repository agent does today → The error names the path. Consistency with the existing rule is worth more than
  leniency for one key.
- [Trade-off] A changed choice does not affect a running console → This matches the spec. The user ends the console to
  switch, and Resume keeps the original agent's conversation, which is what Resume means.
- [Risk] An older binary reading a newer config drops the unknown `consoleAgent` key (zod strips unknown keys) and saves
  without it → The console falls back to the default agent. That is harmless, and the user can pick again.

## Migration Plan

None. The key is optional, and its absence keeps today's behaviour.
