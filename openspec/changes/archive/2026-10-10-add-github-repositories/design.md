# Design

## Context

Built on `wizard-system-check-first`: the System check runs before the Workspace step, so git and the GitHub CLI
are checked before anything is cloned.


Everything the dashboard tracks is a folder found under a workspace root (`src/server/discover.ts`) or made there by
**New project** (`src/server/createProject.ts`, which already owns the folder-name and placement checks: configured
root, single segment, not existing, not in a tracked repository, ignore path or the home, exclusive `mkdir`). A tracked
repository is `{ id, path, name, enabled, … }`; scans, worktrees, pull, auto fetch, pull requests and issues key off
`path` and the repository's own `origin`. `gh` runs only through `runGh` in `src/server/gh.ts`; git's network commands
share the pull module's environment (`GIT_TERMINAL_PROMPT=0`, batch SSH, hooks off, `maskCredentials`). Bun.serve runs
with its default idle timeout, so a request that waits minutes for git would be cut off. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- A clone is just a folder under a workspace root: no new config field, no special folder, no special discovery path.
- Every user ends setup with a workspace root, so cloning and New project always have a place to put things.
- New writes and network accesses are few, enumerated, and only on the user's action.

**Non-Goals:**
- Hosts other than github.com; SSH clone URLs; shallow or partial clones; submodules; forks' `upstream` remotes.
- Deleting a clone, or cloning a missing tracked repository again (it is an ordinary folder; the user re-adds it).
- Fast-forwarding a clone's main checkout automatically — auto fetch and **Pull** / **Pull all** apply as to any
  repository.
- **Create folder** outside the setup wizard (Settings keeps typed roots only; can follow later on the same endpoint).

## Decisions

### D1. Clone into `<workspace root>/<folder>`, reusing New project's placement checks
Extract from `createProject.ts` a `checkNewFolder(config, root, name)` (root configured and a directory, name rules,
target absent in any form, not in a tracked repository / ignore path / home) and the exclusive `mkdir`; New project and
the clone both call it. Alternative considered and dropped: a managed folder under `~/.spec-control/clones/` — it needed
path-based recognition, a discovery special case and "Clone again", and made clones a second kind of project.

### D2. `git clone` over HTTPS into the pre-created empty folder, not `gh repo clone`
`mkdir` (exclusive) first gives the race guard and the "nothing reused" rule; git clones into an existing empty
directory. Command: `git -c core.hooksPath=<empty dir under the home> -c maintenance.auto=false -c gc.auto=0 clone
--no-recurse-submodules --origin origin -- https://github.com/<owner>/<name>.git <target>`, `GIT_TERMINAL_PROMPT=0`,
`GIT_OPTIONAL_LOCKS=0`, batch SSH, no stdin, cwd in the home, killed after 10 minutes. On failure git removes what it
wrote inside an existing directory; the dashboard then `rmdir`s the target (non-recursive, so it only succeeds when it
is empty) and otherwise reports the path. `gh repo clone` was rejected: it keeps `gh` read-only only if we never use it,
picks a protocol from gh's config and adds an `upstream` remote for forks. Private repositories need git credentials for
github.com; the reason points to `gh auth setup-git`, which agents also need to push over HTTPS. A full clone, because
a partial one would fetch blobs lazily during scans.

### D3. Background clone jobs, polled
`POST /api/github/clone` validates, creates the folder, starts git and returns `202`; `GET /api/github/clones`
returns the in-memory job list. One `githubClonesState` in the UI polls it every second while any job is `cloning` and
stops otherwise; the dialog, the wizard and the overview's Unmanaged projects all read it. Jobs survive closing the
dialog and reloading the page, are dropped on restart (not history; invariant 5). A semaphore limits clones to two.
Discovery receives the set of running target paths and leaves them out (a half-written `.git` would read as
integratable).

### D4. Tracking after a clone reuses the track path
On success, when `detectFramework(target)` finds the marker, the job adds the repository through the same serialized
config mutation as `POST /api/repos/track` (default name with `<basename> (<parent>)` disambiguation, scan trigger).
Otherwise the config is untouched and the next discovery lists it as integratable — no extra state.

### D5. Workspace folder creation in setup
`POST /api/setup/workspace-folder` in `src/server/setup.ts`: `expandPath`, parent `stat` is a directory, placement
checks shared with D1 (tracked repository, ignore path, home), `mkdir` without `recursive` (EEXIST → 409). It does not
touch the config: the wizard's Continue calls it for each marked root, then saves the config as today, so a refused
creation saves nothing. The wizard's Continue order is: create folders → save roots → track checked projects → start
clones → wait on the job list.

### D6. `gh repo list`
`gh repo list [<owner>] --limit 200 --json nameWithOwner,description,isPrivate,isArchived,pushedAt` through `runGh`;
the owner is validated (`src/shared/github.ts`) and passed as one argument. Without an owner, `gh api user --jq .login`
(an allowed subcommand) names the default owner. `added` comes from configured repositories' `origin` through
`githubRepoFromRemote`. Not cached server-side.

### D7. Parsing shared by server and UI
`src/shared/github.ts` parses and validates typed input to `owner/name` and derives the default folder name, so the
dialog shows refusals instantly and the server re-checks every request with the same code.

### D8. UI
`src/ui/addGithub.tsx` has two modes: `clone` (overview: Clone starts jobs) and `collect` (wizard: returns the selection
with root and folder name to the Workspace step). The overview band and empty state gain **Add from GitHub**;
`untracked.tsx` gains `Cloning…` / `clone failed` entries (Retry, Dismiss). The wizard's Workspace step gains
**Create folder** for missing roots, the `~/Workspace` proposal, the GitHub list and the "a workspace folder is needed"
rule for Continue.

### D9. Demo
`src/ui/demo/demoApi.ts` implements the listing, clone, clone list, dismiss and workspace-folder operations in memory
with fictional repositories, as the demo spec requires; the API interface makes them mandatory.

## Risks / Trade-offs

- [Large repositories take long and fill the user's workspace] → 10-minute timeout, `Cloning…` shown, the folder is the
  user's like any other checkout.
- [Private repositories fail without git credentials] → the reason names `gh auth setup-git`; nothing retries by itself.
- [A failed clone leaves a non-empty folder] → only if git itself did not clean up; the dashboard reports the path and
  never deletes recursively.
- [Requiring a root in the wizard] → Skip setup stays; existing users with roots are unaffected; a GitHub-only user is
  offered `~/Workspace` with one click.
- [Invariants grow] → one new git subcommand (`clone`), one new `gh` subcommand (`repo list`), two new folder creations
  outside the home, all written into `CLAUDE.md` invariants 1 and 4 and the dashboard-api "never writes" requirement in
  this change, with tests that scans, discovery and listings start no clone.

## Migration Plan

Additive; no configuration migration. Rollback: an older binary sees a cloned repository as any repository under a
root.
