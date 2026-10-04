# Design

## Context

See proposal.md for the motivation. Today:

- `src/shared/agentDefaults.ts` holds one preset, `CLAUDE_PROFILE`, plus a flat `FORMER_PROMPTS` map (per starter key)
  that only ever applies to it. The three `- [~]` prompts are module constants built around `/opsx:apply` and
  `/opsx:archive`.
- `upgradeFormerDefaults` in `src/server/config.ts` rewrites verbatim former prompts, but only on the profile with id
  `claude`.
- `src/server/sessions/agents.ts` `availability(config)` runs `whichOnPath(command[0])` for configured profiles only;
  the UI gets it from `GET /api/sessions` (`agents`) and marks each `AgentEditor` with ✓ found / ⚠ not found.
- `src/ui/agentSettings.tsx` shows one `+ Claude Code preset` button while no `claude` profile exists.
- What `openspec init --tools <tool>` installs (checked in `@fission-ai/openspec`'s `core/config.js` and
  `command-generation/adapters`): Claude Code gets `/opsx:<id>` commands; Antigravity gets workflows at
  `.agents/workflows/opsx-<id>.md`, invoked as `/opsx-<id>`, plus skills; Codex gets skills only, under
  `.agents/skills/openspec-<workflow>/` (`openspec-ff-change`, `openspec-apply-change`, `openspec-archive-change`, …),
  and no command adapter.
- `agy --help` (on this machine): `-i/--prompt-interactive <prompt>` runs an initial prompt and stays interactive;
  `--continue` resumes the most recent conversation; `--dangerously-skip-permissions` exists and must never appear.

## Goals / Non-Goals

**Goals:**
- Presets are data only; `agents.ts` and the session code stay vendor-free.
- One list drives defaults, Settings and the prompt migration, so adding a preset later is one entry.
- The `- [~]` semantics are written once and shared by every preset's prompts.

**Non-Goals:**
- Changing how a configured profile is matched to a preset beyond its id; an id is the only link.
- Reconciling an edited `agy`/`codex` profile with its preset (no "reset to preset" for a configured profile).

## Decisions

**D1 — A preset list with per-preset former prompts.** `agentDefaults.ts` exports
`AGENT_PRESETS: readonly AgentPreset[]`, where `AgentPreset = { profile: AgentProfile; formerPrompts: Partial<Record<PromptKey, readonly string[]>> }`,
in the order Claude Code, Codex, Antigravity. `CLAUDE_PROFILE` stays exported (tests and `defaultAgentSessions` use it)
and is the first entry's profile; `FORMER_PROMPTS` becomes the Claude entry's `formerPrompts` (kept as an export alias
so existing tests keep reading). Codex and Antigravity start with empty former lists. `AgentPreset` is a shared type
used only here and by the UI; it is not part of the configuration schema.
*Alternative:* a map keyed by id — rejected, the order matters for Settings and an array keeps it explicit.

**D2 — Shared `- [~]` wording, per-agent invocation.** The three tails (what to do with `- [~]` on Implement, Validate,
Archive) become constants, and each preset's prompt is `<invocation> — <tail>`:
- Claude Code: `/opsx:ff {change}`, `/opsx:apply {change} — …`, `/opsx:archive {change} — …` — byte-identical to
  today, so no saved `claude` profile changes and nothing new enters `FORMER_PROMPTS`.
- Antigravity: `/opsx-ff {change}`, `/opsx-apply {change} — …`, `/opsx-archive {change} — …`.
- Codex: plain language naming the skill and the change, e.g.
  `Use the openspec-apply-change skill to implement the OpenSpec change {change} — …`; Draft names
  `openspec-ff-change`, Archive `openspec-archive-change`. No `$skill` mention syntax: plain language works whether or
  not the agent resolves mentions, and a misread mention is the failure the proposal wants to avoid.
No preset sets Ship, Resolve conflicts or Integrate; they use the agent-neutral defaults as Claude Code does.
A test asserts every preset prompt is a single line, contains `{change}`, and passes `validateConfig`.

**D3 — Commands.** Antigravity: `["agy", "-i", "{prompt}"]`, resume `["agy", "--continue"]`. Codex:
`["codex", "{prompt}"]`, resume `["codex", "resume", "--last"]`. Both take the prompt as one argument, so `submit.ts`'s
typed path is not involved. Neither sets `unsetEnv`: the dashboard does not know which variables would override their
own login, and guessing would be vendor knowledge in a place that cannot be checked here. The Codex command line is
taken from Codex's documentation and must be checked against `codex --help` before release (task 1.3); if it differs,
only the preset data changes.

**D4 — Availability of unconfigured presets on the existing endpoint.** `GET /api/sessions` gains
`presets: AgentAvailability[]` — one entry per preset whose id is not configured, from `whichOnPath(profile.command[0])`,
the same local lookup `availability()` uses. Implemented next to `availability()` in `agents.ts` as
`presetAvailability(config)`, which reads the preset list as data and knows no vendor. *Alternative:* a new
`/api/agent-presets` route — rejected, one more GET for data that is fetched at the same moment by the same view.
*Alternative:* computing it in the UI — impossible, the browser cannot look at `PATH`.

**D5 — Migration per preset id.** `upgradeFormerDefaults` looks up the preset by `agent.id` in `AGENT_PRESETS`; with no
match the profile is returned untouched, otherwise it applies that preset's `formerPrompts` exactly as today's loop does
for Claude. One preset's former prompts can therefore never touch another preset's profile.

**D6 — Settings picker.** The single button becomes one ghost button per unconfigured preset (`+ Antigravity preset`),
ordered found-first and otherwise in preset order, each carrying the same ✓ found / ⚠ not found badge style as
`AgentEditor`. Choosing one appends `structuredClone(preset.profile)`. Until `presets` has loaded (or if the request
failed) the buttons are still shown, unmarked, in preset order — availability is a hint, never a gate. The hint text
names the presets instead of saying only Claude Code is preconfigured.

## Risks / Trade-offs

- [Codex's CLI differs from what the preset assumes] → task 1.3 checks `codex --help` before the change ships; the
  proposal already flags it. A wrong command only shows as "session ended" for a user who chose the preset, and is
  fixed by editing the profile.
- [A user's own profile already uses id `codex` or `agy`] → it counts as that preset being configured, so the preset is
  not offered, and it is migrated only for verbatim former prompts of that preset — of which there are none yet.
- [Agent CLIs change their flags or how OpenSpec installs workflows] → presets are data; a later change edits the entry
  and appends the old prompts to that preset's `formerPrompts`, the same mechanism Claude Code already uses.
- [Antigravity also gets skills, so `/opsx-*` may not be the only form that works] → workflows are what OpenSpec
  generates as commands for it; the prompt stays editable.

## Migration Plan

No data migration: existing configurations load unchanged, the Claude Code prompts are byte-identical, and new presets
appear only as Settings buttons. Rollback is reverting the change; a saved `codex`/`agy` profile stays a valid ordinary
profile under the old code.
