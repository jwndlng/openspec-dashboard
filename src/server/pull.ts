// The pull action: fetch a repository's remote, then fast-forward its main checkout — and nothing more adventurous.
//
// This is the ONLY place in the dashboard that contacts a remote or changes a main checkout, and it only ever runs on
// the user's explicit request (openspec/specs/dashboard-api: "never writes", exception 3; openspec/specs/repository-pull).
// It never merges with a commit, rebases, stashes, resets, forces or switches branches, never touches linked worktrees,
// and never runs repository hooks: a click in a browser must not execute a repository's scripts.
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import type { PullResult, RepoConfig } from "../shared/types.ts";
import { defaultBranch } from "./git.ts";

export const FETCH_TIMEOUT_MS = 60_000;
const LOCAL_TIMEOUT_MS = 15_000;
const PULL_ALL_CONCURRENCY = 3;

interface Run {
  ok: boolean;
  out: string;
  err: string;
  timedOut: boolean;
}

/**
 * git without a shell. Never prompts: no terminal prompt, no stdin, and SSH in batch mode — unless the user brought
 * their own `GIT_SSH_COMMAND`, which is theirs to keep. Credentials stay entirely with git.
 */
async function git(cwd: string, args: string[], timeoutMs = LOCAL_TIMEOUT_MS): Promise<Run> {
  const env: Record<string, string | undefined> = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
  if (!env.GIT_SSH_COMMAND) env.GIT_SSH_COMMAND = "ssh -o BatchMode=yes";
  let timedOut = false;
  try {
    const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore", env });
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);
    try {
      const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
      return { ok: code === 0 && !timedOut, out: out.trim(), err: err.trim(), timedOut };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return { ok: false, out: "", err: String(e), timedOut };
  }
}

/** `https://user:secret@host/…` must never reach the browser. */
export function maskCredentials(text: string): string {
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, "$1***@");
}

/** The part of git's stderr worth showing: its error and fatal lines, else the last line; hints are dropped. */
export function reasonFrom(stderr: string): string {
  const lines = stderr
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "" && !l.startsWith("hint:"));
  const telling = lines.filter((l) => /^(error|fatal):/.test(l) || /^\t/.test(l));
  const chosen = telling.length ? telling : lines.slice(-1);
  return maskCredentials(chosen.map((l) => l.replace(/^(error|fatal):\s*/, "").trim()).join(" ")) || "git gave no reason";
}

interface Inspection {
  branch?: string;
  upstream?: string;
  remote?: string;
  ahead: number;
  behind: number;
  hasRemote: boolean;
}

/** Read-only look at the main checkout. */
async function inspect(repoPath: string): Promise<Inspection> {
  const head = await git(repoPath, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const branch = head.ok && head.out ? head.out : undefined;
  let upstream: string | undefined;
  let remote: string | undefined;
  let ahead = 0;
  let behind = 0;
  if (branch) {
    const ref = await git(repoPath, ["for-each-ref", "--format=%(upstream:short)|%(upstream:remotename)|%(upstream:track)", `refs/heads/${branch}`]);
    const [short, remoteName, track = ""] = ref.out.split("|");
    upstream = short || undefined;
    remote = remoteName || undefined;
    ahead = Number(/ahead (\d+)/.exec(track)?.[1] ?? 0);
    behind = Number(/behind (\d+)/.exec(track)?.[1] ?? 0);
  }
  // Remote-tracking refs exist exactly when a remote has been fetched from before; `origin` is what a clone has.
  const remotes = await git(repoPath, ["for-each-ref", "--count=1", "--format=%(refname)", "refs/remotes/"]);
  return { branch, upstream, remote, ahead, behind, hasRemote: remote !== undefined || (remotes.ok && remotes.out !== "") };
}

async function hasPostMergeHook(repoPath: string): Promise<boolean> {
  const dir = await git(repoPath, ["rev-parse", "--git-path", "hooks/post-merge"]);
  if (!dir.ok || !dir.out) return false;
  try {
    await access(join(repoPath, dir.out), constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

const inFlight = new Set<string>();

export class PullBusyError extends Error {
  constructor() {
    super("already pulling");
  }
}

/** `repo` must come from the dashboard config — never a path from a request. */
export async function pullRepository(repo: RepoConfig, options: { fetchTimeoutMs?: number } = {}): Promise<PullResult> {
  if (inFlight.has(repo.id)) throw new PullBusyError();
  inFlight.add(repo.id);
  try {
    return await pull(repo, options.fetchTimeoutMs ?? FETCH_TIMEOUT_MS);
  } finally {
    inFlight.delete(repo.id);
  }
}

async function pull(repo: RepoConfig, fetchTimeoutMs: number): Promise<PullResult> {
  const path = repo.path;
  const before = await inspect(path);
  const base = { repoId: repo.id, branch: before.branch, upstream: before.upstream, defaultBranch: await defaultBranch(path) };
  if (!before.hasRemote) return { ...base, fetched: false, update: "skipped", reason: "no remote configured; there is nothing to pull" };

  // Refs, FETCH_HEAD and objects only. No auto-maintenance: a click must not turn into a repack. Submodules are left alone.
  const remote = before.remote ?? "origin";
  const fetched = await git(path, ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "fetch", "--no-recurse-submodules", "--quiet", remote], fetchTimeoutMs);
  if (!fetched.ok) return { ...base, fetched: false, update: "failed", reason: fetched.timedOut ? "timed out" : reasonFrom(fetched.err) };

  const now = await inspect(path);
  const result = { ...base, branch: now.branch, upstream: now.upstream, fetched: true };
  const on = now.branch ? `on ${now.branch}` : "on a detached HEAD";
  if (base.defaultBranch === undefined) return { ...result, update: "skipped", reason: "the default branch is unknown; only fetched" };
  if (now.branch !== base.defaultBranch) return { ...result, update: "skipped", reason: `${on}, not ${base.defaultBranch}; only fetched` };
  if (!now.upstream) return { ...result, update: "skipped", reason: `${now.branch} has no upstream; only fetched` };
  if (now.behind === 0) return { ...result, update: "up-to-date" };
  if (now.ahead > 0) return { ...result, update: "refused", reason: `local and remote have diverged (${now.ahead} ahead, ${now.behind} behind)` };

  // Fast-forward or nothing. Hooks off: a plain merge would run the repository's post-merge hook.
  const merged = await git(path, ["-c", "core.hooksPath=/dev/null", "merge", "--ff-only", "--quiet", now.upstream]);
  if (!merged.ok) return { ...result, update: "refused", reason: reasonFrom(merged.err) };
  return { ...result, update: "fast-forwarded", commits: now.behind, hooksSkipped: (await hasPostMergeHook(path)) || undefined };
}

/** Every repository on its own: one that fails or is busy does not stop the others. */
export async function pullAll(repos: RepoConfig[], options: { fetchTimeoutMs?: number } = {}): Promise<PullResult[]> {
  const results: PullResult[] = new Array(repos.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < repos.length) {
      const index = next++;
      try {
        results[index] = await pullRepository(repos[index], options);
      } catch (err) {
        results[index] = { repoId: repos[index].id, fetched: false, update: "failed", reason: err instanceof Error ? err.message : String(err) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PULL_ALL_CONCURRENCY, repos.length) }, worker));
  return results;
}
