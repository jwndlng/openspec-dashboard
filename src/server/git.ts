// Read-only git helpers. Every call sets `cwd` to the repository and passes
// paths after `--`; nothing here ever mutates a repository.
import { join } from "node:path";
import type { CheckoutStatus, Worktree } from "../shared/types.ts";

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
 * Parses `git worktree list --porcelain` into one entry per record. Git lists the main working tree first; detached,
 * locked, prunable and bare records are kept and flagged. Flags are only set when they apply.
 */
export function parseWorktrees(porcelain: string): Worktree[] {
  const result: Worktree[] = [];
  let current: Worktree | undefined;
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length) };
      if (result.length === 0) current.isMain = true;
      result.push(current);
    }
    if (!current) continue;
    if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length, "HEAD ".length + 7);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (line === "detached") {
      current.detached = true;
    } else if (line === "bare") {
      current.bare = true;
    } else if (line === "locked" || line.startsWith("locked ")) {
      current.locked = true;
      if (line.length > "locked ".length) current.lockReason = line.slice("locked ".length);
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

/** What one `git status --porcelain=v2 --branch` says about a checkout. Counts only: entry paths are never kept. */
export interface ParsedStatus extends CheckoutStatus {
  /** Branch name; absent when detached. */
  head?: string;
  detached: boolean;
  /** The branch has no commits yet. */
  unborn: boolean;
}

/**
 * Parses `git status --porcelain=v2 --branch`. `1` (changed), `2` (renamed/copied) and `u` (unmerged) entries count as
 * modified, `?` entries as untracked (git collapses an untracked directory into one entry). `branch.upstream` and
 * `branch.ab` only appear when an upstream is configured.
 */
export function parseStatusV2(text: string): ParsedStatus {
  const result: ParsedStatus = { detached: false, unborn: false, modified: 0, untracked: 0, conflicts: 0 };
  for (const line of text.split("\n")) {
    if (line.startsWith("# branch.head ")) {
      const head = line.slice("# branch.head ".length);
      if (head === "(detached)") result.detached = true;
      else result.head = head;
    } else if (line.startsWith("# branch.oid ")) {
      result.unborn = line.slice("# branch.oid ".length) === "(initial)";
    } else if (line.startsWith("# branch.upstream ")) {
      result.upstream = line.slice("# branch.upstream ".length);
    } else if (line.startsWith("# branch.ab ")) {
      const ab = /^\+(\d+) -(\d+)$/.exec(line.slice("# branch.ab ".length));
      if (ab) {
        result.ahead = Number(ab[1]);
        result.behind = Number(ab[2]);
      }
    } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      result.modified++;
    } else if (line.startsWith("u ")) {
      result.modified++;
      result.conflicts++;
    } else if (line.startsWith("? ")) {
      result.untracked++;
    }
  }
  return result;
}

/** Working-tree status of the checkout at `path` (the main checkout or a linked worktree). Undefined when it cannot be determined. */
export async function checkoutStatus(path: string): Promise<ParsedStatus | undefined> {
  const out = await git(path, ["status", "--porcelain=v2", "--branch"]);
  return out === undefined ? undefined : parseStatusV2(out);
}

/** Whether the repository has any remote-tracking ref; without one "unpushed" means nothing. */
export async function hasRemoteRefs(cwd: string): Promise<boolean | undefined> {
  const out = await git(cwd, ["rev-parse", "--symbolic", "--remotes"]);
  return out === undefined ? undefined : out.trim() !== "";
}

export const LOCAL_ONLY_LIMIT = 100;

/** Commits reachable from `HEAD` but from no remote-tracking ref, capped at `LOCAL_ONLY_LIMIT`. 0 for a branch without commits. */
export async function localOnlyCommits(path: string): Promise<number | undefined> {
  const out = await git(path, ["log", "--format=%H", "-n", String(LOCAL_ONLY_LIMIT), "HEAD", "--not", "--remotes"]);
  if (out !== undefined) return out.split("\n").filter(Boolean).length;
  // `log` fails on an unborn branch: a work tree whose HEAD does not resolve has no commits to push.
  const inside = (await git(path, ["rev-parse", "--is-inside-work-tree"]))?.trim() === "true";
  return inside && (await git(path, ["rev-parse", "--verify", "--quiet", "HEAD"])) === undefined ? 0 : undefined;
}
