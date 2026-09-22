# Design

## Context

See `proposal.md` — Why. The constraint that shapes everything here is invariant 1: `src/server/sharedConfig.ts`,
`src/server/sessions/worktree.ts`, `src/server/pull.ts` and `src/server/createChange.ts` are the only modules that
write to a tracked repository, and every write is enumerated in the `dashboard-api` "never writes" requirement. Adding
a writing git subcommand is therefore a spec change first and a code change second.

`createChange(repoPath, name, prompt?)` today writes two files and returns `{ ok: true, name, dir, wrotePrompt }`;
`src/server/api.ts` turns that into `201 { name }` and triggers a rescan. `src/server/git.ts` is documented as
read-only ("nothing here ever mutates a repository") and its `git()` helper swallows stderr and returns `undefined` on
failure. `src/server/sessions/worktree.ts` and `src/server/pull.ts` each carry their own private `git()` runner for
exactly that reason — the writing commands do not live in the read-only module.

## Goals / Non-Goals

**Goals:**

- One git invocation, scoped to one path, in one module, at one moment — easy to point at when auditing invariant 1.
- Creation stays successful whatever git does; the user never loses a change to a staging failure.
- The tests prove the scoping (nothing else staged) and the non-escalation (nothing committed), not just the happy path.

**Non-Goals:**

- Committing, or offering to commit. Staging is as far as the dashboard goes; the commit is the user's or the agent's.
- Staging anything the dashboard did not just create — no `git add -A`, no re-staging on rescan, no repair of a change
  that was created before this feature.
- Removing `copyChangeIfMissing`. Staging does not put the change into a new worktree's tree; a worktree gets its files
  from a commit, and an index entry is not one. That helper stays exactly as it is.
- Any UI change. `staged` rides along in the response for the API contract and the tests; the form does not render it.

## Decisions

**D1 — `git add -- <dir>`, not `git add --intent-to-add`.** `--intent-to-add` records the path but leaves the content
unstaged, so `git status` shows the file as both tracked and modified and a `git stash` would drop its contents. A
plain `add` stages the two small files the dashboard has just written, whole. They are new, so nothing can be
clobbered: there is no earlier index entry or HEAD version to overwrite.

**D2 — the invocation lives in `createChange.ts`, with its own private runner.** Not in `git.ts`: that module's
contract is "nothing here ever mutates a repository", and weakening it would put a writing command one import away from
the scanner. `worktree.ts` and `pull.ts` already set this precedent — a writing module owns its own `git()`. The runner
sets `GIT_TERMINAL_PROMPT=0` and `GIT_OPTIONAL_LOCKS=0` (the spec requires the latter of *every* invocation; it does not
stop the intentional index write), passes `stdin: "ignore"`, and takes a timeout like `git.ts` does.

**D3 — the path goes after `--`, and it is the directory, not a glob.** `git add -- openspec/changes/<name>/` with
`cwd` set to the repository root. The name is already `CHANGE_NAME`-validated before the directory is created, so it
cannot be an option, escape the changes directory or expand; the `--` makes that structural rather than incidental.
Passing the directory (not `.`, not `-A`) is what keeps a user's unrelated dirty files out of the index — the scenario
the spec makes explicit.

**D4 — best-effort, reported, never fatal.** Once the files exist, the "a failed request leaves the repository
byte-for-byte unchanged" promise can no longer be kept by unwinding: deleting a just-created change because git was
busy would be a worse outcome than an untracked one. So a non-zero exit, a missing git, a non-git repository, a locked
index or a timeout all resolve to `staged: false` and a `201`. `CreateChangeResult` gains `staged: boolean`; the route
returns `{ name, staged }`. Alternatives rejected: failing the request (destroys the user's work for a recoverable
condition), and staying silent (the API contract and the tests need to distinguish the two outcomes).

**D5 — no `isGitRepo` pre-check.** A repository that is not a git repository makes `git add` exit non-zero, which D4
already handles. A separate probe would double the process count on every create for no new information.

**D6 — the rescan is unaffected.** Staging changes `.git/index`, not the working tree, and the scanner derives
everything from files on disk, so `state.scanner.trigger()` keeps its current meaning and ordering. The dirty-file
detection in `src/server/source.ts` uses `git status --porcelain --untracked-files=all`, which reports a staged new
file as `A ` instead of `??` — still a difference from HEAD, so the change still reads as locally edited, as it should.

## Risks / Trade-offs

- **The index is shared state; a user or agent mid-`git add -p` in that repository could be surprised by a new staged
  path.** → The scope is one directory that did not exist a moment ago and that the user just asked for, nothing is
  ever unstaged or overwritten, and a `git reset -- <dir>` undoes it entirely. The alternative — leaving it untracked —
  surprises the user later and more expensively.
- **A partially staged create: `.openspec.yaml` staged, `prompt.md` not.** → One invocation covering the directory
  makes this an all-or-nothing operation as far as the dashboard is concerned; a git failure mid-add leaves the index
  consistent because git writes it atomically.
- **Invariant 1 is now looser, and looser invariants erode.** → The spec enumerates the subcommand *and* the path
  shape, `git add` is listed as a write rather than folded into the read-only list, and the requirement still forbids
  commit, push, stash, reset and ref changes outright. `test/createChangeApi.test.ts` asserts refused creates run no
  git at all, which is the boundary most at risk of drifting.
- **A repository with a pre-commit-style hook on `add`.** → git runs no hook for `add`; there is nothing to disable.

## Migration Plan

No migration. The change is additive at the API (`staged` joins the `201` body, existing clients ignore it) and
invisible in the UI. Changes created before this ships stay untracked; nothing retroactively stages them. Rolling back
is deleting the invocation — an already-staged change is a normal staged directory and needs no cleanup.
