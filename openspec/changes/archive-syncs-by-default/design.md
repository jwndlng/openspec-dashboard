# Design

## Context

See proposal.md — Why. Relevant current state:

- An agent is a profile; its opening prompts are plain templates validated by `promptSchema` (`{change}` is the only
  placeholder, must be present, no permission-bypass words). The preconfigured one lives in
  `src/shared/agentDefaults.ts`. The dashboard never interprets a prompt and knows nothing about `/opsx:*`.
- Profiles are persisted in `~/.openspec-dashboard/config.json` from the first run on, so changing the constant alone
  reaches only new installations and the "add Claude Code" button in Settings.
- `availableActions` (`src/shared/types.ts`) is the single rule for starters: the UI (`startersFor`) and the server
  (`SessionManager.open`) both call it. It offers `archive` for stage `done` only, although `synced` has existed since
  the Synced column was added.
- `/opsx:archive` asks "Sync now / Archive without syncing" when delta specs differ from the main specs, and "Archive
  now / Sync anyway / Cancel" when they do not. Text after the change name reaches the command as part of its arguments.

## Goals / Non-Goals

**Goals:**

- One click on Archive leads to a synced, archived change without a routine question in between.
- Existing installations get that without editing their settings.
- Archive is reachable from `Synced`.

**Non-Goals:**

- No new setting, toggle or second prompt ("archive without sync"): the prompt is already editable.
- No change to how the dashboard detects a sync (`specSync.ts`) or to the archive worktree and branch.
- The dashboard does not sync or archive anything itself, and does not answer the agent's questions for it — the
  terminal stays a byte relay.
- Other users' custom profiles are not touched; they have no preconfigured Archive prompt to change.

## Decisions

### The behaviour lives in the prompt text

New preconfigured Archive prompt, one line, starting with the same slash command so the agent's own archive workflow
(artifact and task checks, dated target directory) still runs:

```
/opsx:archive {change} — sync the delta specs into openspec/specs first without asking me whether to sync, then archive; if they are already in sync, archive right away.
```

The former text is kept next to it as `FORMER_ARCHIVE_PROMPTS` (a list, so a later rewording can be added) for the
upgrade rule below. The final wording may be tuned during implementation as long as it keeps the three parts the spec
asks for (sync first, do not ask, archive right away when in sync), passes `promptSchema`, and stays vendor-neutral
English after the slash command.

*Alternatives:* a profile flag such as `archiveSync: boolean` that the server turns into prompt text — adds a concept
and makes the dashboard assemble prompts, against "an agent is a profile"; calling `openspec archive -y` from the
dashboard — a write to a tracked repository outside the enumerated exceptions, ruled out by invariant 1.

### Upgrade the former default when a configuration is validated, by exact match

In `validateConfig`, after parsing: for the profile whose id is `CLAUDE_PROFILE.id`, an `archive` prompt that equals an
entry of `FORMER_ARCHIVE_PROMPTS` is replaced by the current one. Exact string comparison after the schema's trim; a
missing prompt stays missing (the user removed the starter), anything else is the user's text.

Doing it in `validateConfig` covers both `loadConfig` and `PUT /api/config` with one rule, and keeps the UI free of it.
Nothing is written at load time: the upgraded value reaches the file the next time the user saves settings, which is
how every other schema default already behaves.

*Alternatives:* no upgrade — the person most likely to want this (someone already using Archive) would never get it
without finding the setting; versioned config migration (`version: 2`) — heavier than one string warrants and would
write at load; resolving a missing prompt to the default at start time, like `prompts.ship` — not possible here,
because a missing Archive prompt already means "no Archive starter".

*Accepted consequence:* a user who deliberately types the former prompt back gets the new one again. They can keep the
question by wording it differently (the spec's "Edited Archive prompt is kept" scenario); README mentions this.

### `availableActions` offers Archive for `done` and `synced`

The condition becomes `stage === "done" || stage === "synced"`, written inline: `isComplete` lives in
`src/shared/columns.ts`, which already imports values from `types.ts`, so importing it back would create a cycle. The
server's refusal and the UI follow automatically. `terminalSessions.test.ts` keeps its "not Done" refusal and gains a
synced case (a change whose delta specs are already in the main specs, or that has none).

## Risks / Trade-offs

- [An agent may still ask despite the prompt] → It is an instruction to a model, not a guarantee; the terminal is
  interactive, so the user answers as today. No regression versus the current behaviour.
- [The agent syncs wrongly] → It works in the `chore/archive-<change>` worktree; the result is a reviewable diff that
  only reaches the main branch through Ship and a pull request.
- [Exact-match upgrade surprises someone who wanted the old prompt] → See accepted consequence above; documented.
- [Non-Claude agents] → Unaffected; the long prompt is only the Claude profile's default. `{prompt}`-less commands
  type it into the terminal as one line, which is why it contains no newline.

## Migration Plan

No data migration. Rollback is reverting the commit: a configuration that was saved meanwhile contains the new prompt
as plain user text, which the older version accepts unchanged.
