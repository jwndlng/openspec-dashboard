# Design

## Context

Two independent defects, both reported against the Antigravity preset (see proposal.md — Why).

- **Console launch.** `launchWithoutPrompt` (`src/server/sessions/agents.ts`) drops every argument containing
  `{prompt}`. That is the specified, agent-neutral rule (main-console and project-console specs), and it already handles
  the attached form `--task={prompt}`. The Antigravity preset (`src/shared/agentDefaults.ts`) uses the detached form
  `agy`, `-i`, `{prompt}`, so the console is left with `agy -i`. `agy --help` prints Go-style flags (`Usage of agy:`,
  `-i  Short alias for --prompt-interactive`); a Go flag with a missing value is an error, so the agent exits at once.
  Go's flag parsing accepts `--name=value` and `-name=value`.
- **Unborn `HEAD`.** `ensureWorktree` (`src/server/sessions/worktree.ts`) creates a new branch with
  `git worktree add -b <branch> <path> <base>`, base `origin/HEAD` else `HEAD`. In a repository that has been
  `git init`-ed but never committed — the state **New project** leaves it in — `HEAD` is a symbolic ref to an unborn
  branch and git answers `fatal: invalid reference: HEAD`. The manager wraps it as a 500 that reaches the card verbatim.
  The specs already say a project with no commit can be worked on only through the project console (in place).

## Goals / Non-Goals

**Goals:**
- An Antigravity console starts plain `agy`; Antigravity change sessions still get the prompt as one argument.
- Existing installations that added the preset earlier are fixed on load, without the user re-adding it.
- A change session in a repository without a commit is refused before anything is created, with a reason the user can
  act on.

**Non-Goals:**
- No general "option that takes the prompt" concept in profiles, and no heuristic that drops the argument before
  `{prompt}`: a user-written `my-cli --verbose {prompt}` must keep `--verbose` in the console.
- No orphan-branch worktree for an unborn repository: it would hold none of the uncommitted project files (not even
  `openspec/config.yaml`), so the agent would work in an empty tree.
- No running a change session in the main checkout as a fallback — that breaks "a change session never runs in the main
  checkout".
- No hiding or disabling starters on the board for a commit-less repository; the scan does not know it today and the
  refusal on the card is enough.

## Decisions

1. **Preset command `agy`, `--prompt-interactive={prompt}`.** The flag and its value travel as one argument, so the
   existing rule removes both for the console, and `launchCommand` substitutes the prompt inside the argument (it
   already uses `replaceAll` for embedded placeholders). The long name is used rather than `-i={prompt}` because it is
   what `agy --help` documents as the real flag and reads clearly in Settings.
   *Alternatives:* a per-profile `consoleCommand` (new config surface, spec, UI and validation for one preset); dropping
   a preceding `-x` argument (wrong for boolean flags, changes every profile's behaviour).
2. **`formerCommands` per preset, upgraded verbatim.** `AgentPreset` gets `formerCommands: readonly (readonly
   string[])[]`, next to `formerPrompts`. `upgradeFormerDefaults` (`src/server/config.ts`) replaces a profile's command
   with the preset's current one only when the profile's id is that preset's and its command equals a former command
   element for element. Same guarantees as the prompts: per preset, nothing written on load, edited commands untouched.
   The validator needs no change — the new command has `{prompt}` as its only placeholder and no bypass flag.
3. **Read-only unborn check in `ensureWorktree`, before any write.** When no branch exists and the base would be
   `HEAD`, run `git rev-parse --verify --quiet HEAD^{commit}` (read-only, already on the allowed list). If it fails,
   throw a dedicated error (e.g. `NoCommitError`) *before* `mkdir` of the worktree parent and before `git worktree
   prune`, so nothing at all is changed. The message: the repository has no commit yet; an agent session works on a
   branch of its own, which needs a first commit — make one (for example in the project console) and start again. The
   check is only on the `HEAD` path: an `origin/HEAD` base or an existing branch already names a commit.
4. **409, not 500.** `manager.ts` maps that error to `SessionError(409, message)` in both `start` and `restart` (a
   resumed session whose worktree was deleted in a now-commit-less repository is the same situation); every other
   `ensureWorktree` failure keeps today's 500 with git's reason. The card already shows a refused start's message.

## Risks / Trade-offs

- [A future `agy` drops `=`-joined values or renames `--prompt-interactive`] → the preset is ordinary data the user can
  edit in Settings; the test pins the argument shape so a change is deliberate.
- [A user hand-wrote `agy -i {prompt}` under another id] → not upgraded by design (it is the user's); the console for it
  still fails as before, and the Settings command field shows what is run.
- [`rev-parse HEAD^{commit}` also fails for a corrupt repository] → the message would then mislead slightly; acceptable,
  since `worktree add` would fail there too.

## Migration Plan

None beyond Decision 2: an installation with the former preset command loads the new one and writes it on the next
save. Rollback is reverting the commit; a saved `--prompt-interactive={prompt}` command keeps working with the old code.
