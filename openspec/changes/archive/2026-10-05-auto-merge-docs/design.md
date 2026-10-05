# Design

## Context

Ship (`SessionManager.ship()` in `src/server/sessions/manager.ts`) reads the worktree's work status, composes the
prompt with `shipPrompt(agent, change)` (`src/server/sessions/agents.ts`: the profile's Ship prompt or
`DEFAULT_SHIP_PROMPT`, plus the profile's Ship suffix) and either submits it to the running agent through `submit.ts`
or restarts the agent with it. The default prompt ends with "Do not merge it." The dashboard never commits, pushes or
runs a `gh` subcommand other than the read-only pull-request query (invariants 1 and 4).

Per-project settings live in `RepoConfig.agent` (`{ enabled, agentId? }`), are changed through
`POST /api/repos/<id>/agent` (`src/server/api.ts`) and are toggled on the projects overview
(`src/ui/projectSettings.tsx`). Work status already resolves a base (`baseRef(repoPath)` in
`src/server/sessions/workStatus.ts`: the default branch's remote-tracking ref, or the main checkout's commit) and
already runs `git diff --name-only -z <base>...HEAD` and `git status --porcelain` — both on the read-only list.

## Goals / Non-Goals

**Goals:**
- A per-project, off-by-default opt-in that makes Ship ask the agent to enable auto-merge, but only for a session
  whose shipped work is provably confined to `openspec/`.
- Fail closed: any doubt (git error, unknown base, odd path) yields today's prompt unchanged.
- Keep the dashboard's footprint on GitHub and on the repository exactly as it is.
- Tell the user, per Ship, whether the auto-merge instruction was sent.

**Non-Goals:**
- The dashboard running `gh pr merge` or any other GitHub write; watching or verifying the merge afterwards.
- Configurable path globs, or Markdown outside `openspec/`.
- A profile-editable auto-merge prompt (see D4).

## Decisions

**D1 — The agent merges, not the dashboard.** The user chose this over the dashboard running `gh pr merge`, which
would have added the first GitHub write to invariants 1 and 4 and a merge that happens without a click on the merge
itself. Ship already delegates commit, push and PR creation to the agent under its own permission prompts; enabling
auto-merge is one more step of the same kind. The spec's sentence "the dashboard itself MUST NOT commit, push, or
contact a remote" is extended with "merge, enable auto-merge" to keep that explicit.

**D2 — The setting lives at `RepoConfig.agent.autoMergeDocs`.** It only has an effect through an agent session, so it
sits with the other per-project agent settings, rides the existing `POST /api/repos/<id>/agent` route and its
validation, and needs no new endpoint. Optional boolean; `false` deletes the key (like empty label lists) so an older
build reading the config sees nothing new. `repoSchema` adds `autoMergeDocs: z.boolean().optional()` to the `agent`
object. Alternative considered: a top-level repo key — rejected because it would show while agent sessions are off,
where it can do nothing.

**D3 — The docs-only check is computed at Ship time, in `workStatus.ts`.** A new
`shipsOnlyOpenSpec(worktreePath, base): Promise<boolean>`:

1. `base` unknown → `false`.
2. `git diff --name-only -z <base>...HEAD` → committed paths (fail → `false`).
3. `git status --porcelain=v1 -z --untracked-files=all` → uncommitted paths, taking both the source and destination
   of renames/copies (fail → `false`).
4. `true` iff the union is non-empty and every path starts with `openspec/` (repository-relative, as git prints it;
   no normalisation, so `docs/openspec/…` and `openspec-notes.md` do not match).

`ship()` calls it only when `repo.agent?.autoMergeDocs === true`, after the shippable-state check, using the same base
`readWorkStatus` used. It is not added to `readWorkStatus` itself: that runs on every status poll for every worktree,
and this answer is only needed at the moment of Ship. Uncommitted files are included because the default Ship prompt
asks the agent to commit everything in the worktree.

**D4 — The instruction is a fixed constant appended last.** `AUTO_MERGE_DOCS_INSTRUCTION` in `src/shared/types.ts`,
agent-neutral (it says "enable auto-merge on the pull request", never names `gh`), one line (it may be typed into a
terminal — same rule as `compose()`), and worded to override an earlier "do not merge" so it works with the default
prompt and with a profile's own Ship prompt alike. It also asks the agent to re-check the pull request's files itself:
the dashboard's check is a snapshot, and the agent is the one who commits. `shipPrompt(agent, change, { autoMerge })`
appends it after the profile's suffix. Not profile-editable in this change: a customisable merge instruction is a
foot-gun (it is the one prompt that loosens review), and the profile's Ship suffix already lets a user add to it.

**D5 — Ship reports `autoMerge`.** `ShipResult` gains `autoMerge: boolean`. The session panel and the end-session
dialog, which both trigger Ship, show a one-line notice when it is `true` ("Asked the agent to enable auto-merge —
only OpenSpec documents changed"). The activity log's `session-shipped` event is left as it is: it records that Ship
was sent, and the notice is about the prompt, not an observed outcome.

**D6 — The overview toggle.** `AutoMergeToggle` in `src/ui/projectSettings.tsx`, modelled on `AgentToggle`: shown
only when the project's agent sessions are enabled and the project is a git repository (in-place sessions have no
Ship), inactive while agent sessions are off globally, saving through the same tracking helper that posts
`{ autoMergeDocs }` and reverting on failure.

## Risks / Trade-offs

- **Work added after Ship** → the agent could commit a code change after enabling auto-merge, and GitHub would merge it
  once checks pass. Mitigation: the instruction tells the agent to confirm every changed file is under `openspec/`
  before enabling it; branch protection and required checks still apply; the setting is opt-in per project and
  described as such in its tooltip and the README.
- **The agent ignores or misreads the instruction** → the dashboard does not verify. Accepted: the same holds for
  commit and push today, and the pull-request view shows what actually happened.
- **The repository does not allow auto-merge** (GitHub setting off) → the agent's attempt fails and it reports so; the
  pull request stays open, which is today's behaviour.
- **No required checks** → GitHub may merge immediately on enabling auto-merge. That is what the user opted into for
  documents-only pull requests.
- **Stale base** → the base is as fresh as the last fetch; a base behind the remote can only make the diff larger
  (more paths), never hide a code path the branch itself changed, so it cannot turn a code branch into docs-only.
- **Overlap with `add-validate-phase`** → both edit `src/shared/types.ts`, in unrelated declarations; whichever lands
  second rebases.
