# Proposal

## Why

**Integrate** — and **New project**, which hands its folder to the same integration session — is offered only when the
default agent's profile carries its own `integrate` prompt. Ship and Resolve conflicts do not work that way: they fall
back to an agent-neutral default, so every agent can do them out of the box. Integrate does not, so a profile the user
added themselves, a Claude Code profile saved before the Integrate prompt existed, or one whose prompt was cleared in
Settings leaves both actions inactive with "… has no Integrate prompt configured" — a dead end the user has to fix by
hand before a feature that needs no configuration works at all.

Integrate's prompt names no change and takes no placeholder; there is nothing about it that a profile has to tailor. It
should work by default, exactly like Ship.

## What Changes

- **An agent-neutral default Integrate prompt.** When the default agent's profile has no `integrate` prompt of its own,
  Integrate uses `DEFAULT_INTEGRATE_PROMPT` — the text the Claude Code preset carries today (run `openspec init` in this
  folder, ask which tools to install it for, report what it created), which never mentioned any vendor. It carries no
  placeholder, like every Integrate prompt.
- **"No Integrate prompt" stops being a reason.** Integrate and New project are unavailable only when agent sessions are
  off, no default agent is configured, or its executable was not found (and, for New project, no workspace root or no
  `git`). The `400` "has no Integrate prompt configured" refusals of `POST /api/integrations` and `POST /api/projects`
  go away, since the case cannot occur.
- **Additional Integrate instructions extend the default too**, as additional Ship and Resolve conflicts instructions
  already do: they are appended to the profile's Integrate prompt, or to the default when it has none.
- **The preset no longer carries its own copy.** The Claude Code preset drops its `integrate` prompt and uses the
  default, as it already does for Ship. A saved configuration that carries the old text keeps it — it is the same text,
  so nothing changes for that user — and a configuration with any other Integrate prompt keeps using that one.
- **Settings** shows the default as the Integrate prompt's placeholder and says that empty uses it, instead of "Empty
  means this agent offers no Integrate action".

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `repo-integration`: Integrate uses the profile's `integrate` prompt or an agent-neutral default; "no Integrate prompt"
  is no longer a reason for Integrate to be unavailable.
- `agent-sessions`: Integrate joins Ship (and Resolve conflicts) as an action with a default prompt, so its additional
  instructions extend that default.
- `repo-discovery`: a configuration without an `integrate` prompt still loads unchanged, but now offers Integrate with
  the default prompt; Settings shows that default.
- `dashboard-api`: the integration and create-project endpoints no longer refuse with `400` for a missing Integrate
  prompt.
- `project-creation`: New project is no longer unavailable for a missing Integrate prompt, and that is no longer a
  precondition checked before the folder is created.

## Impact

- `src/shared/types.ts` (`DEFAULT_INTEGRATE_PROMPT`, `integrateUnavailable`), `src/shared/agentDefaults.ts` (preset),
  `src/server/sessions/agents.ts` (`integratePrompt` falls back), `src/server/sessions/manager.ts`,
  `src/server/integration.ts`, `src/server/createProject.ts` (dead `400` branches removed),
  `src/ui/agentSettings.tsx` (placeholder and hints).
- Tests: `test/agents.test.ts`, `test/integration.test.ts`, `test/createProject.test.ts`.
- No new endpoint, no new write, no change to what Integrate is allowed to do: invariant 1 is untouched — the dashboard
  still only starts the agent in the folder and writes nothing there.
