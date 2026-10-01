# Design

## Context

**Integrate** (`src/server/integration.ts`, `SessionManager.openIntegration`) already takes a git repository without
OpenSpec to a tracked project: the default agent runs `openspec init` in place, and `confirmIntegration` adds the
repository once `openspec/config.yaml` is on disk (on session end and on every discovery run, via
`confirmPendingIntegrations`). What a new project lacks is only the folder and its `.git`. Invariant 1 forbids the
dashboard from writing outside `~/.openspec-dashboard/` except at enumerated places, and allows only enumerated git
subcommands; the specs in this change add one entry for this.

## Goals / Non-Goals

**Goals:**
- One server module owns the new write, with every check done before `mkdir`.
- Reuse the integration session, its overlay and its marker confirmation unchanged.

**Non-Goals:**
- Templates, a first commit, a remote, a README or any scaffolding by the dashboard.
- Creating a project outside a configured workspace root, or nested deeper than one level inside it.
- A separate "new project" prompt; the `integrate` prompt is used as is (a later change can add one).
- Deleting a folder whose `git init` failed.

## Decisions

### The dashboard runs `git init`; the agent runs `openspec init`

`git init` is local, deterministic and needs no choices, and without `.git` the folder is not integratable — so the
dashboard does it. `openspec init` asks which tools to install for, and the repo-integration spec forbids the dashboard
from running it; it stays with the agent, exactly as for Integrate.

*Alternatives:* the dashboard writing `openspec/config.yaml` itself (skips the tool-specific skills `openspec init`
installs, and duplicates CLI behaviour the adapter does not own); letting the agent also run `git init` (the folder
would not be a git repository when the session starts, so the existing integratable checks, the in-place session and
the "Integrate later" fallback would not hold).

### `src/server/createProject.ts` and `POST /api/projects`

`createProject(state, { root, name })`:
1. Precondition checks, in this order, each throwing a `SessionError`-style status + reason: sessions enabled (403);
   name matches `PROJECT_NAME` (400); `integrateUnavailable` (400 for no prompt, 503 for agent not found — reuse the
   same mapping as `startIntegration`); `Bun.which("git")` (503); `root` canonicalised and equal to a canonical saved
   scan root, `stat` is a directory (404); target `join(root, name)` — `lstat` must fail with `ENOENT` (409), not equal
   to or below any canonical tracked repo path, ignore path or the dashboard home (409; the root check covers a root
   that is itself inside a repo).
2. `mkdir(target)` non-recursive — fails with `EEXIST` if it appeared meanwhile, which is the exclusive create
   (mapped to 409).
3. `git init --quiet` with its own runner in `createProject.ts` (`git.ts` is read-only by contract, as for
   `createChange.ts`'s `git add`), cwd `target`, `GIT_OPTIONAL_LOCKS=0`, `GIT_DIR`-style variables dropped, no shell. Failure → 500 with
   the masked stderr and the path; nothing removed, no agent started.
4. `sessions.openIntegration(canonicalPath(target))` and return `{ path, session }`.

`PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/` plus an explicit `.git` suffix refusal lives in
`src/shared/types.ts` so the dialog validates as the user types with the same rule. A shared
`newProjectUnavailable(config, agents)` returns the button's reason: no scan roots, else `integrateUnavailable`.

`openIntegration` is called directly rather than through `startIntegration`, which re-walks discovery to prove the
folder integratable; we just made it and checked its location, and a full discovery walk on every create is wasteful.
Marker confirmation is unchanged: `confirmPendingIntegrations` picks the session's folder up like any other.

The route is added under the existing non-GET guard (`crossSiteRefusal`) in `src/server/api.ts`, next to
`/api/integrations`.

### UI

`src/ui/newProject.tsx` — a modal (existing `modal.tsx`) with a root `<select>` (preselected when one root), a name
input with live validation, the resulting path shown, and **Create**. On `201` it closes and calls
`ui.showIntegration(session.id)`, so the existing `IntegrationOverlay` shows the agent's terminal. Errors stay in the
dialog. The button sits in the overview band's actions next to **Pull all** and in `empty.tsx`, disabled with
`newProjectUnavailable` as its `title` and `aria-label` suffix.

## Risks / Trade-offs

- [The dashboard now writes outside its home] → Only on confirmation, one directory directly in a configured root,
  exclusive create, refused in/below tracked repos, ignore paths and the home; specs, CLAUDE.md invariant 1 and the
  test suite enumerate it.
- [`git init` honours the user's `init.templateDir`, which can copy hooks] → Accepted: it is the user's own git
  configuration, the same a manual `git init` would apply; the dashboard runs no hook-triggering command afterwards.
- [Agent exits before `openspec init`] → The folder stays a git repository and shows up as integratable; Integrate
  finishes the job.
- [A `git init` failure leaves an empty-ish folder] → Reported with its path; the user decides. Deleting is
  deliberately not added to the write list.
