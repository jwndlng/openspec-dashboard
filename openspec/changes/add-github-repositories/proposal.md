# Proposal

## Why

Spec Control only tracks folders that already exist on this machine under a workspace root. A user who works through
their agents alone — no local checkouts, everything on GitHub — has nothing to point it at, so the setup wizard ends with
an empty overview and agent sessions have no repository to branch a worktree from. Letting the user pick a workspace
folder (or create one) during setup and then clone GitHub repositories into it gives that user a board, and keeps every
project — cloned, created or found — the same kind of thing: a folder under a workspace root.

## What Changes

- The setup wizard's **Workspace** step makes the user **choose a workspace folder or create a new one**: a typed path
  that does not exist yet is offered **Create folder** (default suggestion `~/Workspace` when it does not exist), and
  the folder is created on **Continue** with a single non-recursive `mkdir`. **Continue** needs at least one workspace
  root, configured or entered; **Skip setup** stays available.
- New **Add from GitHub** action on the projects overview (header band and the "No repositories tracked yet" empty
  state) and in the wizard's Workspace step: the user picks repositories from a list of their own GitHub repositories,
  read on request with the read-only `gh repo list`, or types `owner/name` or a `https://github.com/owner/name` URL,
  and chooses the workspace root and folder name (default: the repository's name) — the same rules as **New project**.
- On the user's confirmation the dashboard **clones** each chosen repository with `git clone` over HTTPS into
  `<workspace root>/<folder>`: the folder is created with an exclusive `mkdir` and git clones into it, under the pull
  action's rules (git's own credentials, no prompt, no hooks, a timeout, credentials masked). A failed clone leaves no
  folder behind when git left it empty, and the dashboard deletes nothing else.
- A clone holding `openspec/config.yaml` is **tracked at once**; one without it is what discovery already reports as
  integratable, so it is listed under Unmanaged projects with **Integrate**. From then on it is an ordinary repository
  under a workspace root — scans, auto fetch, Pull, agent sessions, pull requests, issues and cleanup unchanged, and no
  new configuration field.
- Clones run in the background; the overview lists running and failed clones under Unmanaged projects.
- **Invariants**: invariant 1 gains two writes outside tracked repositories, both on the user's confirmation and both
  shaped like New project's folder — the workspace folder made by setup, and the clone's folder with `git clone`, a new
  git subcommand — and invariant 4 gains the clone and `gh repo list`, a third read-only `gh` subcommand. `CLAUDE.md`
  is updated with them.
- The demo simulates the picker, the clone and the folder creation in memory.

## Capabilities

### New Capabilities
- `github-repositories`: adding GitHub repositories by cloning them into a workspace root — the picker and its
  `gh repo list` query, typed entry and its validation, the target folder rules, how the clone is made, what it is
  tracked as, background clones and their outcomes.

### Modified Capabilities
- `setup-wizard`: the Workspace step requires a workspace root, can create a new workspace folder, and adds GitHub
  repositories that are cloned on Continue; the wizard may now create that folder, start `git clone` and `gh repo list`
  and contact GitHub, on the user's action only.
- `repo-discovery`: a confirmed clone that uses OpenSpec is tracked without Enable; a folder being cloned into is not
  reported.
- `project-overview`: **Add from GitHub** in the header band; running and failed clones under Unmanaged projects.
- `dashboard-api`: the GitHub listing and clone endpoints and the workspace-folder endpoint; the "never writes"
  requirement and the network list gain the clone, `git clone`, `gh repo list` and the workspace folder.
- `demo-site`: Add from GitHub and creating a workspace folder are simulated in memory.

## Impact

- New: `src/server/githubClone.ts` (target checks, `mkdir`, `git clone`, background jobs), `src/shared/github.ts`
  (parsing and validation), `src/ui/addGithub.tsx` (dialog shared by the overview and the wizard), tests
  `test/github.test.ts`, `test/githubClone.test.ts`, `test/githubApi.test.ts`.
- Changed: `src/server/createProject.ts` (folder-name and target-path checks shared with the clone),
  `src/server/setup.ts` (create a workspace folder), `src/server/gh.ts` (`gh repo list` through `runGh`),
  `src/server/discover.ts` (skip folders being cloned into), `src/server/api.ts`, `src/shared/types.ts`,
  `src/ui/api.ts`, `src/ui/overview.tsx`, `src/ui/untracked.tsx`, `src/ui/setupWizard.tsx`, `src/ui/setupState.ts`,
  `src/ui/demo/`, `test/fixtures/fake-gh.ts`, `CLAUDE.md` (invariants 1 and 4), `README.md`.
- No new dependency. Tests clone from local bare repositories by redirecting `https://github.com/` with git's own
  `url.<base>.insteadOf` in the test environment; no test uses the network.
- Depends on `wizard-system-check-first` (`depends-on.yaml`), which moves the System check before the Workspace step
  and checks agents in the Agents step; this change's Done-step delta is written against that order.
