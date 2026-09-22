# Proposal

## Why

A change created from the dashboard lands in the repository as **untracked files**. Git ignores it in every operation
that matters afterwards: it does not travel with a commit, `git worktree add` does not carry it into an agent session's
worktree (the dashboard has to copy the directory by hand, `copyChangeIfMissing`), it shows up as working-tree noise
that can block the pull action's overlapping-edits check, and a careless `git clean` deletes it without warning. The
directory the dashboard just created for the user is the one thing git does not know about.

Staging it at creation time closes that gap at the only moment the dashboard is certain the files are new and its own:
the change becomes part of the repository's state as soon as it exists, and the user's next commit includes it without
them having to notice.

## What Changes

- After `createChange` has written `.openspec.yaml` (and `prompt.md`), the dashboard stages the new directory with
  `git add -- openspec/changes/<name>/` in the repository the change was created in.
- Staging is **best-effort and never fails the creation**: the files are already on disk, so a non-git repository, a
  locked index or any git failure leaves the change in place, still valid, merely untracked. The create response and
  the spec say which of the two happened.
- **BREAKING (invariant):** the dashboard gains its first *writing* git subcommand outside the agent-session worktree
  commands and the pull action, and its first deliberate write to the **main checkout's index**. Both are currently
  forbidden in so many words by the `dashboard-api` "never writes" requirement, by the `change-creation` "never
  executes anything in the repository" requirement and by invariant 1 in `CLAUDE.md`. Those three must be amended to
  enumerate `git add` on the new change directory, scoped to exactly that path, before the code changes.
- Unchanged: nothing is committed, pushed, branched or reset; no remote is contacted; no hook runs (`git add` runs
  none); only paths under the directory the dashboard just created are ever passed to git; and a *refused* create still
  leaves the repository byte-for-byte untouched, git included.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `change-creation`: the "Submitting the form creates the change directory" requirement gains the staging step and what
  the response reports; the "The dashboard never executes anything in the repository" requirement is replaced by one
  that permits exactly `git add` of the new directory and nothing else.
- `dashboard-api`: the "never writes" requirement's enumeration grows a fifth entry (staging the new change directory),
  its "MUST NOT change the main checkout's index" clause is narrowed to allow that one path, and `add` joins the list
  of permitted git subcommands as a write, not a read.

## Impact

- `src/server/createChange.ts` — stages the new directory after the writes succeed; `CreateChangeResult` carries
  whether staging happened. This is the module the "never writes" enumeration names, so the git invocation belongs
  here and nowhere else.
- `src/server/api.ts` — `POST /api/repos/<id>/changes` passes the staging outcome through in its `201` body.
- `src/shared/types.ts` — the create-change response type, if the UI is to see the outcome.
- `test/createChange.test.ts`, `test/createChangeApi.test.ts` — real temp git repositories asserting the new directory
  is staged, that a non-git repository still creates the change, and that a refused create runs no git at all.
- `CLAUDE.md` — invariant 1's enumerated exceptions.
- No UI behaviour change is required; the form, its validation and its focus rules stay exactly as specified.
- No collision with the in-flight changes: none of them touches `src/server/createChange.ts`, `src/server/api.ts`'s
  create route or either spec.
