# Proposal

## Why

**Docs auto-merge** (`auto-merge-docs`) only reaches the agent through **Ship**. But the pull requests it exists for —
archive branches that only move a change under `openspec/changes/archive/` and sync `openspec/specs/` — are usually not
opened by Ship at all: the **Archive** session opens them itself, because the user's additional Archive instructions ask
the agent to "create a PR whenever you finished the archive". Those prompts never carry the auto-merge instruction, so
with the setting on, every archive pull request still waits for a manual merge. The setting does nothing on the path
where it matters most.

## What Changes

- When an **Archive** prompt is produced for a session of a project with **Docs auto-merge** on — starting the Archive
  starter, or sending Archive into the change's running session — the dashboard decides, with read-only git and no
  network, whether the session's worktree holds **nothing outside `openspec/`**: every path the branch changed since it
  forked from its base, plus every uncommitted or untracked path, lies under `openspec/`. An archive session normally
  gets a fresh worktree on its own branch from the base, so that holds unless code is already in it.
- Only when that is proved, the Archive prompt is extended — after the profile's additional Archive instructions — with
  a fixed, agent-neutral instruction: **if** the agent opens a pull request for this work, it checks that every file
  the pull request changes is under `openspec/` and then enables auto-merge on it (in place of any earlier "do not
  merge"), or leaves it unmerged and says why; it must not open a pull request just for this. Unlike Ship's
  instruction, it does not presume a pull request: the default Archive prompt opens none.
- In every other case — setting off, an in-place session, any path outside `openspec/`, base unknown, git failing — the
  Archive prompt is exactly what it is today.
- The start and send-action results say whether the instruction was included, and the session panel shows the same
  notice it shows for Ship.
- The dashboard still never commits, pushes, merges, enables auto-merge or contacts GitHub. Invariants 1 and 4 are
  unchanged; no `gh` subcommand and no new git subcommand are added. Ship's behaviour is unchanged.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: "Session starters run a fixed prompt for a validated change" gains the docs-only check and the
  conditional auto-merge instruction for the Archive prompt of an opted-in project; "Any available action can be sent
  to the change's running session" applies the same to Archive sent into a running session. Ship's requirement is
  unchanged.
- `project-overview`: "Each managed project carries its own settings on the overview" — the **Docs auto-merge**
  tooltip says it applies to Archive as well as Ship.

## Impact

- `src/shared/types.ts` — a second fixed constant, `AUTO_MERGE_DOCS_ARCHIVE_INSTRUCTION`; `autoMerge` on the start
  and prompt results.
- `src/server/sessions/workStatus.ts` — `shipsOnlyOpenSpec` gains a variant that accepts an empty diff (a fresh archive
  worktree has nothing in it yet).
- `src/server/sessions/agents.ts` — `openingPrompt` takes whether to append the archive instruction.
- `src/server/sessions/manager.ts` — `start()` composes the Archive prompt after the worktree exists; `prompt()` decides
  the same for Archive sent into a running session.
- `src/server/api.ts` — the start and prompt routes pass `autoMerge` through.
- `src/ui/sessions.tsx`, `src/ui/sessionState.ts`, `src/ui/sessionPanel.tsx`, `src/ui/projectSettings.tsx`,
  `src/ui/demo/demoSessions.ts` — the notice after starting or sending Archive, and the tooltip text.
- `test/` — `agents.test.ts`, `shipAutoMerge.test.ts` (archive start and send-action cases, temp git repositories,
  fake agent), `projectSettingsUi.test.ts` if it asserts the tooltip.
- `README.md` — the Docs auto-merge paragraph. `CLAUDE.md` — the Ship sentence under *Work status* mentions Archive.
- No new dependency, no network from the dashboard, no new write to a tracked repository.

## Non-goals

- The dashboard opening, merging or enabling auto-merge on a pull request itself, or running any new `gh` subcommand.
- Making the Archive prompt open a pull request: whether it does stays the profile's (or its additional instructions')
  decision.
- Adding the instruction to Draft, Implement or Validate: their branches carry code or are not meant to merge unreviewed.
- Changing the GitHub repository's rules. Auto-merge waits only for *required* checks; a repository with none may merge
  as soon as auto-merge is enabled. The README says so.
