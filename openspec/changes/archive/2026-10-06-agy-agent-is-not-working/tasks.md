# Tasks

## 1. Antigravity preset command

- [x] 1.1 Change `ANTIGRAVITY_PROFILE.command` in `src/shared/agentDefaults.ts` to `["agy", "--prompt-interactive={prompt}"]` and update its comment; verify `test/agents.test.ts` asserts `launchCommand` gives `["agy", "--prompt-interactive=<prompt>"]` and `launchWithoutPrompt` gives `["agy"]`
- [x] 1.2 Update the other tests that pin the old preset command (`test/agentSettingsUi.test.ts`, `test/sessionPrompt.test.ts`, `test/config.test.ts`) and verify every preset still passes config validation

## 2. Former preset commands

- [x] 2.1 Add `formerCommands` to `AgentPreset` (`src/shared/agentDefaults.ts`), with `["agy", "-i", "{prompt}"]` for the Antigravity preset and none for the others
- [x] 2.2 Extend `upgradeFormerDefaults` in `src/server/config.ts` to replace a profile's command only when its id is the preset's and the command equals a former one element for element; verify in `test/config.test.ts`: the former `agy` command is upgraded (prompts and resume command unchanged), an edited command and a `my-agy` profile with the same command stay as saved, and loading does not rewrite the file

## 3. Repository without a commit

- [x] 3.1 In `ensureWorktree` (`src/server/sessions/worktree.ts`), when the base would be `HEAD`, check `git rev-parse --verify --quiet HEAD^{commit}` before the `mkdir` and `git worktree prune`, and throw a dedicated error with the plain "no commit yet — make a first commit, e.g. in the project console" reason
- [x] 3.2 Map that error to `SessionError(409, …)` in `manager.ts` for both starting and restarting a session; other worktree failures stay 500 with git's reason
- [x] 3.3 Add a test with a temp `git init` repository without commits: starting a change session (Implement on the fixture's `upgrade-runtime`) is refused with 409 and that reason, no worktree directory, branch or worktree record exists afterwards, and no agent process is started

## 4. Wrap-up

- [x] 4.1 Run `bun run check` and verify it passes
- [x] 4.2 In the built binary (`bun run build`), with the Antigravity preset as a project's agent, open its project console and confirm `agy` starts and stays open; start a change session in a freshly created project with no commit and confirm the card shows the new reason
- [x] 4.3 Add a What's new entry at the top of `src/ui/changelog.ts` saying Antigravity consoles now open and that a project without a first commit explains why a change session cannot start
