# Design

## Context

See `proposal.md` — Why. What shapes the approach is the invariant set, not the feature:

- **Invariant 1** enumerates every write to a tracked repository. A conflict check must add no entry to that list, which
  means it may not touch a working tree, an index, a ref or the repository's object database.
- **Invariant 4** forbids network at runtime outside the pull action. So the check is answered from what the last fetch
  left behind, exactly like `merged` in `workStatus.ts` already is.
- **Ship is the precedent.** `manager.ts:ship()` reads a fresh work status, refuses when the state does not allow it,
  builds a prompt from the agent profile and hands it over through `submit.ts`. The dashboard does none of the work
  itself. Resolve conflicts is the same shape with a different predicate and a different prompt.
- `workStatus.ts` already spawns read-only git per worktree with `GIT_OPTIONAL_LOCKS=0` and a `git()` helper that
  swallows failures into `{ ok: false }`. The conflict check belongs there, not in a new subsystem.

## Goals / Non-Goals

**Goals:**

- Answer "would this branch merge into its base" exactly, not heuristically, and name the conflicting files.
- Leave the repository byte-for-byte unchanged, provably, including its object database.
- Degrade to silence: an old git, a missing base or any failure means no conflict information, never an error.
- Reuse Ship's submission path and its refusal discipline rather than inventing a second one.

**Non-Goals:**

- Reading the pull request. See `proposal.md` — Non-goals.
- Making the check cheap enough to run for every change on the board. It runs where work status already runs: for
  session worktrees.
- Any dashboard-side merge, rebase or conflict edit.

## Decisions

### D1 — `git merge-tree --write-tree`, with its object directory redirected

`git merge-tree --write-tree --name-only <base> <branch>` performs a real merge in memory. It exits `0` when the merge
is clean and `1` when it conflicts; on conflict its stdout is the merged tree's OID, then the conflicting paths one per
line, then a blank line and informational text. That is an exact answer, produced by git's own merge machinery, for the
same question GitHub answers for the pull request.

Its one side effect is that it writes the merged tree and any merged blobs into the object database. That would create
files inside the tracked repository and break invariant 1's "no file under any tracked repository is created". So it is
invoked with:

```
GIT_OBJECT_DIRECTORY=<scratch dir under ~/.openspec-dashboard/>
GIT_ALTERNATE_OBJECT_DIRECTORIES=<repo>/.git/objects        # from `git rev-parse --git-common-dir`
GIT_OPTIONAL_LOCKS=0
```

git then reads every object it needs through the alternate and writes everything new into the scratch directory. This
was verified against git 2.54 on a temporary repository: the repository's object count was unchanged, two objects
appeared in the scratch directory, and `git status` and `HEAD` were untouched.

The scratch directory is a subdirectory of `~/.openspec-dashboard/` (a new entry in `paths.ts`), created on demand with
the `info/` and `pack/` layout git expects, shared by all checks and pruned on start-up. It holds nothing worth keeping;
deleting it at any moment is safe.

From a linked worktree `.git` is a file, so the alternate must come from `git rev-parse --path-format=absolute
--git-common-dir` rather than a constructed path.

*Alternatives considered.* (a) `git merge-base` plus a diff of the touched files: no writes, but it only tells us the
branches touched the same file, not that they conflict — false positives on every branch that edits a shared file, which
is most of them here. (b) The legacy three-argument `git merge-tree <base> <ours> <theirs>`: writes nothing, but it is
the deprecated trivial merge, reports conflicts as `<<<<<<<` markers inside a diff-like stream that has to be parsed,
and does not handle renames. (c) A throwaway worktree or clone to merge in: correct, but it is an actual merge, needs an
entry in invariant 1, and costs a checkout per branch. (d) `git merge --no-commit` in the session worktree: changes the
user's worktree — excluded outright.

### D2 — The conflict lives inside `WorkStatus`, not beside it

`WorkStatus` gains an optional `conflicts?: { base: string; files: string[]; truncated?: boolean }`. It is computed only
for `uncommitted`, `unpushed` and `pushed` — the states that mean "there is work here that is not in the base yet" — and
it rides the existing 15-second cache and the existing recomputation points (session end, Ship, worktree removal), with
Resolve conflicts added to them. Nothing new polls.

