// Dismissing a change (openspec/specs/change-dismissal; dashboard-api "never writes", exception 7): deleting an active
// change's directory from the main checkout on the user's confirmation, then staging that removal.
//
// This is the ONLY place in the dashboard that deletes a change directory. The preview is read-only; dismissing
// recomputes it and refuses unless it is exactly what the user was shown. Nothing here touches a linked worktree, a
// branch, a ref or anything outside `openspec/changes/<name>/`, and nothing here commits.
import { createHash } from "node:crypto";
import { lstat, readdir, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import type { DismissFile, DismissPreview, DismissResult, RepoConfig, RepoSnapshot } from "../shared/types.ts";
import { knownStatusPaths, subdirectory } from "./git.ts";
import { CHANGE_NAME } from "./source.ts";

const GIT_TIMEOUT_MS = 10_000;

export class DismissError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** A change name that may reach the file system here: the scanner's pattern, and never `archive`, `.` or `..`. */
export function isDismissableName(name: unknown): name is string {
  return typeof name === "string" && CHANGE_NAME.test(name) && name !== "archive" && name !== "." && name !== "..";
}

const running = new Set<string>();
const key = (repoId: string, name: string) => `${repoId}\0${name}`;

/** While true, no session may start for the change: an agent could write into the directory being deleted. */
export function isDismissing(repoId: string, name: string): boolean {
  return running.has(key(repoId, name));
}

/**
 * The one writing git command dismissing may run. Deliberately not `git.ts`'s runner: that module is read-only by
 * contract. No shell, no prompt, no stdin; any failure resolves to `false`, because by then the directory is gone.
 */
async function gitWrite(cwd: string, args: string[]): Promise<boolean> {
  let timedOut = false;
  try {
    const proc = Bun.spawn(["git", ...args], {
      cwd,
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
    });
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, GIT_TIMEOUT_MS);
    try {
      return (await proc.exited) === 0 && !timedOut;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/** Why a change without an active directory in the main checkout cannot be dismissed. */
function notInMain(scanned: RepoSnapshot, name: string): DismissError {
  const change = scanned.changes.find((c) => c.name === name && !c.archived);
  const holder = change && [change.checkout, ...(change.otherCheckouts ?? [])].find((c) => c && !c.isMain);
  if (holder) return new DismissError(404, `"${name}" lives only in the worktree ${holder.branch ? `on ${holder.branch}` : holder.path}; it leaves the board when that worktree is removed`);
  if (scanned.changes.some((c) => c.name === name && c.archived)) return new DismissError(404, `"${name}" is archived; only active changes can be dismissed`);
  return new DismissError(404, `there is no active change named "${name}" in the main checkout`);
}

/**
 * The change's directory in the main checkout: a real directory (not a symbolic link) directly inside
 * `openspec/changes/`. Throws the reason otherwise.
 */
async function activeDir(repo: RepoConfig, scanned: RepoSnapshot, name: string): Promise<string> {
  if (!isDismissableName(name)) throw new DismissError(400, "invalid change name");
  const parent = join(repo.path, "openspec", "changes");
  const dir = join(parent, name);
  const info = await lstat(dir).catch(() => undefined);
  if (!info) throw notInMain(scanned, name);
  if (info.isSymbolicLink()) throw new DismissError(409, `openspec/changes/${name} is a symbolic link; only a real change directory can be dismissed`);
  if (!info.isDirectory()) throw notInMain(scanned, name);
  const [realDir, realParent] = await Promise.all([realpath(dir), realpath(parent)]);
  if (realDir !== join(realParent, name)) throw new DismissError(409, `openspec/changes/${name} does not resolve inside openspec/changes`);
  return dir;
}

interface Entry {
  rel: string;
  abs: string;
  size: number;
  mtimeMs: number;
}

/** Every non-directory entry below `dir`, without following symbolic links (a link is an entry of its own). */
async function walk(dir: string, rel = ""): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walk(abs, path)));
    else {
      const info = await lstat(abs);
      out.push({ rel: path, abs, size: info.size, mtimeMs: info.mtimeMs });
    }
  }
  return out;
}

