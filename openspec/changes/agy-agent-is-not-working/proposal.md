# Proposal

## Why

The Antigravity (`agy`) preset is broken in two places a user hits on day one. Its command is `agy`, `-i`, `{prompt}`:
the main console and the project console leave out every argument containing `{prompt}`, so they start `agy -i` — a
flag with no value, which `agy` refuses — and no console with Antigravity ever opens. Separately, a change session in a
repository without any commit yet (exactly what **New project** produces: `git init` and nothing else) fails with
git's raw `could not create the worktree: fatal: invalid reference: HEAD`, which tells the user nothing about what to
do.

## What Changes

- The Antigravity preset's command becomes `agy`, `--prompt-interactive={prompt}`: the prompt is still exactly one
  argument (flag and value in one, which `agy`'s flag parser accepts), so leaving out the `{prompt}` argument for a
  console leaves out the flag with it and starts plain `agy`. Nothing about agents in general changes: the rule
  "every argument that contains `{prompt}` is left out" already covers this form.
- A saved `agy` profile whose command is, verbatim, the former preset command `agy`, `-i`, `{prompt}` is read as
  carrying the current one — the same per-preset upgrade the presets' former prompts already get. An edited command
  is the user's and stays as saved.
- Before creating a session worktree from `HEAD`, the dashboard checks read-only whether `HEAD` names a commit. When the
  repository has no commit yet, starting the session is refused with a reason that says so and points to what works:
  make a first commit (for example from the project console, which runs in the checkout) and start again. No worktree,
  branch or file is created, and no agent is started.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agent-sessions`: the Antigravity preset's command (and its scenario) changes; a former preset command is upgraded
  like a former preset prompt; a change session in a repository with no commit is refused with a plain reason instead
  of git's error.
- `project-console`: a scenario states that a preset whose prompt is a `--flag={prompt}` argument starts without that
  flag in the console (the Antigravity preset starts `agy` alone).

## Impact

- `src/shared/agentDefaults.ts` — Antigravity preset command; former commands per preset.
- `src/server/config.ts` — `upgradeFormerDefaults` also upgrades a verbatim former preset command.
- `src/server/sessions/worktree.ts` — `ensureWorktree` refuses an unborn `HEAD` with a plain reason (read-only
  `git rev-parse --verify --quiet`, already an allowed subcommand).
- `src/server/sessions/manager.ts` — that refusal reaches the card as a 409 with the reason, not a 500.
- Tests: `test/agents.test.ts`, `test/config.test.ts`, `test/agentSettingsUi.test.ts`, a worktree/session test for a
  repository without commits.
- `src/ui/changelog.ts` — What's new entry.
- No new git subcommand, no network, no new write: the invariants in `CLAUDE.md` are unchanged.
