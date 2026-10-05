# Proposal

## Why

Many pull requests a session ships change nothing but OpenSpec documents: an archive branch
(`chore/archive-<name>`) only moves a change under `openspec/changes/archive/` and syncs `openspec/specs/`, and a
drafted proposal only adds files under `openspec/changes/<name>/`. Today every one of them waits for a manual merge,
because the Ship prompt always says "Do not merge it". For projects whose owners are happy to let such pull requests
merge on their own, that review step is pure friction — but code must still never merge unreviewed, and the dashboard
itself must keep changing nothing on GitHub.

## What Changes

- A new per-project setting, **Auto-merge docs-only pull requests**, off by default, stored on the repository's agent
  settings (`agent.autoMergeDocs`) and toggled on the projects overview next to the existing agent-session toggle,
  taking effect at once like the other per-project settings.
- When **Ship** runs for a session of a project with the setting on, the dashboard first decides — with read-only git
  and no network — whether everything the session's worktree would ship lies under `openspec/`: every file the branch
  changes relative to its base, plus every uncommitted or untracked file in the worktree. Only when that is proved, the
  Ship prompt is extended with a fixed, agent-neutral instruction to enable auto-merge on the pull request (so GitHub
  merges it once its required checks pass) instead of leaving it for review, and to refuse that and leave the pull
  request unmerged if the agent finds a change outside `openspec/`. In every other case — setting off, any file outside
  `openspec/`, base unknown, git failing — the Ship prompt is exactly what it is today.
- Ship's result says whether the auto-merge instruction was included, and the session panel says so, so the user always
  knows which kind of Ship they sent.
- The dashboard still never commits, pushes, merges or contacts GitHub for Ship: enabling auto-merge is the agent's
  action, under its own permission prompts, exactly like committing and pushing are today. Invariants 1 and 4 are
  unchanged; no `gh` subcommand is added.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: "Ship asks the agent to commit, push and open a pull request" gains the docs-only check and the
  auto-merge instruction for opted-in projects, and Ship's result reports whether it was included.
- `project-overview`: "Each managed project carries its own settings on the overview" gains the **Auto-merge docs-only
  pull requests** toggle.
- `dashboard-api`: "Per-repository settings endpoints" — `POST /api/repos/<id>/agent` accepts a boolean
  `autoMergeDocs`.
- `repo-discovery`: "Agent session settings are part of the configuration" — a repository's `agent` object may carry
  `autoMergeDocs` (absent means off).

## Impact

- `src/shared/types.ts` — `RepoConfig.agent.autoMergeDocs`, the fixed `AUTO_MERGE_DOCS_INSTRUCTION`, `ShipResult.autoMerge`.
  (`add-validate-phase` also edits this file, in unrelated declarations.)
- `src/server/config.ts` — the optional boolean on `repoSchema`'s `agent`.
- `src/server/sessions/workStatus.ts` — a read-only `shipsOnlyOpenSpec(worktreePath, base)`.
- `src/server/sessions/agents.ts` — `shipPrompt` takes whether to append the instruction.
- `src/server/sessions/manager.ts` — `ship()` decides and reports `autoMerge`.
- `src/server/api.ts` — `POST /api/repos/<id>/agent` accepts `autoMergeDocs`.
- `src/ui/projectSettings.tsx`, `src/ui/overview.tsx`, `src/ui/api.ts`, `src/ui/sessionPanel.tsx`,
  `src/ui/endSessionDialog.tsx`, `src/ui/styles.css` — the toggle and the Ship notice.
- `test/` — `agents.test.ts`, `config.test.ts`, a new `shipAutoMerge.test.ts` (temp git repositories, fake agent),
  the per-repository settings API test, and the overview settings UI test.
- `README.md` — one paragraph on the setting. `CLAUDE.md` — the Ship sentence under *Work status* mentions it.
- No new dependency, no network from the dashboard, no new git subcommand (`diff --name-only` and `status --porcelain`
  are already in the read-only list), no new write to a tracked repository.

## Non-goals

- The dashboard merging, approving or enabling auto-merge itself, or running any new `gh` subcommand.
- Auto-merging anything outside `openspec/`, or a configurable list of paths.
- Watching a pull request after Ship, or changing anything about how pull requests are listed or linked.
- In-place sessions (no git): they have no Ship, so the setting has no effect there.
