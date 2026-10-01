// Starting a brand-new project (project-creation spec). The dashboard's own writes are exactly two, both outside every
// tracked repository: one new, empty folder directly inside a configured workspace root, and `git init` in it. The
// folder is then handed to an integration session, so `openspec init` is run by the user's agent under its own
// permission prompts and tracking follows the marker (`integration.ts`), exactly as for Integrate.
import { lstat, mkdir, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { integrateUnavailable, isProjectName, type CreateProjectResponse } from "../shared/types.ts";
import type { IntegrationState } from "./integration.ts";
import { canonicalPath, dashboardHome, whichOnPath } from "./paths.ts";
import { reasonFrom } from "./pull.ts";

const GIT_INIT_TIMEOUT_MS = 10_000;

/** A refusal or failure with the HTTP status the route answers with. */
export class CreateProjectError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const within = (path: string, root: string) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);

/**
 * Variables that would point `git init` somewhere other than the new folder — set, for instance, when the dashboard
 * itself was started from a git hook. Dropped so the only repository git can create is the one in its working directory.
 */
const REDIRECTING_GIT_ENV = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_COMMON_DIR", "GIT_NAMESPACE"];

/**
 * The one writing git command creating a project runs, in the folder just created and nowhere else. Like
 * `createChange.ts`'s runner, deliberately not `git.ts`'s: that module is read-only by contract. Resolves to git's
 * reason on failure, `undefined` on success.
 */
async function gitInit(dir: string, timeoutMs = GIT_INIT_TIMEOUT_MS): Promise<string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
  for (const key of REDIRECTING_GIT_ENV) delete env[key];
  let timedOut = false;
  try {
    const proc = Bun.spawn(["git", "init", "--quiet"], { cwd: dir, stdout: "ignore", stderr: "pipe", stdin: "ignore", env });
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);
    try {
      const stderr = await new Response(proc.stderr).text();
      const code = await proc.exited;
      if (timedOut) return "git init timed out";
      return code === 0 ? undefined : reasonFrom(stderr);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return String(err);
  }
}

/** Why `path` must not be created, or undefined. Canonical paths throughout; `path` does not exist yet. */
function placementProblem(state: IntegrationState, path: string): string | undefined {
  const repo = state.config.repos.find((r) => within(path, canonicalPath(r.path)));
  if (repo) return `${path} would lie inside the tracked repository ${repo.name}`;
  const ignored = state.config.ignorePaths.find((p) => within(path, canonicalPath(p)));
  if (ignored) return `${path} lies in the ignore path ${ignored}`;
  if (within(path, canonicalPath(dashboardHome()))) return `${path} would lie inside the dashboard's own folder`;
  return undefined;
}

/**
 * Creates `<root>/<name>`, runs `git init` in it and starts an integration session there. Every precondition is checked
 * before the folder is made, so a refusal writes nothing, runs no git and starts no process.
 */
export async function createProject(state: IntegrationState, input: { root?: unknown; name?: unknown }): Promise<CreateProjectResponse> {
  const sessions = state.sessions;
  if (!sessions || !state.config.agentSessions.enabled) throw new CreateProjectError(403, "agent sessions are disabled");
  const name = typeof input.name === "string" ? input.name : "";
  if (!isProjectName(name)) {
    throw new CreateProjectError(400, "the folder name must start with a letter or digit and use only letters, digits, '.', '_' and '-' (at most 100 characters, not ending in .git)");
  }
  const unavailable = integrateUnavailable(state.config, sessions.agents());
  if (unavailable) throw new CreateProjectError(503, unavailable);
  // The same check `openIntegration` makes, made here first so it cannot refuse after the folder exists.
  const agent = state.config.agentSessions.agents.find((a) => a.id === state.config.agentSessions.defaultAgent);
  if (agent && !Bun.which(agent.command[0])) throw new CreateProjectError(503, `${agent.name} was not found (${agent.command[0]}); install it or change its command in Settings`);
  if (!whichOnPath("git")) throw new CreateProjectError(503, "git was not found on this machine");

  const root = typeof input.root === "string" && input.root.trim() ? canonicalPath(input.root) : "";
  if (!root || !state.config.scanRoots.some((r) => canonicalPath(r) === root)) throw new CreateProjectError(404, "that is not one of the configured workspace roots");
  const rootIsDir = await stat(root).then(
    (s) => s.isDirectory(),
    () => false,
  );
  if (!rootIsDir) throw new CreateProjectError(404, `the workspace root ${root} does not exist`);

  const path = join(root, name);
  const taken = await lstat(path).then(
    () => true,
    () => false,
  );
  if (taken) throw new CreateProjectError(409, `${path} already exists`);
  const problem = placementProblem(state, path);
  if (problem) throw new CreateProjectError(409, problem);

  // Not recursive: the exclusive create. Whatever appeared at the path since the check above is refused, never reused.
  try {
    await mkdir(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new CreateProjectError(409, `${path} already exists`);
    throw new CreateProjectError(500, `could not create ${path}: ${(err as Error).message}`);
  }
  const failed = await gitInit(path);
  if (failed) throw new CreateProjectError(500, `git init failed in ${path}, which was left in place: ${failed}`);

  const folder = canonicalPath(path);
  const { session } = await sessions.openIntegration(folder);
  return { path: folder, session };
}
