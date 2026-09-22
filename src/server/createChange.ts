import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CHANGE_NAME } from "./source.ts";

export type CreateChangeResult =
  | { ok: true; name: string; dir: string; wrotePrompt: boolean; staged: boolean }
  | { ok: false; reason: "invalid-name" | "invalid-prompt" | "no-openspec-dir" | "duplicate-active" | "duplicate-archived"; message: string };

const SCHEMA_LINE = /^schema:\s*["']?([A-Za-z0-9._-]+)/m;
const ARCHIVE_PREFIX = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
const DEFAULT_SCHEMA = "spec-driven";
const GIT_TIMEOUT_MS = 10_000;

/**
 * The one writing git command creating a change may run. Deliberately not `git.ts`'s runner: that module is read-only
 * by contract. No shell, no prompt, no stdin; a missing git, a non-zero exit or a timeout all resolve to `false` —
 * never a throw, because by the time this runs the change already exists on disk.
 */
async function git(cwd: string, args: string[], timeoutMs = GIT_TIMEOUT_MS): Promise<boolean> {
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
    }, timeoutMs);
    try {
      return (await proc.exited) === 0 && !timedOut;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/**
 * Stages the new change directory — and only it — so git tracks the change from the moment it exists. The path
 * goes after `--` and is the directory, not `.` or `-A`: whatever else the user has modified or left untracked stays
 * out of the index. Best-effort: `false` means the change is on disk but untracked.
 */
export async function stageChangeDir(repoPath: string, name: string, timeoutMs = GIT_TIMEOUT_MS): Promise<boolean> {
  if (!CHANGE_NAME.test(name)) return false;
  return git(repoPath, ["add", "--", `openspec/changes/${name}/`], timeoutMs);
}

/** Today in the server's local time zone as `YYYY-MM-DD`; matches what `openspec new change` records. */
function today(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function readSchema(repoPath: string): Promise<string> {
  try {
    const text = await readFile(join(repoPath, "openspec", "config.yaml"), "utf8");
    return SCHEMA_LINE.exec(text)?.[1] ?? DEFAULT_SCHEMA;
  } catch {
    return DEFAULT_SCHEMA;
  }
}

async function archivedNames(repoPath: string): Promise<Set<string>> {
  try {
    const entries = await readdir(join(repoPath, "openspec", "changes", "archive"), { withFileTypes: true });
    const names = new Set<string>();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const match = ARCHIVE_PREFIX.exec(entry.name);
      names.add(match ? match[2] : entry.name);
    }
    return names;
  } catch {
    return new Set();
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Creates `openspec/changes/<name>/` in the repository, atomically (exclusive-create so two callers cannot both
 * succeed), and writes `.openspec.yaml` (and `prompt.md` when a non-whitespace prompt is given).
 *
 * Writes only inside that new directory and never invokes the `openspec` CLI. A failed write after `mkdir` removes
 * the just-created directory so a half-empty change never remains. Once both writes have succeeded, and only then,
 * the directory is staged with one `git add` (see `stageChangeDir`); a refused create runs no git at all.
 */
export async function createChange(repoPath: string, name: string, prompt?: string): Promise<CreateChangeResult> {
  if (typeof name !== "string" || !CHANGE_NAME.test(name)) {
    return { ok: false, reason: "invalid-name", message: "change name must match ^[A-Za-z0-9._-]+$" };
  }
  if (prompt !== undefined && prompt !== null && typeof prompt !== "string") {
    return { ok: false, reason: "invalid-prompt", message: "prompt must be a string" };
  }
  if (!(await isDirectory(join(repoPath, "openspec", "changes")))) {
    return { ok: false, reason: "no-openspec-dir", message: "repository has no openspec/changes directory" };
  }
  if (await archivedNames(repoPath).then((names) => names.has(name))) {
    return { ok: false, reason: "duplicate-archived", message: `a change named "${name}" is already archived` };
  }

  const dir = join(repoPath, "openspec", "changes", name);
  try {
    await mkdir(dir, { recursive: false });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST") return { ok: false, reason: "duplicate-active", message: `a change named "${name}" already exists` };
    throw err;
  }

  let wrotePrompt = false;
  try {
    const schema = await readSchema(repoPath);
    await writeFile(join(dir, ".openspec.yaml"), `schema: ${schema}\ncreated: ${today()}\n`, "utf8");
    const trimmed = typeof prompt === "string" ? prompt.trim() : "";
    if (trimmed) {
      await writeFile(join(dir, "prompt.md"), `# Prompt\n\n${trimmed}\n`, "utf8");
      wrotePrompt = true;
    }
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
  // The files exist and are the user's now: whatever git does, the create has succeeded.
  const staged = await stageChangeDir(repoPath, name);
  return { ok: true, name, dir, wrotePrompt, staged };
}
