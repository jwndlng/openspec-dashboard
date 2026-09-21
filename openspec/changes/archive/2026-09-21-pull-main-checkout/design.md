## Context

The dashboard reads repositories; its few writes are enumerated in the `dashboard-api` requirement "The dashboard never writes to tracked repositories": the managed sections of `openspec/config.yaml`, and creating/removing a session's worktree. The same requirement says it MUST NOT change the main checkout's branch, index or working tree and MUST NOT contact a remote, and `CLAUDE.md` repeats both (invariants 1 and 4). Git is run through small wrappers (`src/server/git.ts` for read-only calls, `src/server/sessions/worktree.ts` for the session worktree commands) that spawn `git` without a shell from an argument array, with `GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`, stdin ignored and a timeout. Mutating API routes sit behind `crossSiteRefusal`.

Because nothing fetches, several things the UI shows are only as current as the user's last manual `git fetch`/`git pull`: archived changes and main specs (read from the main checkout), the `merged` work status and ahead/behind of session worktrees, and "open" changes that were in fact archived remotely. The scanner records `currentBranch` per repository but not which branch is the default, so a main checkout parked on a feature or release branch silently decides which archives and specs are shown. The session code already determines the default branch with `git symbolic-ref --short refs/remotes/origin/HEAD`.

A scratch spike against a local bare remote established the behaviour this design relies on: `for-each-ref --format='%(upstream:short) %(upstream:remotename) %(upstream:track)'` yields upstream, remote name and ahead/behind with an already allowed subcommand; `git merge --ff-only @{u}` keeps uncommitted edits to files the update does not touch, refuses — changing nothing — when an edited file would be overwritten, and refuses diverged branches; and a plain merge **runs the repository's `post-merge` hook**, while `-c core.hooksPath=/dev/null` prevents that.

## Goals / Non-Goals

**Goals:**
- One click brings a repository's main checkout up to date when that is unambiguous and safe, and refreshes what the dashboard knows about the remote when it is not.
- Never lose, rewrite or reorder anything of the user's: no merge commits, no rebase, no stash, no reset, no branch switch, no force.
- No network access except on that click.
- Say clearly when a repository's data comes from a non-default branch.

**Non-Goals:**
- Fetching or updating linked worktrees; pushing; switching the main checkout to its default branch; resolving divergence.
- Scheduled or automatic fetching, "N behind" badges that would need it.
- Any handling of credentials, tokens, SSH keys or host verification.
- Running repository hooks.
- Pruning remote-tracking branches beyond what the user's own git config does.

## Decisions

### D1: Fetch, then fast-forward only — two steps, reported separately
`pullRepository(repo)` in a new `src/server/pull.ts`:

1. **Inspect (read-only):** current branch (`symbolic-ref --short HEAD`; detached → no branch), its upstream and remote (`for-each-ref` as above), the default branch (D5). No upstream and no remote at all → result `no-remote`, nothing is run.
2. **Fetch:** `git -c gc.auto=0 -c maintenance.auto=false fetch --no-recurse-submodules --quiet <remote>`, where `<remote>` is the upstream's remote, or `origin` when the branch has no upstream but the remote exists. Only remote-tracking refs, `FETCH_HEAD` and objects change. Auto-maintenance is switched off so a click never turns into a repack; submodules are left alone.
3. **Fast-forward**, only if the checkout is on the default branch, has an upstream and is behind it: `git -c core.hooksPath=/dev/null merge --ff-only --quiet <upstream>`. Git's own refusal (overlapping local changes, divergence) is passed on; nothing was changed when it refuses.

The result is `{ fetched: boolean, update: "fast-forwarded" | "up-to-date" | "skipped" | "refused" | "failed", commits?: number, reason?: string, branch?, upstream?, defaultBranch? }`. Splitting the steps is the point: the fetch is always safe and already makes `merged` and ahead/behind current; the update is the part that needs conditions.

*Alternatives considered:* `git pull --ff-only` — one command, but it hides which half failed, runs hooks, and honours `pull.rebase`-style configuration in ways that vary by git version. `fetch` + `reset --hard` / `rebase` / autostash — each can destroy or rewrite the user's work. A "Copy pull command" button — keeps the dashboard off the network and stays available as a fallback, but it does not solve the dozen-terminals problem the change exists for.

### D2: When the update step is skipped or refused
| Situation | Fetch | Update | Reason shown |
|---|---|---|---|
| on default branch, behind, clean or non-overlapping edits | yes | fast-forwarded N commits | — |
| on default branch, not behind | yes | up-to-date | — |
| not on the default branch (or detached) | yes | skipped | "on `<branch>`, not `<default>`; only fetched" |
| no upstream configured | yes (origin) | skipped | "`<branch>` has no upstream" |
| ahead and behind (diverged) | yes | refused | "local and remote have diverged" |
| local edits the update would overwrite | yes | refused | git's message, naming the files |
| no remote | no | skipped | "no remote configured" |
| fetch fails (offline, auth, unknown host) | failed | skipped | git's last error line |

Not updating a non-default branch is deliberate: a feature branch checked out in the main checkout is somebody's work in progress, and fast-forwarding it under them is a surprise even when it is technically safe.

