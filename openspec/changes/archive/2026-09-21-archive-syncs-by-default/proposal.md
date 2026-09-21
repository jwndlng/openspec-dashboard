# Proposal

## Why

Clicking **Archive** starts the agent with `/opsx:archive <change>`, which stops at a "Sync now / Archive without syncing"
question before doing anything — for a step whose answer is practically always "sync". And once a change's specs are
synced the board moves it to `Synced`, described as "ready to archive", where the Archive starter is no longer offered
at all: the one column that exists to be archived from has no button for it.

## What Changes

- The preconfigured Claude Code profile's Archive prompt tells the agent to sync the change's delta specs into
  `openspec/specs/` and then archive, without asking whether to sync; with nothing left to sync it archives right away.
  It stays an ordinary, editable prompt template (`{change}` only) — a user who wants the question back, or an archive
  without sync, edits it in Settings.
- A saved configuration that still carries the former preconfigured Archive prompt verbatim (`/opsx:archive {change}`)
  on the `claude` profile is read as the new one, so existing installations get the behaviour too. Any other text —
  including an edited prompt or a removed one — is left as the user wrote it.
- The **Archive** starter is offered for changes in `Done` **and** `Synced` (both mean "every task ticked, not archived
  yet"), in the UI and in the server-side check that refuses unavailable actions.
- README and the starter's tooltip say that archiving syncs the specs first.

Nothing changes in what the dashboard itself writes: it still only starts the user's agent in the archive worktree;
syncing and archiving are done by the agent under its own permission prompts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-sessions`: "Session starters run a fixed prompt for a validated change" — Archive is available in `Done` and
  `Synced`; the preconfigured profile's Archive prompt syncs delta specs before archiving without asking; the former
  preconfigured prompt in a saved configuration is treated as the new one.

## Impact

- `src/shared/agentDefaults.ts` — the new Archive prompt, and the former one kept as a named constant.
- `src/shared/types.ts` — `availableActions` offers `archive` for `done` and `synced`.
- `src/server/config.ts` — upgrading the former preconfigured Archive prompt when a configuration is validated.
- `src/ui/sessions.tsx` — Archive starter tooltip.
- `test/agents.test.ts`, `test/config.test.ts`, `test/terminalSessions.test.ts` — default prompt, upgrade rule, Archive
  in `Synced`.
- `README.md` — agent sessions section.
- `openspec/specs/agent-sessions/spec.md` via this change's delta spec.
- No API, dependency or on-disk format change; `src/server/sessions/manager.ts` needs no edit (it calls
  `availableActions`).
