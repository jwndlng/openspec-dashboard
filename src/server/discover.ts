import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import type { DiscoveredRepo, DiscoverResult, RepoConfig } from "../shared/types.ts";
import { newRepoConfig } from "./config.ts";
import { normalizeRemote, originUrl } from "./git.ts";
import { canonicalPath } from "./paths.ts";

export const DEFAULT_MAX_DEPTH = 4;
const REMOTE_LOOKUPS = 8;
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

/** At or below one of the (canonical) ignore paths; whole segments only, so `/w/repos` does not cover `/w/repos-extra`. */
function isIgnored(dir: string, ignorePaths: string[]): boolean {
  return ignorePaths.some((p) => dir === p || dir.startsWith(p.endsWith(sep) ? p : p + sep));
}

async function hasOwnGitDir(dir: string): Promise<boolean> {
  try {
    await stat(join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string, depth: number, maxDepth: number, found: Set<string>, ignorePaths: string[]): Promise<void> {
  if (isIgnored(dir, ignorePaths)) return;
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
    await walk(join(dir, entry.name), depth + 1, maxDepth, found, ignorePaths);
  }
}

/**
 * Finds directories containing `openspec/config.yaml` under each root, up to `maxDepth` levels down. Roots are
 * canonicalised first and the walk never follows symlinks, so every reported path is canonical and a directory is
 * reported once however the roots were spelled. Errors name the root as the user typed it.
 */
export async function findOpenSpecRepos(
  roots: string[],
  maxDepth = DEFAULT_MAX_DEPTH,
  ignorePaths: string[] = [],
): Promise<{ paths: string[]; errors: DiscoverResult["errors"] }> {
  const found = new Set<string>();
  const errors: DiscoverResult["errors"] = [];
  const ignored = ignorePaths.map(canonicalPath);
  for (const root of roots) {
    const abs = canonicalPath(root);
    try {
      if (!(await stat(abs)).isDirectory()) {
        errors.push({ root, message: "not a directory" });
        continue;
      }
    } catch {
      errors.push({ root, message: "does not exist" });
      continue;
    }
    await walk(abs, 0, maxDepth, found, ignored);
  }
  return { paths: [...found].sort(), errors };
}

/**
 * Found paths that are not configured yet, as untracked repos. Known repos
 * (enabled or not) are never candidates, so user choices survive re-discovery.
 */
export function toCandidates(known: RepoConfig[], paths: string[]): RepoConfig[] {
  const knownPaths = new Set(known.map((r) => canonicalPath(r.path)));
  return paths
    .filter((path) => !knownPaths.has(path))
    .map((path) => newRepoConfig(path, false))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Normalised `origin` per repository path, at most `REMOTE_LOOKUPS` git calls at a time. A failed lookup means "no remote". */
async function remotesOf(paths: string[]): Promise<Map<string, string>> {
  const remotes = new Map<string, string>();
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const path = paths[next++];
      // Inside a bigger repository git would answer with that repository's remote: sibling projects of a monorepo are not clones.
      const url = (await hasOwnGitDir(path)) ? await originUrl(path).catch(() => undefined) : undefined;
      const remote = url ? normalizeRemote(url) : undefined;
      if (remote) remotes.set(path, remote);
    }
  };
  await Promise.all(Array.from({ length: Math.min(REMOTE_LOOKUPS, paths.length) }, worker));
  return remotes;
}

/** Marks candidates that share their `origin` with another known repository, tracked or candidate. Informational only. */
export async function withSameRemote(known: RepoConfig[], candidates: RepoConfig[]): Promise<DiscoveredRepo[]> {
  const all = [...known.map((repo) => ({ repo, tracked: true })), ...candidates.map((repo) => ({ repo, tracked: false }))];
  const remotes = await remotesOf(all.map((e) => e.repo.path));
  return candidates.map((candidate) => {
    const remote = remotes.get(candidate.path);
    const others = remote ? all.filter((e) => e.repo.path !== candidate.path && remotes.get(e.repo.path) === remote) : [];
    if (others.length === 0) return candidate;
    return { ...candidate, sameRemoteAs: others.map((e) => ({ name: e.repo.name, path: e.repo.path, tracked: e.tracked })) };
  });
}

export async function discoverRepos(known: RepoConfig[], roots: string[], ignorePaths: string[] = []): Promise<DiscoverResult> {
  const { paths, errors } = await findOpenSpecRepos(roots, DEFAULT_MAX_DEPTH, ignorePaths);
  return { candidates: await withSameRemote(known, toCandidates(known, paths)), errors };
}
