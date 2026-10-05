# Proposal

## Why

Ship asks the agent to open a pull request, but the dashboard has no way to say how that pull request must be titled.
The default Ship prompt hard-codes "a Conventional Commit message" for every repository — too strict for projects that
do not use the convention, and too vague for projects that enforce it on pull request titles (this repository's own CI
rejects a title like `update stuff`). A project should be able to declare that its pull request titles follow
Conventional Commits, so that every Ship for it asks for exactly that.

## What Changes

- A managed project gains a per-project setting **PR titles** on the projects overview (row and tile), beside Agent
  and Labels: **No convention** (the default) or **Conventional Commits**. It takes effect when changed, like the other
  per-project settings, and is stored in the dashboard's configuration as the repository entry's
  `prTitleConvention: "conventional-commits"`; absent means no convention. Nothing is written to the repository.
- A new endpoint `POST /api/repos/<id>/pr-title-convention` with `{ convention: "conventional-commits" | null }` sets
  or clears it, under the same rules as the other per-repository settings endpoints (validated, atomic, same-origin,
  no scan).
- **Ship** composes its prompt from the repository's convention: for a project with Conventional Commits, a fixed
  sentence asking for a pull request title of the form `<type>(<scope>): <summary>` (and commit messages in the same
  form) is appended to the Ship prompt — the profile's own or the default — before the profile's additional Ship
  instructions. It applies whether Ship is typed into a running session or starts an ended one.
- The agent-neutral default Ship prompt no longer prescribes Conventional Commits; it asks for commit messages that
  follow the repository's own conventions. Projects that want Conventional Commits switch the setting on. This is a
  change in the default prompt text, not in any API or stored format.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `agent-sessions`: the Ship requirement's default prompt becomes convention-neutral, and a new requirement defines the
  per-repository pull request title convention and how it extends the Ship prompt.
- `project-overview`: "Each managed project carries its own settings on the overview" gains the **PR titles** setting.
- `dashboard-api`: "Per-repository settings endpoints" gains `POST /api/repos/<id>/pr-title-convention`.

## Impact

- `src/shared/types.ts` — `RepoConfig.prTitleConvention`, a `PrTitleConvention` type, the reworded
  `DEFAULT_SHIP_PROMPT`. (`add-validate-phase` also edits this file, in other declarations.)
- `src/server/config.ts` — the repository entry schema accepts the field; unknown values are refused.
- `src/server/sessions/agents.ts` — `shipPrompt` takes the repository's convention.
  `src/server/sessions/manager.ts` — `ship()` passes it.
- `src/server/api.ts` — the new route in the per-repository settings dispatcher.
- `src/ui/projectSettings.tsx`, `src/ui/api.ts`, `src/ui/styles.css` — the picker and its request;
  `src/ui/demo/demoApi.ts` — the demo answers the new request.
- `src/ui/changelog.ts` — a What's new entry.
- `test/` — `agents.test.ts`, `config.test.ts`, `api.test.ts` (or `trackingApi.test.ts`), `projectSettingsUi.test.ts`,
  `demoApi.test.ts`, and the Ship tests that assert on the default prompt.
- No new dependency, no network, no change to invariant 1: the setting lives in `~/.openspec-dashboard/`, and the
  dashboard still commits, pushes and titles nothing itself.

## Non-goals

- Checking or flagging pull request titles in the Pull requests view, on cards or in the pull-request dialog.
- Conventions other than Conventional Commits, or a configurable type/scope list. The setting is an enum so that one
  can be added later without a migration.
- A global default in Settings, or storing the convention in `openspec/config.yaml` (shared-config profiles already
  cover free-text conventions for artifacts).
- Applying the convention to Resolve conflicts, the session starters or Integrate.