/**
 * Linked worktrees whose checkout has the change's directory. Looked up on disk rather than taken from the snapshot:
 * the board mentions only copies that differ from the main checkout's, but every copy brings the card back once the
 * main checkout's is gone.
 */
async function worktreeCopies(repo: RepoConfig, scanned: RepoSnapshot, name: string): Promise<{ path: string; branch?: string }[]> {
  const linked = scanned.worktrees.filter((w) => !w.isMain && !w.bare && !w.prunable);
  if (linked.length === 0) return [];
  const sub = await subdirectory(repo.path);
  const held = await Promise.all(linked.map((w) => lstat(join(w.path, sub, "openspec", "changes", name)).then((i) => i.isDirectory(), () => false)));
  return linked.filter((_, i) => held[i]).map((w) => ({ path: w.path, branch: w.branch }));
}

async function inspect(repo: RepoConfig, scanned: RepoSnapshot, name: string): Promise<{ dir: string; preview: DismissPreview }> {
  const dir = await activeDir(repo, scanned, name);
  const entries = await walk(dir);
  const isGit = scanned.isGit;

  // Anything git lists — untracked, ignored, modified, added — is not in HEAD as it is on disk. When git cannot say,
  // every file counts as lost: a failure must never read as "restorable".
  const listed = isGit ? await knownStatusPaths(repo.path, `openspec/changes/${name}`, { ignored: true }) : undefined;
  const differing = new Set(listed?.filter((p) => !p.deleted).map((p) => p.path));
  const restorable = (abs: string) => listed !== undefined && !differing.has(abs);
  const files: (DismissFile & { size?: number; mtimeMs?: number })[] = entries.map((e) => ({ path: e.rel, state: restorable(e.abs) ? "restorable" : "lost", size: e.size, mtimeMs: e.mtimeMs }));
  // Tracked files already deleted from the working tree: git still has them, and their removal is staged too.
  for (const p of listed ?? []) {
    if (!p.deleted || !p.path.startsWith(`${dir}/`)) continue;
    const rel = p.path.slice(dir.length + 1);
    if (!files.some((f) => f.path === rel)) files.push({ path: rel, state: "restorable" });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  const fingerprint = createHash("sha256")
    .update(JSON.stringify([isGit, files.map((f) => [f.path, f.state, f.size ?? null, f.mtimeMs ?? null])]))
    .digest("hex");

  const copies = isGit ? await worktreeCopies(repo, scanned, name) : [];
  return { dir, preview: { repoId: repo.id, name, isGit, files: files.map(({ path, state }) => ({ path, state })), copies, fingerprint } };
}

/** Read-only: what dismissing `name` would delete, and whether git could bring each file back. */
export async function previewDismiss(repo: RepoConfig, scanned: RepoSnapshot, name: string): Promise<DismissPreview> {
  return (await inspect(repo, scanned, name)).preview;
}

/**
 * Deletes the change directory the user confirmed and stages its removal. Refused — nothing deleted, no git run — when a
 * session for the change is open, another dismissal of it runs, or the directory is no longer what `fingerprint` says.
 * Staging is best-effort: a repository without git, an untracked change or a git failure report `staged: false`.
 */
export async function dismissChange(repo: RepoConfig, scanned: RepoSnapshot, name: string, fingerprint: string, hasOpenSession: () => boolean = () => false): Promise<DismissResult> {
  if (!isDismissableName(name)) throw new DismissError(400, "invalid change name");
  const k = key(repo.id, name);
  if (running.has(k)) throw new DismissError(409, `"${name}" is already being dismissed`);
  running.add(k);
  try {
    if (hasOpenSession()) throw new DismissError(409, `an agent session is running for "${name}"; end it first`);
    const { dir, preview } = await inspect(repo, scanned, name);
    if (preview.fingerprint !== fingerprint) throw new DismissError(409, `"${name}" changed since it was shown; look at it again before dismissing`);
    await rm(dir, { recursive: true });
    // The files are gone; whatever git does, the dismissal has succeeded.
    const staged = scanned.isGit ? await gitWrite(repo.path, ["add", "--all", "--", `openspec/changes/${name}/`]) : false;
    return { name, staged };
  } finally {
    running.delete(k);
  }
}
