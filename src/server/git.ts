// Read-only git helpers. Every call sets `cwd` to the repository and passes
// paths after `--`; nothing here ever mutates a repository.
import { join } from "node:path";
import type { Worktree } from "../shared/types.ts";

const DEFAULT_TIMEOUT_MS = 10_000;

async function git(cwd: string, args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string | undefined> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "ignore",
    stdin: "ignore",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
  });
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  try {
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    return code === 0 ? out : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  return (await git(cwd, ["rev-parse", "--is-inside-work-tree"]))?.trim() === "true";
}

export async function currentBranch(cwd: string): Promise<string | undefined> {
  const out = (await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]))?.trim();
  return out && out !== "HEAD" ? out : undefined;
}

/**
 * Parses `git worktree list --porcelain`: one entry per record, in git's order — the main working tree first, then the
 * linked worktrees. Detached worktrees have no branch.
 */
export function parseWorktrees(porcelain: string): Worktree[] {
  const result: Worktree[] = [];
  let current: Worktree | undefined;
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length) };
      if (result.length === 0) current.isMain = true;
      result.push(current);
    } else if (!current) {
      // stray line before the first record
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (line === "detached") {
      current.detached = true;
    } else if (line === "bare") {
      current.bare = true;
    } else if (line === "prunable" || line.startsWith("prunable ")) {
      current.prunable = true;
    } else if (line === "") {
      current = undefined;
    }
  }
  return result;
}

export async function worktrees(cwd: string): Promise<Worktree[]> {
  const out = await git(cwd, ["worktree", "list", "--porcelain"]);
  return out ? parseWorktrees(out) : [];
}

/** Committer date (ISO 8601) of the last commit touching `relPath`, or undefined if none. */
export async function lastCommitDate(cwd: string, relPath: string): Promise<string | undefined> {
  const out = (await git(cwd, ["log", "-1", "--format=%cI", "--", relPath]))?.trim();
  return out || undefined;
}

export interface StatusPath {
  /** Path relative to the repository's top level. */
  path: string;
  deleted: boolean;
}

/** Parses `git status --porcelain=v1 -z`. Rename/copy records carry the old name as an extra field, which is skipped. */
export function parseStatusPaths(porcelainZ: string): StatusPath[] {
  const result: StatusPath[] = [];
  const fields = porcelainZ.split("\0");
  for (let i = 0; i < fields.length; i++) {
    const record = fields[i];
    if (record.length < 4) continue;
    const xy = record.slice(0, 2);
    result.push({ path: record.slice(3), deleted: xy.includes("D") });
    if (xy.includes("R") || xy.includes("C")) i++;
  }
  return result;
}

/**
 * Absolute paths under `relPath` that differ from HEAD (modified, added, deleted, renamed, untracked).
 * Read-only: `GIT_OPTIONAL_LOCKS=0` (set for every call here) stops `status` from refreshing `.git/index`.
 * Empty on any failure.
 */
export async function statusPaths(cwd: string, relPath: string): Promise<{ path: string; deleted: boolean }[]> {
  // Porcelain paths are relative to the top level, which is not `cwd` when the project sits in a subdirectory.
  // `--show-cdup` keeps `cwd`'s own spelling (`--show-toplevel` would resolve symlinks such as /var → /private/var).
  const cdup = (await git(cwd, ["rev-parse", "--show-cdup"]))?.trim();
  if (cdup === undefined) return [];
  const top = join(cwd, cdup);
  const out = await git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", relPath]);
  return out ? parseStatusPaths(out).map((p) => ({ path: join(top, p.path), deleted: p.deleted })) : [];
}
