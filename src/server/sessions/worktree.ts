// The only git *write* the dashboard ever performs (design.md D5): removing a session's worktree, after read-only
// checks proved it holds nothing that exists nowhere else, and only when the user confirmed it.
import { stat } from "node:fs/promises";

const ENV = { GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };

async function git(cwd: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  try {
    const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore", env: { ...process.env, ...ENV } });
    const out = await new Response(proc.stdout).text();
    return { ok: (await proc.exited) === 0, out: out.trim() };
  } catch {
    return { ok: false, out: "" };
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
