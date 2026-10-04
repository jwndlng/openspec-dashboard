# Tasks

## 1. Presets as data

- [x] 1.1 In `src/shared/agentDefaults.ts`, split the Implement, Validate and Archive prompts into a shared `- [~]` tail per starter plus a per-agent invocation, keeping every `CLAUDE_PROFILE` prompt byte-identical (design D2); verify the existing `test/agents.test.ts` and `test/config.test.ts` pass unchanged.
- [x] 1.2 Add `AgentPreset`, `CODEX_PROFILE`, `ANTIGRAVITY_PROFILE` and `AGENT_PRESETS` (Claude Code, Codex, Antigravity; each with its own `formerPrompts`, Claude's being today's `FORMER_PROMPTS`, kept as an alias) with the commands and resume commands of design D3 and the prompts of D2; verify with a new `test/agents.test.ts` case that every preset passes `validateConfig` (no-bypass rule included), every prompt is one line containing `{change}`, Antigravity's start with `/opsx-`, Codex's contain no `/` command and name the `openspec-*` skill, and `launchCommand` yields `["agy", "-i", <prompt>]` and `["codex", <prompt>]`.
- [x] 1.3 Check the Codex preset against `codex --help` (an initial prompt as a positional argument that stays interactive, and `codex resume --last`), adjusting only the preset data if it differs — leave this as `- [~]` if `codex` is not installed here, so the user can confirm it.
- [x] 1.4 Verify `defaultAgentSessions()` still returns only the Claude Code profile: a `test/config.test.ts` case loads a configuration without `agentSessions` and asserts a single `claude` agent.

## 2. Server

- [x] 2.1 Make `upgradeFormerDefaults` in `src/server/config.ts` look the profile's id up in `AGENT_PRESETS` and apply that preset's `formerPrompts` (design D5); verify with `test/config.test.ts` cases: the existing Claude upgrades still pass, an `agy` profile carrying a former Claude prompt verbatim is left as saved, and a profile with an unknown id is untouched.
- [x] 2.2 Add `presetAvailability(config)` to `src/server/sessions/agents.ts` (one `AgentAvailability` per preset whose id is not configured, via `whichOnPath`), expose it through the session manager and return it as `presets` from `GET /api/sessions`; update the `sessions()` type in `src/ui/api.ts`; verify with a test that puts a fake `agy` on `PATH` and asserts `presets` marks it available, omits `claude` while it is configured, and lists `claude` once it is removed.

## 3. Settings

- [x] 3.1 Replace the `+ Claude Code preset` button in `src/ui/agentSettings.tsx` with a pure `PresetPicker` component (configured agents, `presets` availability, `onAdd`) that renders one button per unconfigured preset, found ones first and otherwise in preset order, each marked ✓ found / ⚠ not found, unmarked when availability is missing; adding appends a clone of the preset profile (design D6). Update the Agents hint to name the presets. Verify with `test/agentSettingsUi.test.ts` cases: with only `claude` configured and `agy` found, Antigravity comes first marked found, Codex follows marked not found, Claude is absent; a configured `agy` hides Antigravity; adding Antigravity calls `onAdd` with a profile equal to the preset.

## 4. Documentation and checks

- [x] 4.1 Update `README.md`: the available presets (Claude Code configured by default; Codex and Antigravity one click away in Settings), that each preset's prompts assume the OpenSpec commands or skills from `openspec init --tools <tool>`, and that nothing is added because an agent is installed; verify the README section reads correctly.
- [x] 4.2 Run `bun run check` and `openspec validate add-agent-presets --strict` and verify both pass.
- [x] 4.3 Run `bun run build`, start `dist/openspec-dashboard`, open Settings with agent sessions enabled and confirm the Antigravity and Codex preset buttons show with the right found marks and that adding one and saving stores an editable profile — leave as `- [~]` for the user to confirm in the browser.
