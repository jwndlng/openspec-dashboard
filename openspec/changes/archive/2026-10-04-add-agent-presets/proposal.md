# Proposal

## Why

Claude Code is the only agent the dashboard knows how to set up. Every other agent CLI has to be added by hand in
Settings: an id, the argument list, where `{prompt}` goes, the resume command, and an opening prompt per starter that
the agent actually understands. Having an agent installed is not enough. With Antigravity's `agy` on `PATH`, Settings
offers nothing for it until the user writes a full profile and knows that it takes its first prompt as `-i <prompt>`
and resumes with `--continue`. Codex is in the same position. Getting the command line or the prompts wrong only shows
up when the first session fails or the agent misreads its opening prompt.

The dashboard already has a preset mechanism for exactly one agent: `CLAUDE_PROFILE`, with the `+ Claude Code preset`
button that Settings shows while no `claude` profile is configured. Extending that to the other common agent CLIs
makes adding one a single click, without the dashboard learning anything vendor-specific at run time.

## What Changes

- **A list of agent presets** next to `CLAUDE_PROFILE` in `src/shared/agentDefaults.ts`: Claude Code (unchanged),
  **Codex** and **Antigravity**. Each preset is an ordinary `AgentProfile` (id, name, command, prompts, optional
  resume command and `unsetEnv`), with nothing that profiles do not already support.
  - Antigravity (`agy`): command `["agy", "-i", "{prompt}"]` (an initial prompt, then the session stays interactive),
    resume `["agy", "--continue"]`.
  - Codex (`codex`): command `["codex", "{prompt}"]`, resume `["codex", "resume", "--last"]`. Not installed on the
    machine this was written on, so this has to be checked against `codex --help` before shipping.
- **Prompts each agent understands.** The Claude Code prompts use `/opsx:*` slash commands, but OpenSpec installs its
  workflows differently for each tool. For Antigravity it generates workflows at `.agents/workflows/opsx-<id>.md`
  (invoked as `/opsx-<id>`). For Codex it generates only skills, with no slash commands. Each preset carries prompts
  that work with what `openspec init --tools <tool>` installs for that agent, falling back to plain-language prompts
  that name `{change}`. The `- [~]` wording of the Implement, Validate and Archive prompts is the same for all of them.
- **Settings offers every preset that is not configured yet**, generalising today's `+ Claude Code preset` button. A
  preset whose executable is found on this machine is listed first and marked as found, using the same `whichOnPath`
  check that marks configured profiles. Choosing one copies it into the configuration, where it is an ordinary profile
  that the user can edit or remove.
- **Nothing is added automatically.** Agent sessions still ship disabled with only the Claude Code profile. Having
  `agy` or `codex` on `PATH` never adds a profile on its own; it only changes which presets Settings lists first.
- **Prompt upgrades apply to every preset.** The `FORMER_PROMPTS` migration in `config.ts` currently only touches the
  `claude` profile. It applies to any profile whose id matches a preset, with a per-preset list of former prompts, so
  a prompt the user edited is still left alone.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-sessions`: "An agent is a configurable profile, not a built-in integration" lists the preconfigured
  presets (Claude Code, Codex, Antigravity) and keeps Claude Code as the only one present by default.
- `repo-discovery`: "Settings expose agent sessions with their risks stated" replaces "restore the Claude Code preset"
  with adding any preset not yet configured, marked with whether its executable was found. "Agent session settings
  are part of the configuration" keeps the Claude Code profile as the only default.

## Impact

- `src/shared/agentDefaults.ts`: `CODEX_PROFILE`, `ANTIGRAVITY_PROFILE`, an `AGENT_PRESETS` list, and former
  prompts per preset.
- `src/server/config.ts`: the prompt migration goes over every preset id rather than only `claude`.
- `src/server/sessions/agents.ts` / API: availability for presets that are not configured, so Settings can mark
  them as found (or Settings can reuse the existing availability endpoint).
- `src/ui/agentSettings.tsx`: the preset picker replaces the single Claude Code button.
- `test/`: `agents.test.ts`, `config.test.ts` (migration per preset; presets pass the profile schema, including the
  no-bypass rule), and the Settings UI tests.
- `README.md`: the supported presets, and that each agent's OpenSpec commands come from `openspec init --tools`.
- No new dependency, no network, no change to how sessions run. `agents.ts` still knows no vendor; presets are data.

## Non-goals

- Detecting agents and adding profiles for them without the user asking.
- Running `openspec init --tools …` for a repository, or checking whether a repository has a given agent's workflows
  installed.
- Presets for every agent OpenSpec supports. Codex and Antigravity come first; others can be added as data later.
- Any agent-specific handling of output, login or permissions beyond what a profile already expresses.
