// The main console's working directory. It belongs to no repository and must never be one: a folder that is, or lies
// inside, a tracked repository is refused, so the console never runs in a main checkout. A folder above repositories
// (a workspace root) is fine — what the agent does there is decided by its own permission prompts.
import { mkdirSync, statSync } from "node:fs";
import { sep } from "node:path";
import type { Config } from "../../shared/types.ts";
import { canonicalPath, consoleDir } from "../paths.ts";

export interface ConsoleFolder {
  path: string;
  isDefault: boolean;
}

export function consoleFolderOf(config: Config): ConsoleFolder {
  const configured = config.agentSessions.consoleDir;
  return configured ? { path: configured, isDefault: false } : { path: consoleDir(), isDefault: true };
}

const within = (path: string, root: string) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);

/** Why `dir` cannot be the console folder, or undefined when it can. Both sides are compared as canonical paths. */
export function consoleFolderProblem(dir: string, config: Pick<Config, "repos">): string | undefined {
  let isDir = false;
  try {
    isDir = statSync(dir).isDirectory();
  } catch {
    return `the console folder ${dir} does not exist`;
  }
  if (!isDir) return `the console folder ${dir} is not a directory`;
  const path = canonicalPath(dir);
  const repo = config.repos.find((r) => r.enabled && within(path, canonicalPath(r.path)));
  if (repo) return `the console folder must not be inside a tracked repository (${repo.name})`;
  return undefined;
}

/** The folder to start the console in: the default one is created on demand, a configured one never. */
export function prepareConsoleFolder(config: Config): { folder: ConsoleFolder; problem?: string } {
  const folder = consoleFolderOf(config);
  if (folder.isDefault) mkdirSync(folder.path, { recursive: true, mode: 0o700 });
  return { folder, problem: consoleFolderProblem(folder.path, config) };
}
