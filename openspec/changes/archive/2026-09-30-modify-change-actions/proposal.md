# Proposal

## Why

A change's actions — Draft artifacts, Implement, Validate, Archive, plus Ship and Integrate — each run one prompt from
the agent's profile. Adding a standing instruction ("when you create a pull request, do A first") today means rewriting
the whole preconfigured prompt, which loses the careful wording the presets carry (the `- [~]` marker rules, syncing
before archiving) and silently opts the profile out of future prompt upgrades. Users want to *add* to an action's
prompt, not replace it.

## What Changes

- An agent profile gains an optional **additional instructions** text per prompt — `draft`, `implement`, `validate`,
  `archive`, `ship` and `integrate` — kept next to the prompts and edited in the same place in Settings.
- Whenever an action's prompt is produced, its additional text is appended to it: for the four starters, for the prompt
  sent into a running session, for Ship (including the agent-neutral default Ship prompt) and for Integrate.
- The composed prompt stays **one line**: the additional text is trimmed and its whitespace collapsed before it is
  appended with a single space, because a prompt may be typed into a terminal where a newline would submit it early.
- The additional text is **an addition, never a prompt of its own**: an action whose prompt is empty is still not
  offered, and its additional text is not sent anywhere. Ship is the one action with a default prompt, so additional
  Ship text applies on top of that default.
- Validation mirrors each prompt's own rules: `{change}` is the only placeholder allowed (not required) for the four
  starters and Ship, no placeholder at all is allowed for Integrate, and the permission-bypass rejection applies
  everywhere. Nothing else from the browser reaches a command line.
- No migration: a saved profile without the new field behaves exactly as today, and the preconfigured Claude Code
  profile ships with no additional text.

## Capabilities

### New Capabilities

_None — this extends how existing session prompts are composed._

### Modified Capabilities
- `agent-sessions`: the profile gains additional instructions per prompt; the requirements for session starters, for a
  starter's prompt sent to a running session, for Ship and for Integrate state that the profile's additional text for
  that action is appended to the prompt, that the result is one line, and that additional text alone never makes an
  action available.

## Impact

- `src/shared/types.ts` — `AgentProfile` gains `promptSuffixes: Partial<Record<PromptKey, string>>`.
- `src/server/config.ts` — the new field's schema (placeholder and bypass rules per key) in the agent profile schema.
- `src/server/sessions/agents.ts` — one place composes prompt + additional text: `openingPrompt`, `shipPrompt` and a
  new accessor for the Integrate prompt.
- `src/server/sessions/manager.ts` — `openIntegration` takes the Integrate prompt through that accessor.
- `src/ui/agentSettings.tsx` — an additional-instructions field under each of the six prompts.
- `openspec/specs/agent-sessions/spec.md` — delta for the four requirements named above.
- `test/agents.test.ts`, `test/config.test.ts`, `test/sessionPrompt.test.ts`, `test/integration.test.ts` — composition,
  validation and the API paths that send a composed prompt.
- No change to the config file format beyond the new optional field, no new API route, and no new write to any tracked
  repository.
