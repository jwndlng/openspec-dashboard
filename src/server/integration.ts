// Setting a repository up for OpenSpec (repo-integration spec). The dashboard writes nothing in the repository: the
// user's agent runs `openspec init` under its own permission prompts, which invariant 1 already covers ("starting the
// user's agent … is not a write by the dashboard"). All this module decides is *when that worked* — `openspec/config.yaml`
// on disk, never anything the agent printed — and it then tracks the repository, a write to `~/.openspec-dashboard/` only.
import { integrateUnavailable, type Config, type IntegrationSession } from "../shared/types.ts";
import { availableName } from "../shared/nameHints.ts";
import { saveConfig, newRepoConfig } from "./config.ts";
import { discoverRepos, isOpenSpecRepo } from "./discover.ts";
import { canonicalPath } from "./paths.ts";
import { SessionError, type SessionManager } from "./sessions/manager.ts";

/** The part of the app the integration flow needs. `AppState` satisfies it; declared here so there is no import cycle. */
export interface IntegrationState {
  config: Config;
  scanner: { trigger: () => { started: boolean } };
  sessions?: SessionManager;
}

/** Canonical paths discovery currently reports as waiting for OpenSpec. A fresh walk: "currently" is the whole point. */
async function integratablePaths(state: IntegrationState): Promise<Set<string>> {
  const { integratable } = await discoverRepos(state.config.repos, state.config.scanRoots, state.config.ignorePaths);
  return new Set(integratable.map((r) => r.path));
}

/**
 * Starts the default agent in a repository that does not use OpenSpec yet — in place, in its main checkout, with no
 * worktree, no branch and no git command. One integration per folder: while one runs it is returned instead.
 */
export async function startIntegration(state: IntegrationState, input: { path?: unknown }): Promise<{ session: IntegrationSession; created: boolean }> {
  const sessions = state.sessions;
  if (!sessions) throw new SessionError(403, "agent sessions are not available");
  const unavailable = integrateUnavailable(state.config, sessions.agents());
  // The global reasons first: they are what the row already says, and none of them depends on the folder.
  if (unavailable === "agent sessions are disabled") throw new SessionError(403, unavailable);
  if (typeof input.path !== "string" || !input.path.trim()) throw new SessionError(404, NOT_INTEGRATABLE);
  const folder = canonicalPath(input.path);
  if (!(await integratablePaths(state)).has(folder)) throw new SessionError(404, NOT_INTEGRATABLE);
  if (unavailable) throw new SessionError(unavailable.includes("no Integrate prompt") ? 400 : 503, unavailable);
  return sessions.openIntegration(folder);
}

const NOT_INTEGRATABLE = "this folder is not a repository waiting to be set up for OpenSpec";

/**
 * The marker decides, nothing else: when `openspec/config.yaml` is in the folder, the repository is tracked with
 * `enabled: true` and its default name, and a scan starts so it reaches the board. Returns whether it was added.
 */
export async function confirmIntegration(state: IntegrationState, folder: string): Promise<boolean> {
  const path = canonicalPath(folder);
  if (state.config.repos.some((r) => canonicalPath(r.path) === path)) return false;
  if (!(await isOpenSpecRepo(path))) return false;
  const repo = newRepoConfig(path, true);
  const named = { ...repo, name: availableName(repo, state.config.repos.map((r) => r.name)) };
  state.config = await saveConfig({ ...state.config, repos: [...state.config.repos, named] });
  state.scanner.trigger();
  return true;
}

/**
 * Re-checks every folder an integration session ran in. Called on each discovery run, so a marker written while the
 * agent is still going is noticed as soon as the user looks, and on the session's end.
 */
export async function confirmPendingIntegrations(state: IntegrationState): Promise<void> {
  const folders = new Set((state.sessions?.list() ?? []).flatMap((s) => (s.integration === true ? [s.folder] : [])));
  for (const folder of folders) await confirmIntegration(state, folder);
}
