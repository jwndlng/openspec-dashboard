# Design

## Context

Three actions send a prompt that names no change-specific template a profile must tailor: Ship, Resolve conflicts and
Integrate. The first two already resolve `agent.prompts.<key> ?? DEFAULT_<KEY>_PROMPT` in `src/server/sessions/agents.ts`
and are therefore always available. Integrate instead returns `undefined` from `integratePrompt` when the profile has no
`integrate` key, and three places turn that into a refusal: `integrateUnavailable` in `src/shared/types.ts` (the row's
and New project's disabled reason), `openIntegration` in `src/server/sessions/manager.ts` (`400`), and the
`unavailable.includes("no Integrate prompt") ? 400 : 503` branches in `src/server/integration.ts` and
`src/server/createProject.ts`. The only Integrate text that exists today lives on the Claude Code preset
(`INTEGRATE_PROMPT` in `src/shared/agentDefaults.ts`), and it is already agent-neutral.

## Goals / Non-Goals

**Goals:**
- Integrate (and New project) work for every profile with zero configuration, mirroring Ship exactly.
- One source for the default text, shared by server and UI.

**Non-Goals:**
- Changing what an integration session does, where it runs, or how success is decided (the marker).
- Migrating or rewriting saved configurations.
- Changing the validation rules for `integrate` prompts or their additional instructions.

## Decisions

**D1 — `DEFAULT_INTEGRATE_PROMPT` lives in `src/shared/types.ts`, next to `DEFAULT_SHIP_PROMPT` and
`DEFAULT_RESOLVE_CONFLICTS_PROMPT`.** Its text is today's `INTEGRATE_PROMPT` verbatim. The UI needs it for the Settings
placeholder and the server for the fallback; `types.ts` is where the other two defaults already sit, and keeping the
three together makes the pattern obvious. Alternative: keep it in `agentDefaults.ts` — rejected, that file holds the
*preset*, and the default is precisely what applies when a profile is not the preset.

**D2 — `integratePrompt(agent)` returns `string`, composed from `agent.prompts.integrate ?? DEFAULT_INTEGRATE_PROMPT`.**
Same shape as `shipPrompt`, so the additional Integrate instructions extend the default too (agent-sessions delta).
Nothing is substituted, as before. Callers lose their `undefined` checks.

**D3 — Drop the "no Integrate prompt" reason entirely.** `integrateUnavailable` no longer looks at prompts; the
`400` branches in `integration.ts`, `createProject.ts` and `manager.ts` are removed rather than left as dead code. The
remaining reasons keep their status codes (`403` disabled, `503` agent missing / not found). Alternative: keep the
branch "just in case" — rejected, it is unreachable and would read as if the case still existed.

**D4 — The Claude Code preset drops its own `integrate` prompt.** It then behaves like it does for Ship. Restoring the
preset in Settings yields a profile without the key, and the default applies. Alternative: keep the preset's copy —
harmless, but two copies of the same text drift. Saved configurations that carry the old text keep it untouched: it
equals the default, so behaviour is identical, and rewriting user config on load is exactly what the "loads unchanged"
scenario forbids. No `FORMER_PROMPTS` entry is needed.

**D5 — Settings:** the Integrate field's placeholder becomes `DEFAULT_INTEGRATE_PROMPT` (it currently reads the preset's
prompt), and its hint changes from "Empty means this agent offers no Integrate action" to "Empty uses the default
shown", matching the Ship and Resolve conflicts hints. The additional-instructions hint drops "and only when it is set".

## Risks / Trade-offs

- [A saved Claude profile keeps a verbatim copy of the default, so a future improvement of the default would not reach
  it] → Acceptable today (identical text). If the default text ever changes, add the old text to `FORMER_PROMPTS` under
  `integrate`, as was done for Archive; the migration code already handles that per key.
- [An agent CLI that cannot run `openspec init` now shows an active Integrate where it used to be inactive] → The same
  is already true of Ship. The marker still decides success, so a failed attempt changes nothing; the user can still
  write a profile-specific Integrate prompt.
