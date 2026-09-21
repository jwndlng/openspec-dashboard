import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CHANGE_NAME } from "./source.ts";

export type CreateChangeResult =
  | { ok: true; name: string; dir: string; wrotePrompt: boolean }
  | { ok: false; reason: "invalid-name" | "invalid-prompt" | "no-openspec-dir" | "duplicate-active" | "duplicate-archived"; message: string };

const SCHEMA_LINE = /^schema:\s*["']?([A-Za-z0-9._-]+)/m;
const ARCHIVE_PREFIX = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
const DEFAULT_SCHEMA = "spec-driven";

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
 * Writes only inside that new directory and never invokes git or the `openspec` CLI. A failed write after `mkdir`
 * removes the just-created directory so a half-empty change never remains.
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

  try {
    const schema = await readSchema(repoPath);
    await writeFile(join(dir, ".openspec.yaml"), `schema: ${schema}\ncreated: ${today()}\n`, "utf8");
    const trimmed = typeof prompt === "string" ? prompt.trim() : "";
    let wrotePrompt = false;
    if (trimmed) {
      await writeFile(join(dir, "prompt.md"), `# Prompt\n\n${trimmed}\n`, "utf8");
      wrotePrompt = true;
    }
    return { ok: true, name, dir, wrotePrompt };
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}
