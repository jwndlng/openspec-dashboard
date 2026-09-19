import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { DiscoverResult, RepoConfig } from "../shared/types.ts";
import { newRepoConfig } from "./config.ts";
import { expandPath } from "./paths.ts";

export const DEFAULT_MAX_DEPTH = 4;
export const IGNORED_DIRS = new Set(["node_modules", ".git", ".venv", "target", "dist"]);

const MARKERS = ["openspec/config.yaml", "openspec/config.yml"];

async function isOpenSpecRepo(dir: string): Promise<boolean> {
  for (const marker of MARKERS) {
    try {
      if ((await stat(join(dir, marker))).isFile()) return true;
    } catch {
      // not present
    }
  }
  return false;
}

/** A linked git worktree has a `.git` *file* (pointing at the main repo) instead of a directory. */
async function isLinkedWorktree(dir: string): Promise<boolean> {
  try {
    return (await stat(join(dir, ".git"))).isFile();
  } catch {
    return false;
  }
}

async function walk(dir: string, depth: number, maxDepth: number, found: Set<string>): Promise<void> {
  if (await isOpenSpecRepo(dir)) {
    // Worktrees mirror their main repo's changes; listing them would show every change twice.
    if (!(await isLinkedWorktree(dir))) found.add(dir);
    // Anything nested inside a repo (fixtures, vendored copies, in-repo worktrees) is not a project of its own.
    return;
  }
  if (depth >= maxDepth) return;
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory: skip silently, the root itself was checked by the caller
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name) || entry.name === "openspec") continue;
    await walk(join(dir, entry.name), depth + 1, maxDepth, found);
  }
}

/** Finds directories containing `openspec/config.yaml` under each root, up to `maxDepth` levels down. */
export async function findOpenSpecRepos(
  roots: string[],
  maxDepth = DEFAULT_MAX_DEPTH,
): Promise<{ paths: string[]; errors: DiscoverResult["errors"] }> {
  const found = new Set<string>();
  const errors: DiscoverResult["errors"] = [];
  for (const root of roots) {
    const abs = expandPath(root);
    try {
      if (!(await stat(abs)).isDirectory()) {
        errors.push({ root, message: "not a directory" });
        continue;
      }
    } catch {
      errors.push({ root, message: "does not exist" });
      continue;
    }
    await walk(abs, 0, maxDepth, found);
  }
  return { paths: [...found].sort(), errors };
}

/**
 * Found paths that are not configured yet, as untracked repos. Known repos
 * (enabled or not) are never candidates, so user choices survive re-discovery.
 */
export function toCandidates(known: RepoConfig[], paths: string[]): RepoConfig[] {
  const knownPaths = new Set(known.map((r) => r.path));
  return paths
    .filter((path) => !knownPaths.has(path))
    .map((path) => newRepoConfig(path, false))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function discoverRepos(known: RepoConfig[], roots: string[]): Promise<DiscoverResult> {
  const { paths, errors } = await findOpenSpecRepos(roots);
  return { candidates: toCandidates(known, paths), errors };
}
