// One new folder outside every tracked repository: the placement rules and the exclusive create shared by the three
// writes beyond the dashboard home that make a folder — New project (`createProject.ts`), a GitHub clone
// (`githubClone.ts`) and the setup wizard's workspace folder (`setup.ts`). Checked before anything exists, so a refusal
// writes nothing; created without `recursive`, so whatever appeared in the meantime is refused rather than reused.
import { lstat, mkdir, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { isProjectName, type Config } from "../shared/types.ts";
import { canonicalPath, dashboardHome } from "./paths.ts";

/** A refusal or failure with the HTTP status the route answers with. */
export class NewFolderError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const FOLDER_NAME_RULE = "the folder name must start with a letter or digit and use only letters, digits, '.', '_' and '-' (at most 100 characters, not ending in .git)";

const within = (path: string, root: string) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);

/** Why `path` must not be created, or undefined. Canonical paths throughout; `path` does not exist yet. */
export function placementProblem(config: Pick<Config, "repos" | "ignorePaths">, path: string): string | undefined {
  const repo = config.repos.find((r) => within(path, canonicalPath(r.path)));
  if (repo) return `${path} would lie inside the tracked repository ${repo.name}`;
  const ignored = config.ignorePaths.find((p) => within(path, canonicalPath(p)));
  if (ignored) return `${path} lies in the ignore path ${ignored}`;
  if (within(path, canonicalPath(dashboardHome()))) return `${path} would lie inside the dashboard's own folder`;
  return undefined;
}

/** Whether anything — file, directory or symbolic link, even a dangling one — is at `path`. */
export async function pathTaken(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false,
  );
}

export async function isDirectory(path: string): Promise<boolean> {
  return stat(path).then(
    (s) => s.isDirectory(),
    () => false,
  );
}

/**
 * `<root>/<name>` checked under New project's rules: the root one of the saved workspace roots and an existing directory,
 * the name one plain segment, nothing at the path, and the path in no tracked repository, ignore path or the home.
 * Throws {@link NewFolderError} with `400`, `404` or `409`; returns the canonical root and the path otherwise.
 */
export async function checkNewFolder(config: Pick<Config, "scanRoots" | "repos" | "ignorePaths">, rootInput: unknown, name: unknown): Promise<{ root: string; path: string }> {
  if (typeof name !== "string" || !isProjectName(name)) throw new NewFolderError(400, FOLDER_NAME_RULE);
  const root = typeof rootInput === "string" && rootInput.trim() ? canonicalPath(rootInput) : "";
  if (!root || !config.scanRoots.some((r) => canonicalPath(r) === root)) throw new NewFolderError(404, "that is not one of the configured workspace roots");
  if (!(await isDirectory(root))) throw new NewFolderError(404, `the workspace root ${root} does not exist`);
  const path = join(root, name);
  if (await pathTaken(path)) throw new NewFolderError(409, `${path} already exists`);
  const problem = placementProblem(config, path);
  if (problem) throw new NewFolderError(409, problem);
  return { root, path };
}

/** The exclusive create: one directory, its parent never made, an existing path refused with `409`. */
export async function makeNewFolder(path: string): Promise<void> {
  try {
    await mkdir(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new NewFolderError(409, `${path} already exists`);
    throw new NewFolderError(500, `could not create ${path}: ${(err as Error).message}`);
  }
}
