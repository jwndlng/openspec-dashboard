// The git *writes* the dashboard performs for agent sessions (design.md D17), both on an explicit user action:
// creating a session's worktree, and removing it after read-only checks proved it holds nothing that exists nowhere else.
import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const ENV = { GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };

async function git(cwd: string, args: string[]): Promise<{ ok: boolean; out: string; err: string }> {
  try {
    const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore", env: { ...process.env, ...ENV } });
    const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
    return { ok: (await proc.exited) === 0, out: out.trim(), err: err.trim() };
  } catch (e) {
    return { ok: false, out: "", err: String(e) };
  }
}

export interface Removable {
  removable: boolean;
  reason?: string;
}

/** Read-only: is the worktree clean and is every commit on it also reachable from somewhere else? */
export async function checkWorktreeRemovable(worktreePath: string): Promise<Removable> {
  try {
    if (!(await stat(worktreePath)).isDirectory()) return { removable: false, reason: "worktree path is not a directory" };
  } catch {
    return { removable: false, reason: "worktree no longer exists" };
  }
  const status = await git(worktreePath, ["status", "--porcelain", "--untracked-files=all"]);
  if (!status.ok) return { removable: false, reason: "could not read the worktree's status" };
  if (status.out) return { removable: false, reason: "the worktree has uncommitted changes" };

  const upstream = await git(worktreePath, ["rev-list", "--count", "@{u}..HEAD"]);
  if (upstream.ok) {
    return upstream.out === "0" ? { removable: true } : { removable: false, reason: `${upstream.out} commit(s) have not been pushed` };
  }
  // No upstream: every commit must be reachable from another local branch or a remote-tracking branch.
  const head = await git(worktreePath, ["symbolic-ref", "--quiet", "HEAD"]);
  const refs = await git(worktreePath, ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"]);
  if (!refs.ok) return { removable: false, reason: "could not list branches" };
  const others = refs.out.split("\n").filter((ref) => ref && ref !== head.out);
  const unique = await git(worktreePath, ["rev-list", "--count", "HEAD", "--not", ...others]);
  if (!unique.ok) return { removable: false, reason: "could not compare the worktree's commits" };
  return unique.out === "0" ? { removable: true } : { removable: false, reason: `${unique.out} commit(s) exist only on this worktree's branch` };
}

/** `git worktree unlock` (the CLI leaves its worktrees locked) followed by a non-forcing `git worktree remove`. */
export async function removeWorktree(repoPath: string, worktreePath: string): Promise<Removable> {
  const check = await checkWorktreeRemovable(worktreePath);
  if (!check.removable) return check;
  await git(repoPath, ["worktree", "unlock", worktreePath]); // fails harmlessly when it was not locked
  const removed = await git(repoPath, ["worktree", "remove", worktreePath]);
  return removed.ok ? { removable: true } : { removable: false, reason: "git refused to remove the worktree" };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Makes sure `worktreePath` is a worktree of `repoPath` on `branch`. An existing one is reused (an earlier session for
 * the same change); an existing branch is checked out; otherwise the branch is created from the repository's default
 * branch as the repository currently knows it (`origin/HEAD`, else `HEAD`). Deliberately no `git fetch`: the dashboard
 * does not talk to the network, and remotes behind a hardware key would block.
 */
export async function ensureWorktree(repoPath: string, worktreePath: string, branch: string): Promise<{ created: boolean; base?: string }> {
  if (await isDirectory(worktreePath)) {
    const inside = await git(worktreePath, ["rev-parse", "--is-inside-work-tree"]);
    if (inside.ok && inside.out === "true") return { created: false };
    throw new Error(`${worktreePath} exists but is not a git worktree`);
  }
  await mkdir(dirname(worktreePath), { recursive: true });
  await git(repoPath, ["worktree", "prune"]); // forget worktrees whose directory was deleted by hand
  const hasBranch = (await git(repoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`])).ok;
  if (hasBranch) {
    const added = await git(repoPath, ["worktree", "add", worktreePath, branch]);
    if (!added.ok) throw new Error(`could not create the worktree: ${added.err.split("\n").pop()}`);
    return { created: true };
  }
  const remoteHead = await git(repoPath, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  const base = remoteHead.ok && remoteHead.out ? remoteHead.out : "HEAD";
  const added = await git(repoPath, ["worktree", "add", "-b", branch, worktreePath, base]);
  if (!added.ok) throw new Error(`could not create the worktree: ${added.err.split("\n").pop()}`);
  return { created: true, base };
}

/** A change that exists only uncommitted in the main checkout is copied into the worktree, so the agent can see it. */
export async function copyChangeIfMissing(repoPath: string, worktreePath: string, change: string): Promise<boolean> {
  const source = join(repoPath, "openspec", "changes", change);
  const target = join(worktreePath, "openspec", "changes", change);
  if ((await isDirectory(target)) || !(await isDirectory(source))) return false;
  await cp(source, target, { recursive: true });
  return true;
}