`readWorkStatus` already computes `base` and the ahead count; the check is one more `git()` call on the path where the
status is not `merged`/`clean`/`missing`, run for the whole set of worktrees with the same `Promise.all` fan-out that is
there today. The file list is capped (the same spirit as `MAX_COMPARED_FILES`) and the cap is reported as `truncated`,
so a branch that conflicts in 300 files does not push 300 paths through `GET /api/sessions`.

For an `uncommitted` worktree the check is made against the branch's last commit, not the dirty tree: git merges
commits, and a conflict with committed work is the honest statement. The UI wording says "this branch", not "your
uncommitted files".

*Alternative considered:* a separate `GET /api/sessions/<id>/conflicts` computed on demand. Rejected — the panel needs
the badge on first paint, and a second round trip per session reintroduces exactly the fan-out the snapshot exists to
avoid.

### D3 — Resolve conflicts mirrors `ship()` rather than generalising it

A new `manager.resolveConflicts(id)` sits next to `ship()`: same `prepareRestart`, same fresh `readWorkStatus`, same
running/ended split, same `report()` into the activity log. The predicate differs (`work.conflicts !== undefined`
instead of `SHIPPABLE_WORK.includes(work.state)`) and the prompt differs.

Refactoring both into one parameterised "hand the agent a prompt" helper is tempting and is deliberately not done here:
`ship()` is load-bearing, its refusal messages are specified scenario by scenario in `agent-sessions`, and two in-flight
changes touch `manager.ts`. Duplicating about fifteen lines is the cheaper and more reviewable option. If a third such
action ever appears, that is the moment to extract the helper.

`PromptKey` gains `"resolveConflicts"`, so a profile can override the prompt exactly like `ship`, and
`DEFAULT_RESOLVE_CONFLICTS_PROMPT` in `shared/types.ts` is the agent-neutral fallback. The prompt is written so it works
whether the project rebases or merges — it states the goal (the branch merges into the base again, its intent intact,
checks pass, pushed) and leaves the method to the agent, which knows the repository's conventions from its own
instructions file.

### D4 — Freshness is stated, never fixed

The check uses the base as the repository locally knows it, so a branch can be reported as merging cleanly hours after
it stopped doing so. This is the same compromise `merged` already makes and the UI already has wording for it. The badge
says "as of your last fetch" and the panel points at **Pull**, which is the existing, user-initiated way to move the
base. The conflict signal is recomputed after a pull only because a pull already invalidates the work-status cache — no
new trigger is added.

### D5 — The UI reuses the work badge

`sessionPanel.tsx` already renders a work badge from `workBadge(tree, ui.sessions)` and gates Ship on `shippable`. The
conflict becomes a second badge with a warning tone next to it, and `resolvable` is computed the same way `shippable`
is, in `sessionState.ts`, so the control's presence and the server's refusal come from one predicate expressed twice in
the usual places. `sessions.tsx`'s `WorkStatus` view, used by `changeDetail.tsx`, gets the same badge but no control —
the control stays where the agent is.

## Risks / Trade-offs

- **A stale base gives a wrong answer in both directions** → Stated in the UI rather than hidden, the same as `merged`.
  Fixing it would require fetching, which is a new invariant exception the user explicitly declined.
- **`--write-tree` needs git 2.38 (Sept 2022)** → Detected by the command failing, which the existing `git()` helper
  already turns into `{ ok: false }`; the status then carries no conflict information and no control is offered. No
  version probing, no second code path.
- **A redirected object directory is unusual and easy to get wrong** → If `GIT_ALTERNATE_OBJECT_DIRECTORIES` is wrong,
  git cannot read the commits and the command fails, which degrades to "no conflict information" — it never silently
  produces a wrong answer. A test asserts the repository's object database is unchanged after a check.
- **Extra git process per worktree on every status read** → Only for worktrees with unmerged work, behind the existing
  15-second cache, and merge-tree does no checkout. Worth watching if someone has dozens of live worktrees; the cap on
  reported files bounds the response, not the work.
- **The agent may resolve conflicts badly** → Out of the dashboard's hands by design: it hands over a prompt, the agent
  works under its own permission prompts, and the resulting state is re-derived from git like everything else. The
  prompt asks for the project's checks to be run before pushing.
- **`manager.ts`, `workStatus.ts` and `sessionPanel.tsx` are contended** → The change adds alongside rather than
  rewriting: a new field, a new method, a new badge. No existing work state, refusal or prompt changes behaviour.