### D3: Credentials and prompts stay with git; nothing can hang
The child gets the server's environment plus `GIT_TERMINAL_PROMPT=0` (already standard), stdin ignored, and — unless the user has set `GIT_SSH_COMMAND` themselves — `GIT_SSH_COMMAND="ssh -o BatchMode=yes"`, so SSH fails instead of asking for a passphrase or host-key confirmation on the terminal the dashboard was started from. Credential helpers and SSH agents keep working because they are git's, not ours. The fetch has its own timeout (60 s), after which the process is killed and the result is `failed: timed out`. Output is captured, never streamed to the browser unfiltered: only the final reason line(s) are returned, with any URL credentials (`https://user:token@…`) masked.

### D4: One at a time, only for repositories the dashboard tracks
`POST /api/repos/<id>/pull` accepts only ids of enabled repositories whose last scan succeeded and that are git repositories; the path comes from the config, never from the request. A per-repository in-memory lock answers a second request with `409 already pulling`. `POST /api/pull` ("Pull all") runs the same function over all such repositories with concurrency 3 and returns the per-repository results; a failure in one does not stop the others. Both sit behind `crossSiteRefusal` like every mutating route. After each pull the repository is rescanned (the existing trigger), so the snapshot the UI re-fetches reflects it.

Session worktrees are never touched, but their work statuses are recomputed on the next read and become current — the largest practical benefit.

### D5: Default branch and the notice
`RepoSource.defaultBranch()`: `symbolic-ref --quiet --short refs/remotes/origin/HEAD` with the `origin/` prefix removed; if that ref does not exist, `main` if a local branch `main` exists, else `master` if it exists, else undefined (`show-ref --verify`, already allowed). The scanner stores `defaultBranch` and `onDefaultBranch` (`currentBranch === defaultBranch`; false when detached; undefined when no default could be determined) on `RepoSnapshot`. Both optional, so older cached snapshots load.

The UI shows the notice when `onDefaultBranch === false`: a warning badge in the Projects row (`⎇ on <branch>, not <default>`) and a notice line in the repository header: "This checkout is on `<branch>`, not `<default>`. Archived changes, specs and progress shown for this repository come from that branch and may be outdated. Changes that live in worktrees are read from their own checkouts and are not affected." Text plus colour, no data hidden. When the default branch is unknown, nothing is claimed and nothing is shown.

### D6: UI
A `Pull` button in the repository header and a compact one per Projects row (git repositories only), showing a spinner while running and then the outcome as a badge with the reason as tooltip: `up to date`, `+N commits`, `fetched only`, `refused`, `failed`. `Pull all` sits in the Projects toolbar and opens a small result list. Results live in UI state only; a reload forgets them. Clicking a row's button does not navigate into the repository.

The demo implements both operations in memory: a latency, then canned outcomes derived from the sample (fast-forward for most, `fetched only` for the two sample repositories that sit on a feature and a release branch, `failed` for the one whose scan failed is not offered at all). No network is touched; the existing demo test for "no non-local requests" style guarantees stays meaningful because the mock never calls `fetch`.

### D7: The invariant, reworded once
The "never writes" requirement gets a third enumerated exception and its two absolute sentences are scoped: the dashboard MUST NOT contact a remote or change the main checkout *except* through the pull action, on an explicit user request, as specified in `repository-pull`. `CLAUDE.md` invariant 1 lists it as the third entry; invariant 4 is clarified to say what it always meant for the UI (no CDN, fonts or fetches to other hosts) and that the server reaches a git remote only through this action. A test proves the negative: with a repository whose remote is a path that records access, a full scan, a poll cycle, work-status reads and page-load API calls leave the remote untouched.

## Risks / Trade-offs

- [First network access in a product whose pitch is "local-first, no network"] → Only on click, only through git, enumerated in spec and `CLAUDE.md`, proven absent elsewhere by a test, and absent from the demo.
- [Repository hooks would run from a browser click] → `core.hooksPath=/dev/null` for the merge; the result notes "hooks were not run" when a `post-merge` hook exists, so a user relying on one (dependency install) knows to run it.
- [SSH prompt on the server's terminal hangs the request] → `BatchMode=yes` unless the user overrides `GIT_SSH_COMMAND`, plus the timeout. A user with a custom `core.sshCommand` in git config keeps it (we do not read git config), and the timeout is the backstop.
- [Fast-forward changes files under a running editor or dev server] → It is what `git pull` does; only on the default branch, only fast-forward, only on click.
- [Error output may contain a URL with embedded credentials] → Masked before it leaves the server; covered by a test.
- [`Pull all` on many repositories over a slow link] → Concurrency 3, per-fetch timeout, independent results.
- [Three other in-flight changes rewrite the same requirement] → This delta is written against main's current text; whichever archives later rebases (the archive tool refuses silently dropped scenarios, so it cannot be missed).

## Migration Plan

Additive. No setting: the button exists for git repositories and does nothing until clicked. Rollback is reverting the commit; nothing is persisted.

## Open Questions

- Should the dashboard offer to switch a main checkout back to its default branch when it is clean? Deliberately out of scope here; the notice comes first.
