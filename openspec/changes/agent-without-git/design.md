# Design

## Context

`SessionManager.start` (`src/server/sessions/manager.ts`) decides `inPlace = scanned.isGit === false`. Every other
change session goes through `ensureWorktree` (`src/server/sessions/worktree.ts`), which creates `feat/<change>` from
`origin/HEAD`, else `HEAD`, and throws `NoCommitError` (409) when that base is `HEAD` and `HEAD^{commit}` does not
verify. A repository made by **New project** is exactly that case, so its first change can never get a session. The
in-place machinery — `Session.inPlace`, no branch, no work status/Ship/pull/worktree removal in the UI
(`sessionState.ts`), the restart path that skips `ensureWorktree` — already exists for folders without git and for the
consoles. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- A change session in a git repository with nothing to branch from starts in place, decided from the scan.
- No new git write and no new git subcommand; invariant 1's list of writes is unchanged.
- One agent per in-place folder, as for folders without git.

**Non-Goals:**
- The dashboard making the first commit, or any commit (it never commits).
- Moving a running or resumed in-place session into a worktree once the first commit exists.
- Orphan-branch worktrees (`git worktree add --orphan`).

## Decisions

### D1 — Run in place rather than an orphan worktree
An orphan worktree would keep isolation, but every parallel session would make its own root commit; merging the second
one needs `--allow-unrelated-histories`, `merge-tree` refuses unrelated histories, and work status, the conflict signal
and Ship all assume a base commit. Running in place reuses a path that is already specified and tested, and matches how
the project console already treats a repository with no commit ("where no worktree can be made"). The user chose this.

### D2 — `RepoSnapshot.noCommit` from the scan, same condition as `NoCommitError`
The scanner computes, for git repositories only, `noCommit = !rev-parse --verify --quiet HEAD^{commit} && !symbolic-ref
--quiet refs/remotes/origin/HEAD` — the same "the branch would be created from an unborn `HEAD`" condition
`ensureWorktree` refuses today, so the scan and the fallback agree. Both subcommands are on the read-only list. A new
`hasCommitToBranchFrom()` (or similar) on `RepoSource`/`LocalRepoSource`, backed by a helper in `git.ts`, keeps the
scanner going through its source abstraction; a failure resolves to "unknown" and the field is omitted. On a failed
scan the previous value is carried like `isGit` (`scanner.ts`, the `prev` fallback). The field is optional and omitted
when false, so cached snapshots and the demo need no change.

Alternative: decide at start time with a git call. Rejected: the spec requires in-place to be decided from the scan,
never by reacting to a git command, and a starter's outcome would then depend on a race with the agent's first commit.

### D3 — `inPlace = !scanned.isGit || scanned.noCommit === true`
One line in `start`. Everything downstream already keys on `session.inPlace`: the restart path skips `ensureWorktree`, so
a resumed in-place session stays in place after the first commit (spec: in place for its whole life). `ensureWorktree`
keeps `NoCommitError` as the safety net for an out-of-date scan, still mapped to 409; its message drops the advice to
make a commit in the project console, since normally the starter no longer gets there — it says the repository has no
commit yet and to refresh.

### D4 — One agent per in-place folder, for any in-place change session
Today `start` refuses only when `!isGit` and the project console runs there. It becomes: when the session would run in
place, `refuseOtherAgentInFolder(repo.path)` — which names a running change, or says the console runs there (the
existing message for the console case is kept). This also closes the same gap for two change sessions in one folder
without git, which the project's "one agent per folder" rule already intends. `openProjectConsole` already calls
`refuseOtherAgentInFolder`, so the other direction needs no change.

### D5 — Panel wording from the repository, not the session
The session record stays as is (`inPlace: true`, no branch). The panel (`sessionPanel.tsx`) and the card row
(`sessions.tsx`) pick the explanation from the repository snapshot they already hold: not a git repository → today's
text; `isGit` (no commit) → "works in the checkout: there is no commit to branch from yet — no branch of its own, no
undo". The help page's in-place sentence gains the second case.

## Risks / Trade-offs

- [The agent works in the user's main checkout with no undo] → Same risk the user already accepts for folders without
  git and for the project console; the panel says it plainly. In a repository with no commit there is no prior history
  to lose.
- [Scan lag after the first commit: the next starter still runs in place until a scan] → Scans follow file changes and
  the poll interval; the starter's result is still correct per the spec (in place is decided from the scan), and the
  user gets a worktree from the next scan on.
- [`origin/HEAD` exists but `HEAD` is unborn] → `noCommit` is false, a worktree is created from `origin/HEAD` exactly as
  today.
- [Stricter one-agent rule for folders without git (D4)] → Intended by the existing rule; reason text names the running
  change so the user knows what to end.
