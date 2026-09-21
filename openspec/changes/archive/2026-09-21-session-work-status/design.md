# Design

## Context

Sessions run in worktrees the dashboard creates under `~/.openspec-dashboard/worktrees/<repoId>/<name>`. The dashboard never commits or pushes and never contacts a remote (hardware-key remotes would block; see `run-agent-actions-from-ui` D17). After a session ends, its work is invisible. The goal is that every change ends in a pull request and no worktree is forgotten — without the dashboard doing git writes itself.

## Goals / Non-Goals

**Goals:** make the state of every session worktree visible; one click to have the *agent* ship it; make merged worktrees easy to remove.

**Non-Goals:** the dashboard committing, pushing or calling `gh`; looking up pull requests (needs network; a possible opt-in later); running agents in the main checkout (separate change, only if needed); deleting branches.

## Decisions

### D1 — Status is computed per worktree directory, not per session record
Records are pruned after 50 and can be deleted by hand; the directory is what can be forgotten. `listWorktrees` reads `worktreesDir()/<repoId>/*` for configured repositories and joins the most recent session by `worktreePath`. Change and action come from the record, else from the directory name (`archive-<change>` / `<change>`, the inverse of `worktreeName`).

### D2 — States and their order
`missing → uncommitted → merged → clean → unpushed → pushed`, first match wins (spec). Commands, all read-only and run with `GIT_OPTIONAL_LOCKS=0`:

| Question | Command |
|---|---|
| is a worktree, branch | `rev-parse --is-inside-work-tree`, `symbolic-ref --short HEAD` |
| base | `symbolic-ref --short refs/remotes/origin/HEAD` in the repository, else `rev-parse HEAD` there |
| uncommitted files | `status --porcelain --untracked-files=all` |
| commits the base lacks | `rev-list --count <base>..HEAD` |
| files the branch changed | `diff --name-only <base>...HEAD` |
| same content in base | `diff --quiet <base> HEAD -- <files>` |
| ahead of upstream | `rev-list --count @{u}..HEAD` |
| last activity | `log -1 --format=%cI` |

**Merged by content.** GitHub's squash and rebase merges never make the branch's commits reachable from the base, so reachability alone would show every squash-merged branch as `pushed` forever. Comparing the content of exactly the files the branch touched is read-only (unlike the `commit-tree` + `cherry` trick, which writes an object) and errs on the safe side: if the base later changes one of those files, the branch reads as `pushed` again, never the other way round. More than 500 changed files skips the check. `diff` is added to the enumerated read-only git commands.

**Alternative considered:** `gh pr view`. Accurate, but network, an extra dependency and auth; rejected for now (proposal).

**Known limit:** nothing is fetched, so `merged` appears after the user's next `git fetch`/`pull` in that repository. The UI says "as of your last fetch".

### D3 — Delivery and cost
`GET /api/sessions` gains `worktrees`, so the UI keeps its single 3 s poll. The manager caches the list for 15 s, shares one in-flight computation, and drops the cache when a session ends, on Ship and on removal. Feature off → empty list, no git.

### D4 — Ship is a prompt, not a git operation
`POST /api/sessions/:id/ship`. Running → `proc.write(prompt + "\r")`. Ended → same checks as `resume`; start `resumeCommand` and type the prompt after the start-up delay (existing `typed` mechanism), so the agent still knows what it did; without a resume command, `launchCommand(agent, prompt)`. The Ship prompt is `agent.prompts.ship ?? DEFAULT_SHIP_PROMPT`. The default is plain English and agent-neutral, so existing configs need no migration and every agent gets the button. `ship` is a prompt key, **not** a `SessionAction`: it does not open a session for a stage and `Session.action` keeps its meaning.

### D5 — Removal accepts `merged`
`checkWorktreeRemovable` gains an optional "merged" short-cut: clean + merged → removable even when the upstream ref is gone (squash-merge + branch deletion + `fetch --prune` is the common flow and would otherwise leave worktrees unremovable). `git worktree remove` never deletes the branch, so no commit becomes unreachable. `POST /api/worktrees/remove` covers worktrees without a record; the name is validated as one path segment and the path is built by the server.

### D6 — UI
Pure helpers in `sessionState.ts` (`workBadge`, `isStale`, `openWork`, `worktreeForChange`) so they are unit-tested without a DOM. Card: work badge next to the session badge. Top bar: "Open work N" button with a popover list, rendered inside `SessionProvider`. Panel: status line, Ship, preselected removal when merged.

## Risks / Trade-offs

- Stale `merged` without fetch → stated in the UI; safe direction (shows `pushed`).
- Extra git processes → cached, only with the feature on, only for existing directories.
- Ship typed into a busy agent is queued or interleaved by that agent → it is an explicit click on a visible terminal; acceptable.
- Content-merged false positive (branch reverted its own work to match base) → then there is indeed nothing to ship.

## Spec base

The deltas for `agent-sessions` and the rewritten "never writes" requirement are based on the specs as synced by the archive of `run-agent-actions-from-ui`. `dedupe-discovery` also carries a MODIFIED copy of "never writes"; whichever of the two is archived second must take over the other's addition (`diff` here, `config --get` there).
