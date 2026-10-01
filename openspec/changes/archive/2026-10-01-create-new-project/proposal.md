# Proposal

## Why

Starting a new project today means leaving the dashboard: create a folder under a workspace root, `git init` it,
run `openspec init`, come back, run discovery and enable it. The dashboard already knows the workspace roots and
already has **Integrate**, which takes a git repository without OpenSpec to a tracked, enabled project — the only
missing piece is the empty git repository itself.

## What Changes

- A **New project** action in the projects overview's header band opens a dialog: the user picks one of the
  configured workspace roots (scan roots), types a folder name and sees the full path that will be created.
- Confirming it makes the dashboard do exactly two things outside `~/.openspec-dashboard/`: create that one new,
  empty folder directly inside the chosen root (an exclusive create — an existing file or folder of that name is
  refused, never reused), and run `git init` in it. Nothing else is written; no commit is made, no remote is added.
- The dashboard then starts an **integration session** in the new folder, exactly as **Integrate** does: the default
  agent with its `integrate` prompt runs `openspec init` under its own permission prompts. The existing marker check
  (`openspec/config.yaml` on disk) adds the project to the configuration with `enabled: true` and starts a scan, so it
  appears on the board. The agent's terminal is open, so the user can go on telling it what to build.
- Everything that would leave a half-made project is checked **before** the folder is created: agent sessions on, the
  default agent has an `integrate` prompt and its executable is found, `git` is found, the root is a configured,
  existing directory that is not inside a tracked repository, the name is a valid folder name, and the target lies
  under no ignore path. When the action is unavailable, the button says why.
- `POST /api/projects` with `{ root, name }` — a mutating, same-origin-guarded route — creates the project and returns
  its path and the integration session.
- The "never writes" requirement and invariant 1 gain one enumerated exception: creating a new project folder under a
  workspace root and `git init` in it, only on the user's confirmation, never in or below a tracked repository.

## Capabilities

### New Capabilities
- `project-creation`: the **New project** action — where it is offered, which roots and names it accepts, what the
  dashboard creates (one folder and `git init`), the checks made before anything is written, and the hand-off to an
  integration session.

### Modified Capabilities
- `dashboard-api`: the new `POST /api/projects` endpoint, and the "never writes" requirement gains the project folder
  creation and `git init` as an enumerated write and git subcommand.
- `project-overview`: the overview's header band holds **New project** next to **Pull all**.

## Impact

- New `src/server/createProject.ts` (validation, exclusive `mkdir`, `git init`, hand-off to the session manager's
  `openIntegration`); route in `src/server/api.ts`.
- `src/shared/types.ts` (request/response types, a shared `newProjectUnavailable` reason helper, folder-name pattern).
- UI: new `src/ui/newProject.tsx` dialog, `src/ui/overview.tsx` band action, `src/ui/empty.tsx` empty-state action
  (`src/ui/styles.css` centres it), `src/ui/api.ts` client call and its refusing stand-in in `src/ui/demo/demoApi.ts`;
  the dialog opens the existing integration overlay (`src/ui/integrate.tsx`) on success.
- Tests: new `test/createProject.test.ts` (temp roots, fake agent, refusals create nothing, tracked-repo refusal,
  existing-name refusal, cross-site refusal) and `test/newProjectUi.test.ts` (button states, empty-state placement).
- `CLAUDE.md` invariant 1 and `README.md` describe the new write.
- No new dependencies; no network.
