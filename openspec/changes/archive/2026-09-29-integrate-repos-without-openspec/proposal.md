# Proposal

## Why

The dashboard can only ever show a project that already has OpenSpec. Discovery reports a directory only when it holds
`openspec/config.yaml` (`MARKERS` in `src/server/discover.ts`), so a repository the user would like to plan in is
invisible until they leave the dashboard, find the checkout, run `openspec init`, answer its questions, come back and
press Rediscover. That is the whole onboarding path for every new project, and none of it happens where the user is.

The repositories are right there under the configured scan roots. The dashboard already walks past them — it descends
through them looking for the marker and reports nothing. Showing them, and offering to set them up, turns adopting
OpenSpec in a project from a context switch into one action on the page the user is already on.

## What Changes

- **Discovery reports a second kind of result.** Alongside today's candidates, the walk reports **integratable**
  repositories: a directory with its own `.git` directory and no `openspec/config.yaml`. Linked worktrees are excluded
  as they already are. A directory that holds an OpenSpec project anywhere below it is not offered — it is a container,
  not a project waiting to be set up. Today's candidate list is byte-for-byte what it is now; this is purely additive.
- **Settings lists them separately**, under the existing candidates, each with its path, the same distinguishing name
  hint and Ignore action the candidates have, and an **Integrate** action.
- **Integrate starts an agent session in the folder.** The dashboard starts the repository's default agent with an
  Integrate prompt that asks it to run `openspec init` there and report what it created. The dashboard itself writes
  nothing: this needs **no new exception to invariant 1** — "starting the user's agent … is not a write by the
  dashboard" already covers it, and the agent's own permission prompts govern what it touches.
- **The session runs in place, in the main checkout** — no worktree and no branch, because the point is to set up the
  repository the user actually works in, and scaffolding stranded on a throwaway branch would leave discovery blind
  until someone merged it. This extends the existing in-place session rule, which today covers only folders without
  git, to a git repository for this one action. It is the one thing here that deserves a second look: the panel says
  plainly that the agent edits the checkout directly, with no branch and no undo, in the same words the existing
  in-place panel uses.
- **Integration is finished by the marker, not by the agent's word.** When `openspec/config.yaml` appears in the
  folder — re-checked when the integration session ends and on every discovery run — the repository is added to the
  config with `enabled: true` and its default name, and a scan starts, so the project appears on the board. If the
  marker never appears the folder stays an integratable repository and the session's outcome is shown; nothing is
  added on the agent's claim alone.
- **The agent profile gains an `integrate` prompt.** Unlike every other prompt it carries **no placeholder**: the
  folder is the agent's working directory, so no text from the browser reaches the command line at all. The
  preconfigured Claude Code profile ships one; a profile without one shows **Integrate** disabled with the reason.
- With agent sessions off, integratable repositories are still listed, with **Integrate** disabled and the reason
  given — the list is useful on its own, and the setting is where the user turns it on.
- New `GET /api/integratable` (part of the discovery response) and `POST /api/integrations` (start one), under the
  same-origin guard.
- The demo lists an integratable repository and simulates integrating it.

## Capabilities

### New Capabilities
- `repo-integration`: what an integratable repository is, what **Integrate** starts, that the session runs in place in
  the main checkout, how integration is confirmed by the marker, and what it never does.

### Modified Capabilities
- `repo-discovery`: "Discovery finds OpenSpec-enabled repositories under configured roots" also reports integratable
  repositories; "Tracking is opt-in per repository" gains the one way a repository is added without the user pressing
  Enable — a confirmed integration the user started; "Settings view exposes discovery and configuration" lists them
  with **Integrate** and Ignore; "Agent session settings are part of the configuration" and "Settings expose agent
  sessions with their risks stated" gain the `integrate` prompt and its no-placeholder rule.
- `agent-sessions`: "Every session works in its own git worktree, created by the dashboard" gains the integration
  session as the second in-place case, and the only one in a git repository.
- `dashboard-api`: new integration endpoints. **"The dashboard never writes to tracked repositories" is deliberately
  not modified** — nothing here writes to a repository, and four in-flight changes already contend for that
  requirement.

## Impact

- `src/server/discover.ts` — the walk also collects git repositories without the marker, and drops any that contain an
  OpenSpec project; `findOpenSpecRepos` returns both lists.
- `src/server/integration.ts` (new) — eligibility, starting the session, and the marker re-check that enables the
  repository; the only module that turns an integration into a config entry.
- `src/shared/types.ts` — `IntegratableRepo`, `IntegrationSession` as a third session kind next to `ChangeSession` and
  `ConsoleSession`, `integrate` in `PromptKey`, `DiscoverResult.integratable`.
- `src/server/sessions/manager.ts` — starting a session whose working directory is a folder rather than a change's
  worktree; `src/server/sessions/store.ts` — the new record shape.
- `src/server/api.ts` — the integration routes; `src/server/config.ts` — adding the integrated repository.
- `src/shared/agentDefaults.ts` — the preconfigured Integrate prompt; prompt validation exempts it from `{change}`
  exactly as `ship` is exempted.
- `src/ui/settings*.tsx`, `src/ui/api.ts`, `src/ui/styles.css` — the list, the action, the disabled reasons.
- `src/ui/demo/` — a simulated integratable repository.
- `test/` — `discover.test.ts` (integratable detection, containers, linked worktrees, today's results unchanged),
  a new `integration.test.ts`, `sharedConfigApi`-style API tests, `config.test.ts`, `sessionPrompt.test.ts`,
  `settingsSections.test.ts`, demo tests.
- `README.md`, `CLAUDE.md` (the agent-sessions section: the second in-place case).
- `demo-site`: covered by a new requirement rather than a modification, because `add-validate-phase` is in flight
  against "Agent sessions are enabled and simulated in the demo" and two deltas must not contend for one block.
- No new dependency. No network. No new write by the dashboard to any repository.

## Non-goals

- The dashboard running `openspec init` itself, in process or as a subprocess. `InitCommand` is interactive, resolves
  its templates through `createRequire(import.meta.url)` — which invariant 3 says does not exist in the compiled
  binary — writes tool files outside `openspec/`, and performs a "legacy cleanup" that deletes files. Handing it to
  the user's agent keeps every one of those decisions where the user can see and approve it.
- Choosing which tools OpenSpec installs for, or passing flags to `init`. The agent asks the user; the prompt is an
  editable template for anyone who wants it decided up front.
- Integrating a folder that is not a git repository, or one outside the configured scan roots.
- Undoing an integration. What the agent wrote is in the user's checkout, unstaged and uncommitted, for them to review.
