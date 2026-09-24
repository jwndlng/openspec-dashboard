// What became of the work in a session's worktree (design.md D1, D2). Read-only git, never a remote: `merged` is as
// of the user's last fetch. Worktree directories are listed themselves, because they outlive session records.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ChangeSession, RepoConfig, SessionAction, SessionWorktree, WorkStatus } from "../../shared/types.ts";
import { worktreesDir } from "../paths.ts";

const ENV = { GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
const MAX_COMPARED_FILES = 500;
/** One path segment; also what `POST /api/worktrees/remove` accepts. */
export const WORKTREE_NAME = /^[a-z0-9][a-z0-9._-]*$/;

async function git(cwd: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  try {
    const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "ignore", stdin: "ignore", env: { ...process.env, ...ENV } });
    const out = await new Response(proc.stdout).text();
    return { ok: (await proc.exited) === 0, out: out.trim() };
  } catch {
    return { ok: false, out: "" };
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** The default branch as the repository locally knows it; without a remote, whatever the main checkout is on. */
export async function baseRef(repoPath: string): Promise<string | undefined> {
  const remoteHead = await git(repoPath, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (remoteHead.ok && remoteHead.out) return remoteHead.out;
  const head = await git(repoPath, ["rev-parse", "--verify", "--quiet", "HEAD"]);
  return head.ok && head.out ? head.out : undefined;
}

/**
 * Squash and rebase merges leave the branch's commits unreachable from the base, so content is compared instead: every
 * file `ref` changed since it forked from `base` has the same content in `base`. `cwd` is a worktree or the repository.
 */
export async function contentIsInBase(cwd: string, base: string, ref = "HEAD"): Promise<boolean> {
  const changed = await git(cwd, ["diff", "--name-only", "-z", `${base}...${ref}`]);
  if (!changed.ok) return false;
  const files = changed.out.split("\0").filter(Boolean);
  if (files.length > MAX_COMPARED_FILES) return false;
  if (files.length === 0) return true;
  return (await git(cwd, ["diff", "--quiet", base, ref, "--", ...files])).ok;
}

export async function readWorkStatus(repoPath: string, worktreePath: string): Promise<{ work: WorkStatus; branch?: string; lastCommitAt?: string }> {
  const inside = (await isDirectory(worktreePath)) ? await git(worktreePath, ["rev-parse", "--is-inside-work-tree"]) : { ok: false, out: "" };
  if (!inside.ok || inside.out !== "true") return { work: { state: "missing" } };
  const [branchRef, status, lastCommit, base] = await Promise.all([
    git(worktreePath, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
    git(worktreePath, ["status", "--porcelain", "--untracked-files=all"]),
    git(worktreePath, ["log", "-1", "--format=%cI"]),
    baseRef(repoPath),
  ]);
  const branch = branchRef.ok && branchRef.out ? branchRef.out : undefined;
  const common = { branch, lastCommitAt: lastCommit.ok && lastCommit.out ? lastCommit.out : undefined };
  const label = base && /^[0-9a-f]{40}$/.test(base) ? "the main checkout" : base;
  if (!status.ok) return { ...common, work: { state: "missing" } };
  const dirty = status.out ? status.out.split("\n").length : 0;
  if (dirty > 0) return { ...common, work: { state: "uncommitted", count: dirty, base: label } };

  const ahead = base ? await git(worktreePath, ["rev-list", "--count", `${base}..HEAD`]) : { ok: false, out: "" };
  const aheadOfBase = ahead.ok ? Number(ahead.out) : undefined;
  if (base && aheadOfBase === 0) {
    const onRemote = branch ? (await git(worktreePath, ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`])).ok : false;
    return { ...common, work: { state: onRemote ? "merged" : "clean", base: label } };
  }
  if (base && (await contentIsInBase(worktreePath, base))) return { ...common, work: { state: "merged", base: label } };

  const upstream = await git(worktreePath, ["rev-list", "--count", "@{u}..HEAD"]);
  const unpushed = upstream.ok ? Number(upstream.out) : (aheadOfBase ?? 1);
  if (unpushed > 0) return { ...common, work: { state: "unpushed", count: unpushed, base: label } };
  return { ...common, work: { state: "pushed", base: label } };
}

/** The inverse of `worktreeName` in the manager, for worktrees whose session record is gone. */
export function changeOfWorktree(name: string): { change: string; action: SessionAction } {
  return name.startsWith("archive-") ? { change: name.slice("archive-".length), action: "archive" } : { change: name, action: "implement" };
}

const latest = (a?: string, b?: string) => (!a ? b : !b ? a : a > b ? a : b);

export async function listWorktrees(repos: RepoConfig[], sessions: ChangeSession[]): Promise<SessionWorktree[]> {
  const perRepo = await Promise.all(
    repos.map(async (repo) => {
      const dir = join(worktreesDir(), repo.id);
      const names = (await readdir(dir).catch(() => [] as string[])).filter((name) => WORKTREE_NAME.test(name));
      return Promise.all(
        names.map(async (name): Promise<SessionWorktree | undefined> => {
          const path = join(dir, name);
          if (!(await isDirectory(path))) return undefined;
          const session = sessions.find((s) => s.worktreePath === path); // sessions arrive newest first
          const { work, branch, lastCommitAt } = await readWorkStatus(repo.path, path);
          const owner = session ? { change: session.change, action: session.action } : changeOfWorktree(name);
          return { repoId: repo.id, name, path, ...owner, branch: branch ?? session?.branch, work, lastActivityAt: latest(lastCommitAt, session?.updatedAt), sessionId: session?.id };
        }),
      );
    }),
  );
  return perRepo.flat().filter((w): w is SessionWorktree => w !== undefined);
}
